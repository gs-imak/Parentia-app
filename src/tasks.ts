import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { deleteInboxEntriesByTaskId } from './inbox.js';

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
  const newTask: Task = {
    ...taskData,
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
  
  tasks[index] = { ...tasks[index], ...updates };
  await writeTasks(tasks);
  return tasks[index];
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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  // Get upcoming tasks within the next 7 days (including today)
  // Birthday/anniversary tasks get priority, regular tasks also included
  const relevantTasks = tasks.filter(t => {
    if (t.status === 'done') return false;
    
    const deadline = new Date(t.deadline);
    
    // Include all tasks (recurring or not) if within 7 days from today
    return deadline >= today && deadline <= sevenDaysFromNow;
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
