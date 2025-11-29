import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

export type TaskCategory = 'administratif' | 'enfants-école' | 'santé' | 'finances' | 'personnel';
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
  source?: 'manual' | 'email' | 'profile'; // How the task was created
  emailId?: string; // Link back to inbox entry (if source === 'email')
}

const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: z.enum(['administratif', 'enfants-école', 'santé', 'finances', 'personnel']),
  deadline: z.string(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']),
  createdAt: z.string(),
  isRecurring: z.boolean().optional(),
  recurringSource: z.string().optional(),
  source: z.enum(['manual', 'email', 'profile']).optional(),
  emailId: z.string().optional(),
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
  return true;
}

export async function getTasksForToday(): Promise<Task[]> {
  const tasks = await readTasks();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  // Get tasks due today OR upcoming birthday/anniversary tasks within 7 days
  const relevantTasks = tasks.filter(t => {
    if (t.status === 'done') return false;
    
    const deadline = new Date(t.deadline);
    
    // Include birthday/anniversary tasks if within 7 days (including today)
    if (t.isRecurring) {
      return deadline >= today && deadline <= sevenDaysFromNow;
    }
    
    // Include regular tasks only if due today
    return deadline >= today && deadline < tomorrow;
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
  
  // Create date for this year with same month/day
  const nextDate = new Date(year, date.getMonth(), date.getDate());
  
  // If already passed this year, use next year
  if (nextDate < now) {
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
