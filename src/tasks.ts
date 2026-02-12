import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { deleteInboxEntriesByTaskIdForUser } from './inbox.js';
import { ensureUserJsonFile, readJsonFile, requireUserId, writeJsonFile } from './userData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

export type TaskCategory = 'administratif' | 'enfants-école' | 'santé' | 'finances' | 'logement' | 'personnel';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  deadline: string; // ISO date string
  description?: string;
  status: TaskStatus;
  createdAt: string; // ISO date string
  isRecurring?: boolean; // For birthday/anniversary tasks
  recurringSource?: string; // e.g., "child:123" or "spouse" or "marriage"
  source?: 'manual' | 'email' | 'profile' | 'photo'; // How the task was created
  emailId?: string; // Link back to inbox entry (if source === 'email')
  imageUrl?: string; // Link to source image (if source === 'photo')
  // Milestone 5: Contact info and PDF suggestions
  contactEmail?: string; // Extracted contact email
  contactPhone?: string; // Extracted phone number
  contactName?: string; // Contact name if found
  suggestedTemplates?: string[]; // AI-suggested PDF template IDs
}

// ============================================
// Milestone 5 – FINAL deterministic suggestion logic (closing pass)
// ============================================
function normalizeText(s: string): string {
  return (s || '').toLowerCase();
}

/**
 * Milestone 5 – Flat decision table (FINAL)
 *
 * General rules:
 * - Deterministic only; no heuristics, no fallbacks, no chaining.
 * - If no rule matches exactly -> suggest NOTHING.
 * - If multiple rules match -> suggest NOTHING.
 *
 * Rules:
 * - absence + école/ecole  -> ecole_absence
 * - absence + crèche/creche -> creche_absence
 * - contains "facture" -> facture_contestation
 * - contains "attestation sur l'honneur" / "attestation sur l’honneur" -> attestation_honneur
 */
function inferSuggestedTemplatesDeterministic(
  task: Pick<Task, 'title' | 'description' | 'category' | 'source'>
): string[] | undefined {
  const haystack = normalizeText(`${task.title || ''} ${task.description || ''}`);

  // Evaluate each rule independently; if not exactly ONE match → suggest nothing.
  const matches: Array<{ id: string; ok: boolean }> = [
    { id: 'ecole_absence', ok: haystack.includes('absence') && (haystack.includes('école') || haystack.includes('ecole')) },
    { id: 'creche_absence', ok: haystack.includes('absence') && (haystack.includes('crèche') || haystack.includes('creche')) },
    { id: 'facture_contestation', ok: haystack.includes('facture') },
    {
      id: 'attestation_honneur',
      ok:
        haystack.includes("attestation sur l'honneur") ||
        haystack.includes("attestation sur l’honneur"),
    },
  ];

  const matched = matches.filter((m) => m.ok);
  if (matched.length !== 1) return undefined;
  return [matched[0].id];
}

const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: z.enum(['administratif', 'enfants-école', 'santé', 'finances', 'logement', 'personnel']),
  deadline: z.string(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  createdAt: z.string(),
  isRecurring: z.boolean().optional(),
  recurringSource: z.string().optional(),
  source: z.enum(['manual', 'email', 'profile', 'photo']).optional(),
  emailId: z.string().optional(),
  imageUrl: z.string().optional(),
  // Milestone 5
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  contactName: z.string().optional(),
  suggestedTemplates: z.array(z.string()).optional(),
});

async function readTasks(userId?: string | null): Promise<Task[]> {
  const uid = requireUserId(userId);
  const pathToRead = await ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'tasks.json',
    legacyAbsolutePath: TASKS_FILE,
    defaultJson: '[]',
  });

  const data = await readJsonFile<unknown>(pathToRead, []);
  try {
    return z.array(TaskSchema).parse(data);
  } catch {
    return [];
  }
}

async function writeTasks(tasks: Task[], userId?: string | null): Promise<void> {
  const uid = requireUserId(userId);
  const pathToWrite = await ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'tasks.json',
    legacyAbsolutePath: TASKS_FILE,
    defaultJson: '[]',
  });
  await writeJsonFile(pathToWrite, tasks);
}

