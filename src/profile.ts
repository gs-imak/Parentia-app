import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createRecurringTask, deleteTasksByRecurringSource } from './tasks.js';
import { ensureUserJsonFile, readJsonFile, requireUserId, ValidationError, writeJsonFile } from './userData.js';

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
  birthDate?: string; // ISO date string - optional
}

export interface Profile {
  children: Child[];
  spouse?: Spouse;
  marriageDate?: string; // ISO date string
  // Milestone 5: Address fields for PDF generation
  firstName?: string; // First name
  lastName?: string; // Family name
  address?: string; // Street address
  postalCode?: string; // Postal code
  city?: string; // City
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
  birthDate: z.string().optional(),
});

const ProfileSchema = z.object({
  children: z.array(ChildSchema).max(5),
  spouse: SpouseSchema.optional(),
  marriageDate: z.string().optional(),
  // Milestone 5: Address fields
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

// Allowed fields on a child PATCH. id is immutable; unknown keys are stripped
// and invalid types rejected so a malformed update can't corrupt the whole
// profile (a single bad child makes the entire profile fail to parse on read).
const ChildUpdateSchema = ChildSchema.omit({ id: true }).partial();

// Address fields must all be strings; a non-string value would make the whole
// profile fail ProfileSchema on the next read and silently wipe it.
const AddressUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

/** Reject date strings that don't parse, before they reach date math / storage. */
function assertValidDateString(value: string, fieldLabel: string): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(`${fieldLabel} invalide.`);
  }
}

async function readProfile(userId?: string | null): Promise<Profile> {
  const uid = requireUserId(userId);
  const pathToRead = await ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'profile.json',
    legacyAbsolutePath: PROFILE_FILE,
    defaultJson: JSON.stringify({ children: [] }, null, 2),
  });

  const data = await readJsonFile<unknown>(pathToRead, { children: [] });
  const result = ProfileSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('[profile] readProfile: Zod parse failed for user', uid, result.error.issues);
  return { children: [] };
}

async function writeProfile(profile: Profile, userId?: string | null): Promise<void> {
  const uid = requireUserId(userId);
  const pathToWrite = await ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'profile.json',
    legacyAbsolutePath: PROFILE_FILE,
    defaultJson: JSON.stringify({ children: [] }, null, 2),
  });
  await writeJsonFile(pathToWrite, profile);
}

export async function getProfile(userId?: string | null): Promise<Profile> {
  return readProfile(userId);
}

export async function updateProfile(updates: Partial<Profile>, userId?: string | null): Promise<Profile> {
  const profile = await readProfile(userId);
  const updated = { ...profile, ...updates };
  await writeProfile(updated, userId);
  return updated;
}

export async function addChild(childData: Omit<Child, 'id'>, userId?: string | null): Promise<Child> {
  const profile = await readProfile(userId);

  if (profile.children.length >= 5) {
    throw new Error('Maximum 5 children allowed');
  }

  // Validate before writing: bad firstName/birthDate/height/weight types would
  // otherwise corrupt the profile and wipe it on the next read.
  const parsed = ChildSchema.omit({ id: true }).safeParse(childData);
  if (!parsed.success) {
    throw new ValidationError('Champs enfant invalides.');
  }
  assertValidDateString(parsed.data.birthDate, 'Date de naissance');

  const newChild: Child = {
    ...parsed.data,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  };
  
  profile.children.push(newChild);
  await writeProfile(profile, userId);
  
  // Auto-create birthday task
  await createRecurringTask({
    title: `Anniversaire de ${newChild.firstName}`,
    category: 'enfants-école',
    birthDate: newChild.birthDate,
    recurringSource: `child:${newChild.id}`,
    description: 'Penser au gâteau / cadeau / organisation.',
  }, userId);
  
  return newChild;
}

export async function getChildById(id: string, userId?: string | null): Promise<Child | null> {
  const profile = await readProfile(userId);
  return profile.children.find(c => c.id === id) || null;
}

export async function updateChild(id: string, updates: Partial<Omit<Child, 'id'>>, userId?: string | null): Promise<Child | null> {
  const profile = await readProfile(userId);
  const index = profile.children.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  // Validate + whitelist incoming fields so a malformed update can't corrupt
  // the profile (a single invalid child fails the whole-profile parse on read).
  const parsedUpdates = ChildUpdateSchema.safeParse(updates);
  if (!parsedUpdates.success) {
    throw new ValidationError('Champs enfant invalides.');
  }
  const safeUpdates = parsedUpdates.data;
  if (safeUpdates.birthDate !== undefined) {
    assertValidDateString(safeUpdates.birthDate, 'Date de naissance');
  }

  const oldChild = profile.children[index];
  profile.children[index] = { ...oldChild, ...safeUpdates };
  await writeProfile(profile, userId);

  // If birthDate changed, update the birthday task
  if (safeUpdates.birthDate && safeUpdates.birthDate !== oldChild.birthDate) {
    // Delete old birthday task
    await deleteTasksByRecurringSource(`child:${id}`, userId);
    
    // Create new birthday task with updated date
    const firstName = safeUpdates.firstName || oldChild.firstName;
    await createRecurringTask({
      title: `Anniversaire de ${firstName}`,
      category: 'enfants-école',
      birthDate: safeUpdates.birthDate,
      recurringSource: `child:${id}`,
      description: 'Penser au gâteau / cadeau / organisation.',
    }, userId);
  }
  
  return profile.children[index];
}

