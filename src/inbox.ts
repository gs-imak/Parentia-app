import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  processedAt: string;
}

async function readInbox(): Promise<InboxEntry[]> {
  try {
    const content = await fs.readFile(INBOX_FILE, 'utf-8');
    return JSON.parse(content) as InboxEntry[];
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return [];
  }
}

async function writeInbox(entries: InboxEntry[]): Promise<void> {
  await fs.writeFile(INBOX_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * Create a new inbox entry
 */
export async function createInboxEntry(
  data: Omit<InboxEntry, 'id' | 'processedAt'>
): Promise<InboxEntry> {
  const entries = await readInbox();
  
  const newEntry: InboxEntry = {
    ...data,
    id: `inbox_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    processedAt: new Date().toISOString(),
  };
  
  entries.unshift(newEntry); // Add to beginning (newest first)
  await writeInbox(entries);
  
  return newEntry;
}

/**
 * Get all inbox entries (newest first)
 */
export async function getInboxEntries(): Promise<InboxEntry[]> {
  const entries = await readInbox();
  // Ensure sorted by processedAt descending
  return entries.sort((a, b) => 
    new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
  );
}

/**
 * Get a single inbox entry by ID
 */
export async function getInboxEntryById(id: string): Promise<InboxEntry | null> {
  const entries = await readInbox();
  return entries.find(e => e.id === id) || null;
}

/**
 * Check if an email has already been processed (duplicate detection)
 * Uses sender + subject + date (day only) as key
 */
export async function isDuplicateEmail(
  from: string,
  subject: string,
  receivedAt: string
): Promise<boolean> {
  const entries = await readInbox();
  const dateKey = receivedAt.slice(0, 10); // YYYY-MM-DD
  
  return entries.some(e => 
    e.from === from &&
    e.subject === subject &&
    e.receivedAt.slice(0, 10) === dateKey
  );
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
  const entries = await readInbox();
  const filtered = entries.filter(e => e.taskId !== taskId);
  const deleted = entries.length - filtered.length;
  if (deleted > 0) {
    await writeInbox(filtered);
  }
  return deleted;
}

/**
 * Delete a single inbox entry by ID
 */
export async function deleteInboxEntry(id: string): Promise<boolean> {
  const entries = await readInbox();
  const filtered = entries.filter(e => e.id !== id);
  const wasDeleted = filtered.length < entries.length;
  if (wasDeleted) {
    await writeInbox(filtered);
  }
  return wasDeleted;
}
