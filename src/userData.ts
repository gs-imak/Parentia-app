import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

/**
 * Thrown when client-supplied input fails validation. Routes map this to a
 * 400 instead of a generic 500 so bad input is rejected, not persisted.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function normalizeUserId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Allow only uid_ + safe chars (lower/upper tolerated, normalized to lower)
  // Keeps filesystem-safe and prevents path traversal.
  if (!/^uid_[a-z0-9]+$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function requireUserId(raw: unknown): string {
  // For internal calls where user scoping is optional, fall back to a stable default.
  return normalizeUserId(raw) ?? 'uid_default';
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function getUserDir(userId: string): string {
  return path.join(USERS_DIR, userId);
}

export function getUserFile(userId: string, filename: string): string {
  return path.join(getUserDir(userId), filename);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Legacy auto-migration strategy:
 * - If a per-user file doesn't exist yet, but a legacy file exists (data/<name>.json),
 *   copy legacy into the per-user file (do NOT delete legacy).
 * - This keeps backward compatibility and avoids "data loss" after enabling multi-user.
 */
export async function ensureUserJsonFile(opts: {
  userId: string;
  perUserFilename: string;
  legacyAbsolutePath: string;
  defaultJson: string;
}): Promise<string> {
  const userDir = getUserDir(opts.userId);
  const perUserPath = getUserFile(opts.userId, opts.perUserFilename);

  await ensureDir(userDir);

  const hasPerUser = await fileExists(perUserPath);
  if (hasPerUser) return perUserPath;

  const hasLegacy = await fileExists(opts.legacyAbsolutePath);
  if (hasLegacy) {
    try {
      const legacyContent = await fs.readFile(opts.legacyAbsolutePath, 'utf-8');
      await fs.writeFile(perUserPath, legacyContent, 'utf-8');
      return perUserPath;
    } catch {
      // Fall back to default if legacy can't be read/copied.
    }
  }

  await fs.writeFile(perUserPath, opts.defaultJson, 'utf-8');
  return perUserPath;
}

export async function readJsonFile<T>(absolutePath: string, fallback: T): Promise<T> {
  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch (err) {
    // A genuinely missing file is the only case where the fallback is safe.
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
    throw err; // permission / I/O error — do not mask
  }
  try {
    // Strip a leading UTF-8 BOM (some editors/tools add one); it is not
    // corruption but JSON.parse rejects it.
    return JSON.parse(content.replace(/^﻿/, '')) as T;
  } catch {
    // The file exists but is corrupt/truncated. Returning `fallback` here would
    // let the caller overwrite recoverable data with empty content (silent,
    // permanent data loss). Surface it instead so the request fails loudly.
    throw new Error(`Corrupt JSON file: ${path.basename(absolutePath)}`);
  }
}

export async function writeJsonFile<T>(absolutePath: string, value: T): Promise<void> {
  const dir = path.dirname(absolutePath);
  await ensureDir(dir);
  // Atomic write: serialize to a temp file then rename. A crash/interrupt
  // mid-write leaves the original file intact rather than truncated.
  const tmpPath = `${absolutePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  await fs.rename(tmpPath, absolutePath);
}