export async function deleteChild(id: string, userId?: string | null): Promise<boolean> {
  const profile = await readProfile(userId);
  const filtered = profile.children.filter(c => c.id !== id);
  
  if (filtered.length === profile.children.length) return false; // Child not found
  
  profile.children = filtered;
  await writeProfile(profile, userId);
  
  // Delete associated birthday task
  await deleteTasksByRecurringSource(`child:${id}`, userId);
  
  return true;
}

export async function updateSpouse(spouse: Spouse, userId?: string | null): Promise<Profile> {
  const parsed = SpouseSchema.safeParse(spouse);
  if (!parsed.success) {
    throw new ValidationError('Champs conjoint invalides.');
  }
  if (parsed.data.birthDate !== undefined) {
    assertValidDateString(parsed.data.birthDate, 'Date de naissance du conjoint');
  }
  spouse = parsed.data;

  const profile = await readProfile(userId);
  const isNewSpouse = !profile.spouse;
  const hadBirthDate = profile.spouse?.birthDate;
  profile.spouse = spouse;
  await writeProfile(profile, userId);
  
  // Auto-create birthday task if spouse has birthDate and it's new or changed
  if (spouse.birthDate && (!hadBirthDate || hadBirthDate !== spouse.birthDate)) {
    // Delete old birthday task if it existed
    if (hadBirthDate) {
      await deleteTasksByRecurringSource('spouse', userId);
    }
    
    await createRecurringTask({
      title: `Anniversaire de ${spouse.firstName}`,
      category: 'personnel',
      birthDate: spouse.birthDate,
      recurringSource: 'spouse',
      description: 'Penser au gâteau / cadeau / organisation.',
    }, userId);
  }
  
  return profile;
}

export async function deleteSpouse(userId?: string | null): Promise<Profile> {
  const profile = await readProfile(userId);
  delete profile.spouse;
  await writeProfile(profile, userId);
  
  // Delete associated birthday task (if spouse had birthDate field)
  await deleteTasksByRecurringSource('spouse', userId);
  
  return profile;
}

export async function updateMarriageDate(date: string, userId?: string | null): Promise<Profile> {
  // Reject unparseable dates before any write — otherwise the profile is
  // persisted and createRecurringTask then throws on toISOString(), leaving a
  // half-applied change with no anniversary task.
  assertValidDateString(date, 'Date de mariage');

  const profile = await readProfile(userId);
  const hadDate = profile.marriageDate;
  profile.marriageDate = date;
  await writeProfile(profile, userId);
  
  // Always delete old task if it existed
  if (hadDate) {
    await deleteTasksByRecurringSource('marriage', userId);
  }
  
  // Create new anniversary task with updated date
  await createRecurringTask({
    title: `Anniversaire de mariage`,
    category: 'personnel',
    birthDate: date,
    recurringSource: 'marriage',
    description: 'Penser à fêter cet événement important.',
  }, userId);
  
  return profile;
}

export async function deleteMarriageDate(userId?: string | null): Promise<Profile> {
  const profile = await readProfile(userId);
  delete profile.marriageDate;
  await writeProfile(profile, userId);
  
  // Delete associated anniversary task
  await deleteTasksByRecurringSource('marriage', userId);
  
  return profile;
}

// Milestone 5: Update profile address information
export async function updateProfileAddress(data: {
  firstName?: string;
  lastName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}, userId?: string | null): Promise<Profile> {
  // All address fields must be strings; a non-string value would make the whole
  // profile fail to parse on the next read and silently wipe it.
  const parsed = AddressUpdateSchema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError('Champs adresse invalides.');
  }
  const safe = parsed.data;

  const profile = await readProfile(userId);

  if (safe.firstName !== undefined) profile.firstName = safe.firstName;
  if (safe.lastName !== undefined) profile.lastName = safe.lastName;
  if (safe.address !== undefined) profile.address = safe.address;
  if (safe.postalCode !== undefined) profile.postalCode = safe.postalCode;
  if (safe.city !== undefined) profile.city = safe.city;

  await writeProfile(profile, userId);
  return profile;
}
