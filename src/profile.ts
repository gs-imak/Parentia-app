import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createRecurringTask, deleteTasksByRecurringSource } from './tasks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE_FILE = path.join(__dirname, '..', 'data', 'profile.json');

export interface Child {
  id: string;
  firstName: string;
  birthDate: string; // ISO date string
  height?: number; // cm
  weight?: number; // kg
  notes?: string;
}

export interface Spouse {
  firstName: string;
}

export interface Profile {
  children: Child[];
  spouse?: Spouse;
  marriageDate?: string; // ISO date string
}

const ChildSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1),
  birthDate: z.string(),
  height: z.number().optional(),
  weight: z.number().optional(),
  notes: z.string().optional(),
});

const SpouseSchema = z.object({
  firstName: z.string().min(1),
});

const ProfileSchema = z.object({
  children: z.array(ChildSchema).max(5),
  spouse: SpouseSchema.optional(),
  marriageDate: z.string().optional(),
});

async function readProfile(): Promise<Profile> {
  try {
    const content = await fs.readFile(PROFILE_FILE, 'utf-8');
    const data = JSON.parse(content);
    return ProfileSchema.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty profile
    return { children: [] };
  }
}

async function writeProfile(profile: Profile): Promise<void> {
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
}

export async function getProfile(): Promise<Profile> {
  return readProfile();
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile> {
  const profile = await readProfile();
  const updated = { ...profile, ...updates };
  await writeProfile(updated);
  return updated;
}

export async function addChild(childData: Omit<Child, 'id'>): Promise<Child> {
  const profile = await readProfile();
  
  if (profile.children.length >= 5) {
    throw new Error('Maximum 5 children allowed');
  }
  
  const newChild: Child = {
    ...childData,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  };
  
  profile.children.push(newChild);
  await writeProfile(profile);
  
  // Auto-create birthday task
  const birthDate = new Date(newChild.birthDate);
  const formattedDate = birthDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
  await createRecurringTask({
    title: `Anniversaire de ${newChild.firstName} - le ${formattedDate}`,
    category: 'enfants-école',
    birthDate: newChild.birthDate,
    recurringSource: `child:${newChild.id}`,
    description: 'Penser au gâteau / cadeau / organisation.',
  });
  
  return newChild;
}

export async function getChildById(id: string): Promise<Child | null> {
  const profile = await readProfile();
  return profile.children.find(c => c.id === id) || null;
}

export async function updateChild(id: string, updates: Partial<Omit<Child, 'id'>>): Promise<Child | null> {
  const profile = await readProfile();
  const index = profile.children.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  profile.children[index] = { ...profile.children[index], ...updates };
  await writeProfile(profile);
  return profile.children[index];
}

export async function deleteChild(id: string): Promise<boolean> {
  const profile = await readProfile();
  const filtered = profile.children.filter(c => c.id !== id);
  
  if (filtered.length === profile.children.length) return false; // Child not found
  
  profile.children = filtered;
  await writeProfile(profile);
  
  // Delete associated birthday task
  await deleteTasksByRecurringSource(`child:${id}`);
  
  return true;
}

export async function updateSpouse(spouse: Spouse): Promise<Profile> {
  const profile = await readProfile();
  const isNewSpouse = !profile.spouse;
  profile.spouse = spouse;
  await writeProfile(profile);
  
  // Only create birthday task if this is a new spouse (not an update)
  // Since Spouse doesn't have birthDate in our schema, we won't create a task here
  // The client asked for spouse firstName only in M2 requirements
  
  return profile;
}

export async function deleteSpouse(): Promise<Profile> {
  const profile = await readProfile();
  delete profile.spouse;
  await writeProfile(profile);
  
  // Delete associated birthday task (if spouse had birthDate field)
  await deleteTasksByRecurringSource('spouse');
  
  return profile;
}

export async function updateMarriageDate(date: string): Promise<Profile> {
  const profile = await readProfile();
  const isNewDate = !profile.marriageDate;
  profile.marriageDate = date;
  await writeProfile(profile);
  
  // Auto-create anniversary task if this is a new date
  if (isNewDate) {
    const marriageDate = new Date(date);
    const formattedDate = marriageDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
    await createRecurringTask({
      title: `Anniversaire de mariage - le ${formattedDate}`,
      category: 'personnel',
      birthDate: date,
      recurringSource: 'marriage',
      description: 'Penser à fêter cet événement important.',
    });
  }
  
  return profile;
}

export async function deleteMarriageDate(): Promise<Profile> {
  const profile = await readProfile();
  delete profile.marriageDate;
  await writeProfile(profile);
  
  // Delete associated anniversary task
  await deleteTasksByRecurringSource('marriage');
  
  return profile;
}
