import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureUserJsonFile, readJsonFile, requireUserId, writeJsonFile } from './userData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INBOX_FILE = path.join(__dirname, '..', 'data', 'inbox.json');

export interface InboxEntry {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  status: 'success' | 'error';
  taskId?: string;
  taskTitle?: string;
  errorMessage?: string;
  attachmentUrl?: string;
  dedupeKey?: string;
  processedAt: string;
}

async function readInbox(): Promise<InboxEntry[]> {
  // Legacy (no user scoping)
  return readJsonFile<InboxEntry[]>(INBOX_FILE, []);
}

async function writeInbox(entries: InboxEntry[]): Promise<void> {
  await writeJsonFile(INBOX_FILE, entries);
}

async function getInboxPath(userId?: string | null): Promise<string> {
  const uid = requireUserId(userId);
  return ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'inbox.json',
    legacyAbsolutePath: INBOX_FILE,
    defaultJson: '[]',
  });
}

async function readInboxForUser(userId?: string | null): Promise<InboxEntry[]> {
  const p = await getInboxPath(userId);
  return readJsonFile<InboxEntry[]>(p, []);
}

async function writeInboxForUser(entries: InboxEntry[], userId?: string | null): Promise<void> {
  const p = await getInboxPath(userId);
  await writeJsonFile(p, entries);
}

/**
 * Create a new inbox entry
 */
export async function createInboxEntry(
  data: Omit<InboxEntry, 'id' | 'processedAt'>,
  userId?: string | null
): Promise<InboxEntry> {
  const entries = await readInboxForUser(userId);
  
  const newEntry: InboxEntry = {
    ...data,
    id: `inbox_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    processedAt: new Date().toISOString(),
  };
  
  entries.unshift(newEntry); // Add to beginning (newest first)
  await writeInboxForUser(entries, userId);
  
  return newEntry;
}

/**
 * Get all inbox entries (newest first)
 */
export async function getInboxEntries(userId?: string | null): Promise<InboxEntry[]> {
  const entries = await readInboxForUser(userId);
  // Ensure sorted by processedAt descending
  return entries.sort((a, b) => 
    new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
  );
}

/**
 * Get a single inbox entry by ID
 */
export async function getInboxEntryById(id: string, userId?: string | null): Promise<InboxEntry | null> {
  const entries = await readInboxForUser(userId);
  return entries.find(e => e.id === id) || null;
}

/**
 * Check if an email has already been processed (duplicate detection)
 * Uses sender + subject + date (day only) as key
 */
export async function isDuplicateEmail(
  from: string,
  subject: string,
  receivedAt: string,
  dedupeKey?: string | null,
  userId?: string | null
): Promise<boolean> {
  const entries = await readInboxForUser(userId);
  const dk = typeof dedupeKey === 'string' && dedupeKey.trim() ? dedupeKey.trim() : null;
  if (dk) {
    return entries.some(e => e.dedupeKey === dk);
  }

  // Backward-compatible heuristic (tighter than day-only to avoid false positives):
  // same sender + subject, received within ±5 minutes.
  const targetMs = new Date(receivedAt).getTime();
  if (isNaN(targetMs)) return false;
  const WINDOW_MS = 5 * 60 * 1000;
  return entries.some(e => {
    if (e.from !== from) return false;
    if (e.subject !== subject) return false;
    const ms = new Date(e.receivedAt).getTime();
    if (isNaN(ms)) return false;
    return Math.abs(ms - targetMs) <= WINDOW_MS;
  });
}

/**
 * Get inbox statistics
 */
export async function getInboxStats(): Promise<{
  total: number;
  success: number;
  error: number;
}> {
  const entries = await readInbox();
  return {
    total: entries.length,
    success: entries.filter(e => e.status === 'success').length,
    error: entries.filter(e => e.status === 'error').length,
  };
}

/**
 * Delete inbox entries associated with a task ID
 */
export async function deleteInboxEntriesByTaskId(taskId: string): Promise<number> {
  // Legacy/global helper (kept for backward compatibility)
  const entries = await readInbox();
  const filtered = entries.filter(e => e.taskId !== taskId);
  const deleted = entries.length - filtered.length;
  if (deleted > 0) {
    await writeInbox(filtered);
  }
  return deleted;
}

export async function deleteInboxEntriesByTaskIdForUser(taskId: string, userId?: string | null): Promise<number> {
  const entries = await readInboxForUser(userId);
  const filtered = entries.filter(e => e.taskId !== taskId);
  const deleted = entries.length - filtered.length;
  if (deleted > 0) {
    await writeInboxForUser(filtered, userId);
  }
  return deleted;
}

/**
 * Delete a single inbox entry by ID
 */
export async function deleteInboxEntry(id: string, userId?: string | null): Promise<boolean> {
  const entries = await readInboxForUser(userId);
  const filtered = entries.filter(e => e.id !== id);
  const wasDeleted = filtered.length < entries.length;
  if (wasDeleted) {
    await writeInboxForUser(filtered, userId);
  }
  return wasDeleted;
}
