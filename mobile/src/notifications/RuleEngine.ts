import { Task, Profile, WeatherSummary } from '../api/client';

type NowInput = Date;

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

function toStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDeadline(deadline: string): Date {
  return new Date(deadline);
}

function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isBeforeDate(a: Date, b: Date): boolean {
  return toStartOfDay(a).getTime() < toStartOfDay(b).getTime();
}

function isAfterDate(a: Date, b: Date): boolean {
  return toStartOfDay(a).getTime() > toStartOfDay(b).getTime();
}

function formatDateLongFr(date: Date): string {
  const day = date.getDate();
  const month = FRENCH_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getTasksDueToday(tasks: Task[], now: NowInput): Task[] {
  const today = toStartOfDay(now);
  return tasks.filter(task => {
    const d = parseDeadline(task.deadline);
    return isSameDate(d, today);
  });
}

export function getTasksDueTomorrow(tasks: Task[], now: NowInput): Task[] {
  const today = toStartOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tasks.filter(task => {
    const d = parseDeadline(task.deadline);
    return isSameDate(d, tomorrow);
  });
}

export function getOverdueTasks(tasks: Task[], now: NowInput): Task[] {
  const today = toStartOfDay(now);
  return tasks.filter(task => {
    const d = parseDeadline(task.deadline);
    return isBeforeDate(d, today);
  });
}

export function isUrgentTask(task: Task, now: NowInput): boolean {
  const today = toStartOfDay(now);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 2);
  const d = parseDeadline(task.deadline);
  const isFromEmailOrPhoto = task.source === 'email' || task.source === 'photo';
  return isFromEmailOrPhoto && (isBeforeDate(d, limit) || isSameDate(d, limit) || isSameDate(d, today));
}

export function hasSchoolAgeChild(profile: Profile): boolean {
  // If no explicit school-age info, any child qualifies.
  return (profile.children && profile.children.length > 0);
}

export type SimpleWeather = 'pluie' | 'nuageux' | 'ensoleillé' | 'neige' | 'brouillard';

export function mapWeatherToSimple(condition: WeatherSummary): SimpleWeather {
  if (condition.isSnowing) return 'neige';
  if (condition.isRaining) return 'pluie';
  // Use temperature/wind hints? Not specified; fall back to cloudy vs sunny by temp sign of outfit?
  // deterministic: if outfit contains 'nuage' => nuageux else ensoleillé.
  const outfit = (condition.outfit || '').toLowerCase();
  if (outfit.includes('nuage')) return 'nuageux';
  return 'ensoleillé';
}

export function isRainy(weather: WeatherSummary): boolean {
  return mapWeatherToSimple(weather) === 'pluie';
}

function containsShortAction(task: Task): boolean {
  const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
  const keywords = ['envoyer', 'répondre', 'repondre', 'appeler', 'prévenir', 'prevenir', 'confirmer', 'demander', 'relancer'];
  return keywords.some(k => haystack.includes(k));
}

function containsExclusion(task: Task): boolean {
  const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
  const blockers = ['impôts', 'impots', 'caf', 'dossier', 'inscription', 'renouvellement', 'déclaration', 'declaration', 'rendez-vous', 'rdv', 'validation'];
  return blockers.some(k => haystack.includes(k));
}

export interface SimpleTaskRuleResult {
  eligibleTasks: Task[];
}

export function getWeekendSimpleTasks(tasks: Task[], now: NowInput, pdfReadyTaskIds: Set<string>): SimpleTaskRuleResult {
  const today = toStartOfDay(now);
  const in48h = new Date(today);
  in48h.setDate(in48h.getDate() + 2);
  const afterJ3 = new Date(today);
  afterJ3.setDate(afterJ3.getDate() + 3);

  const eligible = tasks.filter(task => {
    const d = parseDeadline(task.deadline);
    // inclusions: no deadline today, not past, not within 48h, and either no deadline or deadline > J+3
    const hasDeadline = !isNaN(d.getTime());
    if (hasDeadline) {
      const isToday = isSameDate(d, today);
      const isPast = isBeforeDate(d, today);
      const within48h = !isAfterDate(d, in48h); // d <= in48h
      if (isToday || isPast || within48h) return false;
      if (!isAfterDate(d, afterJ3)) return false; // must be strictly > J+3
    }

    // One of the short actions OR PDF ready and not done OR not long/multi-step
    const isPdfReady = pdfReadyTaskIds.has(task.id) && task.status !== 'done';
    const shortAction = containsShortAction(task);
    const notLongMultiStep = !containsExclusion(task); // we model exclusion keywords also as long/multi-step blockers
    const hasAnyInclusion = isPdfReady || shortAction || notLongMultiStep;
    if (!hasAnyInclusion) return false;

    // Exclusions
    if (isUrgentTask(task, now)) return false;
    if (containsExclusion(task)) return false;

    return true;
  });

  // prioritization
  const prioritized = eligible.sort((a, b) => {
    const aPdf = pdfReadyTaskIds.has(a.id) && a.status !== 'done';
    const bPdf = pdfReadyTaskIds.has(b.id) && b.status !== 'done';
    if (aPdf !== bPdf) return aPdf ? -1 : 1;

    const aDeadline = parseDeadline(a.deadline);
    const bDeadline = parseDeadline(b.deadline);
    const aHasDeadline = !isNaN(aDeadline.getTime());
    const bHasDeadline = !isNaN(bDeadline.getTime());
    if (aHasDeadline !== bHasDeadline) return aHasDeadline ? 1 : -1; // tasks without deadline first

    // oldest createdAt first
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return aCreated - bCreated;
  }).slice(0, 3);

  return { eligibleTasks: prioritized };
}

export function formatDateFr(date: Date): string {
  return formatDateLongFr(date);
}

export function formatTemperatureInt(tempC: number): string {
  return `${Math.round(tempC)}°C`;
}



