export async function createTask(
  taskData: Omit<Task, 'id' | 'createdAt' | 'status'>,
  userId?: string | null
): Promise<Task> {
  const tasks = await readTasks(userId);
  
  // Milestone 5 FROZEN: deterministic suggestions from flat decision table
  const suggestedTemplates = inferSuggestedTemplatesDeterministic(taskData);

  const newTask: Task = {
    ...taskData,
    suggestedTemplates,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    status: 'todo',
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  await writeTasks(tasks, userId);
  return newTask;
}

export async function getTasks(userId?: string | null): Promise<Task[]> {
  const tasks = await readTasks(userId);
  // Sort by deadline ascending
  return tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

export async function getTaskById(id: string, userId?: string | null): Promise<Task | null> {
  const tasks = await readTasks(userId);
  return tasks.find(t => t.id === id) || null;
}

export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt'>>,
  userId?: string | null
): Promise<Task | null> {
  const tasks = await readTasks(userId);
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  const merged = { ...tasks[index], ...updates };

  // Milestone 5 FROZEN: recompute deterministic suggestions from flat decision table
  merged.suggestedTemplates = inferSuggestedTemplatesDeterministic(merged);

  tasks[index] = merged;
  await writeTasks(tasks, userId);
  return merged;
}

export async function deleteTask(id: string, userId?: string | null): Promise<boolean> {
  const tasks = await readTasks(userId);
  const filtered = tasks.filter(t => t.id !== id);
  if (filtered.length === tasks.length) return false; // Task not found
  
  await writeTasks(filtered, userId);
  
  // Cascade: delete associated inbox entries
  try {
    const deletedInbox = await deleteInboxEntriesByTaskIdForUser(id, userId);
    if (deletedInbox > 0) {
      console.log(`Deleted ${deletedInbox} inbox entry/entries for task ${id}`);
    }
  } catch (error) {
    console.error('Failed to delete inbox entries:', error);
    // Non-blocking: task already deleted
  }
  
  return true;
}

export async function getTasksForToday(userId?: string | null): Promise<Task[]> {
  const tasks = await readTasks(userId);
  const now = new Date();
  
  // Helper to get date string YYYY-MM-DD in local time
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayStr = getLocalDateString(now);
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDaysStr = getLocalDateString(sevenDaysFromNow);
  
  // Get upcoming tasks within the next 7 days (including today)
  // Birthday/anniversary tasks get priority, regular tasks also included
  const relevantTasks = tasks.filter(t => {
    if (t.status === 'done') return false;
    
    const deadline = new Date(t.deadline);
    const deadlineStr = getLocalDateString(deadline);
    
    // Compare dates as strings to ignore time component
    // Task is relevant if deadline is today or in the next 7 days
    return deadlineStr >= todayStr && deadlineStr <= sevenDaysStr;
  });
  
  // Sort: birthday/anniversary tasks first (by deadline), then regular tasks (by deadline)
  const sorted = relevantTasks.sort((a, b) => {
    const aDeadline = new Date(a.deadline);
    const bDeadline = new Date(b.deadline);
    
    // Birthday tasks always come first
    if (a.isRecurring && !b.isRecurring) return -1;
    if (!a.isRecurring && b.isRecurring) return 1;
    
    // Within same type, sort by deadline
    return aDeadline.getTime() - bDeadline.getTime();
  });
  
  return sorted.slice(0, 3);
}

// Recompute all task suggestions using the frozen Milestone 5 decision table
export async function sanitizeAllTasks(): Promise<void> {
  // Legacy/global operation: sanitize the legacy shared file only.
  // Multi-user files are created on-demand and should not be mass-mutated at startup.
  const data = await readJsonFile<unknown>(TASKS_FILE, []);
  let tasks: Task[] = [];
  try {
    tasks = z.array(TaskSchema).parse(data);
  } catch {
    tasks = [];
  }
  let updated = false;

  const sanitized = tasks.map((task) => {
    // Recompute using frozen decision table
    const newTemplates = inferSuggestedTemplatesDeterministic(task);

    const prev = task.suggestedTemplates ?? null;
    const next = newTemplates ?? null;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      updated = true;
    }

    return { ...task, suggestedTemplates: newTemplates };
  });

  if (updated) {
    await writeJsonFile(TASKS_FILE, sanitized);
  }
}

// Helper: Delete all tasks associated with a recurring source (for profile deletion)
export async function deleteTasksByRecurringSource(source: string, userId?: string | null): Promise<number> {
  const tasks = await readTasks(userId);
  const filtered = tasks.filter(t => t.recurringSource !== source);
  const deleted = tasks.length - filtered.length;
  if (deleted > 0) {
    await writeTasks(filtered, userId);
  }
  return deleted;
}

// Helper: Calculate next occurrence of a date (for birthdays/anniversaries)
export function getNextOccurrence(dateString: string): Date {
  const date = new Date(dateString);
  const now = new Date();
  const year = now.getFullYear();
  
  // Create date for this year with same month/day at start of day
  const nextDate = new Date(year, date.getMonth(), date.getDate(), 0, 0, 0, 0);
  
  // Create today's date at start of day for comparison (date only, ignore time)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  // If the date has already PASSED this year (strictly before today), use next year
  // This ensures same-day birthdays appear TODAY, not next year
  if (nextDate < today) {
    nextDate.setFullYear(year + 1);
  }
  
  return nextDate;
}

// Helper: Create a recurring task (birthday/anniversary)
export async function createRecurringTask(data: {
  title: string;
  category: TaskCategory;
  birthDate: string;
  recurringSource: string;
  description?: string;
}, userId?: string | null): Promise<Task> {
  const nextOccurrence = getNextOccurrence(data.birthDate);
  
  return createTask({
    title: data.title,
    category: data.category,
    deadline: nextOccurrence.toISOString(),
    description: data.description,
    isRecurring: true,
    recurringSource: data.recurringSource,
  }, userId);
}
