import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { deleteInboxEntriesByTaskId } from './inbox.js';
import { getSuggestedTemplateIds } from './pdfTemplates.js';

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
// Deterministic suggestion logic (Milestone 5)
// ============================================
function normalizeText(s: string): string {
  return (s || '').toLowerCase();
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function isSchoolOrCrecheTask(haystack: string): boolean {
  return hasAny(haystack, [
    'absence',
    'école',
    'ecole',
    'crèche',
    'creche',
    'retard',
    'rendez-vous médical enfant',
    'rendez vous médical enfant',
    'rdv médical enfant',
    'rdv medical enfant',
  ]);
}

function isHealthTask(haystack: string): boolean {
  return hasAny(haystack, [
    'rendez-vous médical',
    'rendez vous médical',
    'rdv médical',
    'rdv medical',
    'médecin',
    'medecin',
    'pédiatre',
    'pediatre',
    'consultation',
  ]);
}

function isInvoiceOrContractTask(haystack: string): boolean {
  // Keep simple & explicit as requested
  return (
    haystack.includes('facture') ||
    haystack.includes('invoice') ||
    haystack.includes('€') ||
    haystack.includes('eur') ||
    haystack.includes('montant') ||
    hasAny(haystack, ['edf', 'selfbox', 'orange', 'sosh', 'sfr', 'free', 'bouygues', 'engie'])
  );
}

function isHousingIdentityTask(haystack: string): boolean {
  return hasAny(haystack, ['domicile', 'hébergement', 'hebergement', 'adresse', 'attestation']);
}

function extractFirstPhoneNumber(text: string): string | null {
  const s = text || '';
  // French phone numbers with optional separators, with 0X... or +33 / 0033
  const phoneRegex = /(?:(?:\+|00)33|0)\s?[1-9](?:[\s.-]?[0-9]{2}){4}/;
  const m = s.match(phoneRegex);
  return m?.[0]?.trim() || null;
}

function inferSuggestedTemplatesDeterministic(
  task: Pick<Task, 'title' | 'description' | 'category' | 'source'>
): string[] | undefined {
  const haystack = normalizeText(`${task.title || ''}\n${task.description || ''}\n${task.source || ''}\n${task.category || ''}`);

  const suggestions: string[] = [];

  // 1) School / crèche
  if (isSchoolOrCrecheTask(haystack)) {
    // Default: justificatif d'absence (école ou crèche)
    if (haystack.includes('crèche') || haystack.includes('creche')) {
      suggestions.push('creche_absence');
    } else {
      suggestions.push('ecole_absence');
    }
    // "Message d'information à l'école" is handled via contact actions (not a PDF template).
  }

  // 2) Health / medical appointments
  if (isHealthTask(haystack)) {
    suggestions.push('sante_rdv_medical', 'sante_demande_remboursement');
  }

  // 3) Invoices / contracts
  if (isInvoiceOrContractTask(haystack)) {
    suggestions.push('facture_contestation', 'contrat_resiliation');
  }

  // 4-5) Housing / identity + generic attestations
  if (isHousingIdentityTask(haystack)) {
    // Select based on wording
    if (/attestation\s+sur\s+l['’]honneur/.test(haystack)) suggestions.push('attestation_honneur');
    if (/attestation\s+d['’]?\s*h[ée]bergement/.test(haystack) || haystack.includes('hébergement') || haystack.includes('hebergement')) {
      suggestions.push('attestation_hebergement');
    }
    if (haystack.includes('domicile') || haystack.includes('adresse')) {
      suggestions.push('attestation_domicile');
    }
  }

  const unique = Array.from(new Set(suggestions)).slice(0, 3);
  return unique.length > 0 ? unique : undefined;
}

function sanitizeSuggestedTemplatesForTask(
  suggestedTemplates: string[] | undefined,
  category: TaskCategory,
  title: string,
  description?: string
): string[] | undefined {
  if (!suggestedTemplates || suggestedTemplates.length === 0) return undefined;

  // Only keep templates that match the task category
  const allowed = new Set(getSuggestedTemplateIds(category));
  let filtered = suggestedTemplates.filter((id) => allowed.has(id));

  // Deduplicate and cap to 3
  const unique = Array.from(new Set(filtered)).slice(0, 3);
  return unique.length > 0 ? unique : undefined;
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

async function readTasks(): Promise<Task[]> {
  try {
    const content = await fs.readFile(TASKS_FILE, 'utf-8');
    const data = JSON.parse(content);
    return z.array(TaskSchema).parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return [];
  }
}

async function writeTasks(tasks: Task[]): Promise<void> {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

export async function createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<Task> {
  const tasks = await readTasks();
  // Milestone 5 deterministic suggestions (do not rely on AI suggestions)
  const inferredTemplates = inferSuggestedTemplatesDeterministic(taskData);
  const sanitizedTemplates = sanitizeSuggestedTemplatesForTask(
    inferredTemplates,
    taskData.category,
    taskData.title,
    taskData.description
  );

  // Contact fallback: if AI didn't set a phone number but one is visible in the task text, persist it.
  const phoneFromText =
    taskData.contactPhone ||
    extractFirstPhoneNumber(`${taskData.title || ''}\n${taskData.description || ''}`) ||
    undefined;

  const newTask: Task = {
    ...taskData,
    suggestedTemplates: sanitizedTemplates,
    contactPhone: phoneFromText,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    status: 'todo',
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  await writeTasks(tasks);
  return newTask;
}

export async function getTasks(): Promise<Task[]> {
  const tasks = await readTasks();
  // Sort by deadline ascending
  return tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

export async function getTaskById(id: string): Promise<Task | null> {
  const tasks = await readTasks();
  return tasks.find(t => t.id === id) || null;
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
  const tasks = await readTasks();
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  const merged = { ...tasks[index], ...updates };

  // Recompute deterministic suggestions on update (stable & predictable)
  merged.suggestedTemplates = inferSuggestedTemplatesDeterministic(merged);

  // If contactPhone is still missing, try to pull it from title/description.
  if (!merged.contactPhone) {
    const autoPhone = extractFirstPhoneNumber(`${merged.title || ''}\n${merged.description || ''}`);
    if (autoPhone) merged.contactPhone = autoPhone;
  }

  merged.suggestedTemplates = sanitizeSuggestedTemplatesForTask(
    merged.suggestedTemplates,
    merged.category,
    merged.title,
    merged.description
  );

  tasks[index] = merged;
  await writeTasks(tasks);
  return merged;
}

export async function deleteTask(id: string): Promise<boolean> {
  const tasks = await readTasks();
  const filtered = tasks.filter(t => t.id !== id);
  if (filtered.length === tasks.length) return false; // Task not found
  
  await writeTasks(filtered);
  
  // Cascade: delete associated inbox entries
  try {
    const deletedInbox = await deleteInboxEntriesByTaskId(id);
    if (deletedInbox > 0) {
      console.log(`Deleted ${deletedInbox} inbox entry/entries for task ${id}`);
    }
  } catch (error) {
    console.error('Failed to delete inbox entries:', error);
    // Non-blocking: task already deleted
  }
  
  return true;
}

export async function getTasksForToday(): Promise<Task[]> {
  const tasks = await readTasks();
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

// Sanitize existing tasks in storage (used to clean legacy bad suggestions)
export async function sanitizeAllTasks(): Promise<void> {
  const tasks = await readTasks();
  let updated = false;

  const sanitized = tasks.map((task) => {
    const cleanedTemplates = sanitizeSuggestedTemplatesForTask(
      task.suggestedTemplates,
      task.category,
      task.title,
      task.description
    );

    const prev = task.suggestedTemplates ?? null;
    const next = cleanedTemplates ?? null;
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      updated = true;
    }

    return { ...task, suggestedTemplates: cleanedTemplates };
  });

  if (updated) {
    await writeTasks(sanitized);
  }
}

// Helper: Delete all tasks associated with a recurring source (for profile deletion)
export async function deleteTasksByRecurringSource(source: string): Promise<number> {
  const tasks = await readTasks();
  const filtered = tasks.filter(t => t.recurringSource !== source);
  const deleted = tasks.length - filtered.length;
  if (deleted > 0) {
    await writeTasks(filtered);
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
}): Promise<Task> {
  const nextOccurrence = getNextOccurrence(data.birthDate);
  
  return createTask({
    title: data.title,
    category: data.category,
    deadline: nextOccurrence.toISOString(),
    description: data.description,
    isRecurring: true,
    recurringSource: data.recurringSource,
  });
}
