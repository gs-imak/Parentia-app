/**
 * PDF Generator for Milestone 5
 * Uses pdfkit to generate PDF documents from templates
 */

import PDFDocument from 'pdfkit';
import { getTemplateById, type PDFTemplate } from './pdfTemplates.js';
import { uploadAttachment } from './supabase.js';
import { getProfile, type Child } from './profile.js';
import { getTaskById } from './tasks.js';
import { extractPdfText } from './pdfParser.js';

export interface GeneratePDFInput {
  templateId: string;
  taskId?: string;
  variables: Record<string, string>;
  userId?: string | null;
}

export interface GeneratePDFOutput {
  pdfUrl: string | null;
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDateFrench(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    return `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Return as-is if invalid
    }
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Replace template variables with actual values
 */
function fillTemplate(template: string, variables: Record<string, string>): string {
  let filled = template;
  
  for (const [key, value] of Object.entries(variables)) {
    // Replace all occurrences of {{key}} with value
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    filled = filled.replace(regex, value || '');
  }
  
  // Normalize common typography issues after substitution (keeps PDFs readable)
  filled = normalizeFilledPdfText(filled);

  // Clean up any remaining unfilled variables
  filled = filled.replace(/\{\{[^}]+\}\}/g, '____________');
  
  return filled;
}

function normalizeFilledPdfText(text: string): string {
  let s = text || '';

  // 1) Prevent "double dots" / "..." artifacts from user/task text.
  // Convert any run of 2+ dots into a single ellipsis character.
  s = s.replace(/\.{2,}/g, '…');

  // 2) Avoid wrapping the euro sign on its own line (keep amount + € together).
  // Replace "98.00 €" => "98.00 €" (NBSP).
  s = s.replace(/(\d(?:[\d.,\s]*\d)?)\s*€/g, (_m, amount) => `${String(amount).trim()}\u00A0€`);

  // 3) Avoid "€." being split weirdly by ensuring punctuation stays attached.
  s = s.replace(/\u00A0€\s+\./g, '\u00A0€.');

  return s;
}

function normalizeReasonText(text: string): string {
  let s = (text || '').trim();
  if (!s) return s;
  // Collapse trailing ellipsis/dots into a single period (the template already adds punctuation around it).
  s = s.replace(/[.…]+$/g, '');
  return s.trim();
}

function stripDiacriticsLower(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenizeLowerWords(s: string): string[] {
  const matches = (s || '').toLowerCase().match(/[a-zà-öø-ÿ]+/gi);
  return matches ? matches.map((w) => w.toLowerCase()) : [];
}

function selectChildFromTaskText(children: Child[], taskText: string): Child | null {
  if (!children || children.length === 0) return null;
  if (children.length === 1) return children[0];

  const tokens = new Set(tokenizeLowerWords(taskText));
  const matched = children.filter((c) => {
    const name = (c.firstName || '').trim().toLowerCase();
    return Boolean(name) && tokens.has(name);
  });

  // Deterministic: only select if exactly one child name is explicitly present.
  if (matched.length === 1) return matched[0];
  return null;
}

function extractExplicitChildNameFromAbsenceTaskText(taskText: string): string | null {
  const s = (taskText || '').trim();
  if (!s) return null;

  // Extract child name from patterns like:
  // - "Absence école Héloïse"
  // - "Absence crèche Charles"
  // - "Justificatif d'absence de Marie"
  // - "Absence Héloïse 15 décembre"
  // Case-insensitive, unicode-aware
  const patterns: RegExp[] = [
    // "Absence école/crèche <Name>"
    /absence\s+(?:école|ecole|crèche|creche)\s+([A-Za-zÀ-ÿ]+)/iu,
    // "Justificatif d'absence de <Name>"
    /justificatif\s+d['']?absence\s+de\s+([A-Za-zÀ-ÿ]+)/iu,
    // "Absence de <Name>"
    /absence\s+de\s+([A-Za-zÀ-ÿ]+)/iu,
    // "Absence <Name>" (fallback - name right after "absence" if it's capitalized)
    /absence\s+([A-ZÀ-Ý][a-zà-ÿ]+)/u,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    const candidate = m?.[1]?.trim();
    if (candidate && candidate.length >= 2) {
      // Normalize: capitalize first letter
      return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
    }
  }

  return null;
}

function defaultContestationReason(): string {
  // FINAL spec: default motive MUST be used verbatim when no explicit contestation keyword is detected.
  return `Je conteste cette facture dans l’attente de vérifications complémentaires concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;
}

function buildContestationReasonFromTaskText(taskText: string): string {
  const s = stripDiacriticsLower(taskText);
  const base =
    `Je conteste cette facture dans l’attente de vérifications complémentaires concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;

  const has = (needle: string) => s.includes(needle);

  // Deterministic: pick the first matching explicit keyword bucket (no stacking).
  if ((has('double') || has('doublon')) && (has('factur') || has('facture'))) {
    return `Je conteste cette facture pour un possible cas de double facturation, dans l’attente de vérifications complémentaires concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;
  }
  if (has('trop eleve') || has('trop elev') || has('montant incorrect') || (has('montant') && has('incorrect'))) {
    return `Je conteste cette facture car le montant indiqué semble trop élevé, dans l’attente de vérifications complémentaires concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;
  }
  if (has('erreur') || has('errone') || has('incorrect')) {
    return `Je conteste cette facture car elle semble comporter une erreur, dans l’attente de vérifications complémentaires concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;
  }
  if (has('fraude')) {
    return `Je conteste cette facture dans le cadre de vérifications complémentaires, notamment en raison d’un doute de conformité, concernant le détail des prestations facturées et leur conformité au contrat souscrit.`;
  }

  return base;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function tryParseFrenchExplicitDate(text: string): Date | null {
  const s = text || '';
  if (!s) return null;

  const numeric = [...s.matchAll(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g)];
  const monthName = [...s.matchAll(/\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)\s+(\d{4})\b/gi)];

  const candidates: Date[] = [];
  for (const m of numeric) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (year < 1900 || year > 2100) continue;
    if (month < 1 || month > 12) continue;
    if (day < 1 || day > 31) continue;
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (!isNaN(d.getTime())) candidates.push(d);
  }
  const monthMap: Record<string, number> = {
    janvier: 1,
    fevrier: 2,
    février: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    aout: 8,
    août: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    decembre: 12,
    décembre: 12,
  };
  for (const m of monthName) {
    const day = parseInt(m[1], 10);
    const monthWord = (m[2] || '').toLowerCase();
    const year = parseInt(m[3], 10);
    const month = monthMap[monthWord];
    if (!month) continue;
    if (year < 1900 || year > 2100) continue;
    if (day < 1 || day > 31) continue;
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (!isNaN(d.getTime())) candidates.push(d);
  }

  // Deterministic: only accept if exactly one explicit date is present.
  if (candidates.length !== 1) return null;
  return candidates[0];
}

function buildAbsenceMotiveSentence(args: {
  taskText: string;
  absenceDate: string;
  isFutureOrToday: boolean;
  variant: 'school' | 'creche';
}): string {
  const s = stripDiacriticsLower(args.taskText);
  const has = (needle: string) => s.includes(needle);
  const date = args.absenceDate;
  const isFuture = args.isFutureOrToday;

  const isMedical =
    has('rendez-vous medical') ||
    has('rdv medical') ||
    has('consultation') ||
    has('medecin') ||
    has('pediatre');

  const isFever =
    has('febr') ||
    has('fiev') ||
    has('temperature') ||
    has('etat febrile');

  // Deterministic: first matching motive bucket only.
  if (args.variant === 'creche' && isFever) {
    return isFuture
      ? `Cette absence est due à un état fébrile nécessitant que l’enfant reste à domicile le ${date}.`
      : `Cette absence était due à un état fébrile ayant nécessité que l’enfant reste à domicile le ${date}.`;
  }

  if (isMedical) {
    if (args.variant === 'school') {
      return isFuture
        ? `Son absence le ${date} sera due à un rendez-vous médical.`
        : `Son absence le ${date} était due à un rendez-vous médical.`;
    }
    return isFuture
      ? `Cette absence est due à un rendez-vous médical programmé le ${date}.`
      : `Cette absence était due à un rendez-vous médical programmé le ${date}.`;
  }

  // Default behavior when motive is not explicitly detected: leave a blank line to be filled (no invention).
  if (args.variant === 'school') {
    return isFuture
      ? `Son absence le ${date} sera due à __________.`
      : `Son absence le ${date} était due à __________.`;
  }
  return isFuture
    ? `Cette absence est due à __________ le ${date}.`
    : `Cette absence était due à __________ le ${date}.`;
}

function buildAttestationDeclarationContent(taskText: string): { content: string; hasFact: boolean } {
  const s = stripDiacriticsLower(taskText);
  const has = (needle: string) => s.includes(needle);

  // Deterministic "clear fact" (safe): domicile/adresse => we can point to the address fields (from profile) without inventing.
  if (has('domicile') || has('adresse')) {
    return {
      hasFact: true,
      content: `Je déclare sur l'honneur résider à l'adresse mentionnée ci-dessus.`,
    };
  }

  // No explicit, safely-usable fact detected -> generic.
  return {
    hasFact: false,
    content: `Je déclare sur l'honneur que les informations ci-dessus sont exactes.`,
  };
}

function extractInvoiceRefFromText(text: string): string | null {
  const s = text || '';

  // ONLY match explicit invoice/facture patterns - avoid generic "ref" that could match SIRET, customer ref, etc.
  const patterns: RegExp[] = [
    // "Facture n° : CE25/3924" or "Facture numero 123" or "n° de facture : 01B6060107 25H9-1J10"
    /(?:facture|invoice)\s*(?:n(?:°|o)?|num(?:[ée]ro)?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-_/]{3,})/i,
    // "n° de facture : 01B6060107"
    /n[°º]\s*(?:de\s*)?facture\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-_/]{3,})/i,
    // "Facture m* : CE25/3924" (OCR noise tolerance)
    /facture\s*[^\S\r\n]*[^\w\r\n]{0,3}[\w*°º]{0,6}\s*[:\-]\s*([A-Z0-9][A-Z0-9\s\-_/]{2,})/i,
    // "Invoice no. ABC123" or "Invoice number: 456"
    /invoice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-_/]{3,})/i,
    // "Réf. facture : XYZ" (only if "facture" is present nearby)
    /réf(?:érence)?\s*[:\.]?\s*(?:de\s+)?facture\s*[:\-]?\s*([A-Z0-9][A-Z0-9\s\-_/]{3,})/i,
    
    // === STANDALONE PATTERNS (for scrambled PDF text where label and number are separated) ===
    // Sosh/Orange format: "01B6060107 25H9- 1J10" (with possible whitespace/newlines between)
    // First part: 2 digits + letter + 5+ digits. Second part: 2 digits + letter + digit + separator + digit + letter + 2 digits
    /\b(\d{2}[A-Z]\d{5,})[\s\S]{0,50}\b(\d{2}[A-Z]\d[\-\s]+\d[A-Z]\d{2})\b/i,
    // Sosh/Orange format: just first part "01B6060107" if we can't find the second part
    /\b(\d{2}[A-Z]\d{6,})\b/i,
    // Selfbox format: "CE25/3924" or "FA2024-001"
    /\b([A-Z]{2}\d{2}[\/\-]\d{3,})\b/,
    // Generic: 2+ letters + 4+ digits (like "INV12345", "FAC2024001")
    /\b([A-Z]{2,4}\d{4,})\b/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    
    // Handle patterns with multiple capture groups (combine them)
    let candidate = '';
    if (m[2]) {
      // Pattern with 2 groups (e.g., Sosh format split across lines)
      candidate = `${m[1]} ${m[2]}`.trim();
    } else if (m[1]) {
      candidate = m[1].trim();
    } else {
      continue;
    }
    
    // Clean up: collapse multiple spaces, trim
    candidate = candidate.replace(/\s+/g, ' ').trim();
    
    // Require at least one digit to avoid grabbing random words
    if (!/\d/.test(candidate)) continue;
    
    // Reject pure numeric strings longer than 12 digits (likely SIRET/SIREN, not invoice refs)
    const isAllDigits = /^[\d\s]+$/.test(candidate);
    const digitsOnly = candidate.replace(/\D/g, '');
    if (isAllDigits && digitsOnly.length > 12) {
      continue;
    }
    
    // Truncate at first occurrence of date-like pattern (YYYY-MM-DD or similar)
    // e.g., "01B6060107 25H9-1J10 2025-10-28" → "01B6060107 25H9-1J10"
    const beforeDate = candidate.split(/\s+\d{4}[-\/]\d{2}[-\/]\d{2}/)[0];
    if (beforeDate && beforeDate !== candidate) {
      candidate = beforeDate.trim();
    }
    
    return candidate;
  }

  // NO fallback to generic long numbers - too risky (catches SIRET, account numbers, etc.)
  return null;
}

function extractEuroAmount(text: string): string | null {
  const s = text || '';
  
  // Find all potential amounts with € symbol
  // Priority order: TOTAL TTC > À RÉGLER/À PAYER > MONTANT > generic amount with €
  const patterns: RegExp[] = [
    // Highest priority: "TOTAL TTC : 98,00 €" or "Montant TTC"
    /(?:total|montant)\s+ttc\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{2})?)\s*€/i,
    // "À régler : 98 €" or "À payer"
    /à\s+(?:régler|payer)\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{2})?)\s*€/i,
    // "Montant : 98,00 €" or "Prix :"
    /(?:montant|prix)\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{2})?)\s*€/i,
    // Generic "Total :" (may be HT, so lower priority)
    /total\s*[:\-]?\s*(\d{1,6}(?:[.,]\d{2})?)\s*€/i,
    // Last resort: any amount with € that's not preceded by / (to avoid dates)
    /(?<![\/\d])(\d{1,6}(?:[.,]\d{2})?)\s*€/,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) {
      const amount = m[1].replace(',', '.');
      const num = parseFloat(amount);
      // Sanity check: reasonable invoice amount (not a year, not too small)
      if (num >= 0.01 && num < 1000000) {
        return amount;
      }
    }
  }
  
  return null;
}


/**
 * For scrambled PDFs where invoice number parts appear on separate lines,
 * find the parts independently and combine them.
 * 
 * Patterns recognized:
 * - Sosh/Orange: "01B606O107" + "25H9- 1J10" (alphanumeric format - note: may have letter O instead of 0)
 * - Generic: "XX12345678" style references
 */
function extractInvoiceRefFromScrambledText(text: string): string | null {
  const s = text || '';

  // Pattern for first part: 2 digits + 1 letter + 6-8 alphanumeric chars (e.g., "01B606O107" - note O not 0)
  const firstPartPattern = /\b(\d{2}[A-Z][A-Z0-9]{6,8})\b/gi;
  const firstParts = [...s.matchAll(firstPartPattern)].map(m => m[1]);

  // Pattern for second part: 2 digits + 1 letter + 1 digit + separator + 1 digit + 1 letter + 2 digits (e.g., "25H9- 1J10")
  const secondPartPattern = /\b(\d{2}[A-Z]\d[\-\s]+\d[A-Z]\d{2})\b/gi;
  const secondParts = [...s.matchAll(secondPartPattern)].map(m => m[1]);

  // If we found at least one of each, combine them (some PDFs repeat invoice info on multiple pages)
  if (firstParts.length >= 1 && secondParts.length >= 1) {
    const combined = `${firstParts[0]} ${secondParts[0]}`;
    return combined;
  }
  
  // If we only found the first part (which is still a valid reference), use it
  if (firstParts.length >= 1 && secondParts.length === 0) {
    return firstParts[0];
  }
  
  // Pattern for standalone alphanumeric invoice refs: 2+ letters + 2+ digits + optional suffix
  // e.g., "CE25/3924", "FA2024-001", "INV12345"
  const standalonePattern = /\b([A-Z]{2,4}\d{2,}[\/\-]?\d{2,})\b/gi;
  const standalones = [...s.matchAll(standalonePattern)].map(m => m[1]);
  
  // Filter out things that look like dates (e.g., "FI44990397" is fine, but avoid matching account numbers)
  const validStandalones = standalones.filter(ref => {
    // Reject if it's all digits after the letters (likely an account number)
    const digitsOnly = ref.replace(/[^0-9]/g, '');
    return digitsOnly.length <= 10; // Invoice numbers are typically shorter
  });
  
  if (validStandalones.length === 1) {
    return validStandalones[0];
  }
  
  return null;
}

function extractFilenameFromUrl(url: string): string | null {
  try {
    const withoutQuery = url.split('?')[0];
    const parts = withoutQuery.split('/');
    const last = parts[parts.length - 1];
    if (!last) return null;
    return decodeURIComponent(last);
  } catch {
    return null;
  }
}

/**
 * Extract invoice-like reference from filename
 * e.g., "facture_9078906805_2025-10-28.pdf" → "9078906805"
 */
function extractInvoiceRefFromFilename(filename: string): string | null {
  if (!filename) return null;
  
  // Pattern: "facture_XXXXXXXXXX_date.pdf" - extract the part between facture and date/extension
  const patterns = [
    // "facture_9078906805_2025" → "9078906805"
    /facture[_\s-]([A-Z0-9][A-Z0-9\-_/]{5,}?)(?:[_\s-]\d{4}|\.pdf|$)/i,
    // "invoice_ABC123_" → "ABC123"
    /invoice[_\s-]([A-Z0-9][A-Z0-9\-_/]{5,}?)(?:[_\s-]\d{4}|\.pdf|$)/i,
  ];
  
  for (const re of patterns) {
    const m = filename.match(re);
    if (m?.[1]) {
      const candidate = m[1].replace(/_/g, '').trim();
      if (candidate.length >= 6) {
        return candidate;
      }
    }
  }
  
  return null;
}

function extractInvoiceDateFromText(text: string): string | null {
  const s = text || '';
  
  // Common French date patterns: "15/12/2024", "15 décembre 2024", "15-12-2024"
  const patterns: RegExp[] = [
    /(?:date\s*(?:de\s*)?facture|factur[ée]e?\s*(?:le|du)?)\s*:?\s*(\d{1,2}[\s/-]\d{1,2}[\s/-]\d{2,4})/i,
    /(?:date\s*(?:de\s*)?facture|factur[ée]e?\s*(?:le|du)?)\s*:?\s*(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
  ];
  
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) return m[1];
  }
  
  return null;
}


async function fetchAndExtractPdfText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[PDF] Failed to fetch PDF: ${response.status}`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    return await extractPdfText(buffer);
  } catch (err) {
    console.warn('[PDF] Error fetching/extracting PDF:', err);
    return null;
  }
}

/**
 * Auto-fill variables from profile data
 */
export async function getProfileVariables(userId?: string | null): Promise<Record<string, string>> {
  const profile = await getProfile(userId);
  const variables: Record<string, string> = {};
  
  // Build full name from firstName + lastName
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  if (fullName) {
    variables.parentName = fullName;
    variables.declarantName = fullName;
    variables.customerName = fullName;
    variables.tenantName = fullName;
    variables.senderName = fullName;
    variables.hostName = fullName;
    variables.employeeName = fullName;
    variables.mandantName = fullName;
  }
  
  if (profile.address) {
    variables.parentAddress = profile.address;
    variables.declarantAddress = profile.address;
    variables.customerAddress = profile.address;
    variables.tenantAddress = profile.address;
    variables.senderAddress = profile.address;
    variables.hostAddress = profile.address;
    variables.mandantAddress = profile.address;
    variables.newAddress = profile.address;
  }
  
  if (profile.postalCode) {
    variables.parentPostalCode = profile.postalCode;
    variables.declarantPostalCode = profile.postalCode;
    variables.customerPostalCode = profile.postalCode;
    variables.tenantPostalCode = profile.postalCode;
    variables.senderPostalCode = profile.postalCode;
    variables.hostPostalCode = profile.postalCode;
    variables.mandantPostalCode = profile.postalCode;
    variables.newPostalCode = profile.postalCode;
  }
  
  if (profile.city) {
    variables.parentCity = profile.city;
    variables.declarantCity = profile.city;
    variables.customerCity = profile.city;
    variables.tenantCity = profile.city;
    variables.senderCity = profile.city;
    variables.hostCity = profile.city;
    variables.mandantCity = profile.city;
    variables.newCity = profile.city;
    variables.city = profile.city;
  }
  
  // Current date
  variables.date = formatDateFrench();
  
  // First child if available
  if (profile.children.length > 0) {
    const child = profile.children[0];
    variables.childName = child.firstName;
    variables.childBirthDate = formatDateFrench(child.birthDate);
    variables.patientName = child.firstName;
  }
  
  // Spouse if available
  if (profile.spouse) {
    if (!variables.parentName) {
      // Use spouse name if no lastName set
      variables.parentName = profile.spouse.firstName;
    }
  }
  
  return variables;
}

/**
 * Get variables from a task
 */
export async function getTaskVariables(taskId: string, userId?: string | null): Promise<Record<string, string>> {
  const task = await getTaskById(taskId, userId);
  if (!task) return {};
  
  const variables: Record<string, string> = {};
  
  // Contact info from task
  if (task.contactEmail) {
    variables.contactEmail = task.contactEmail;
  }
  if (task.contactPhone) {
    variables.contactPhone = task.contactPhone;
    variables.parentPhone = task.contactPhone;
  }
  if (task.contactName) {
    variables.contactName = task.contactName;
    variables.recipientName = task.contactName;
    variables.providerName = task.contactName;
    variables.schoolName = task.contactName;
    variables.crecheName = task.contactName;
    variables.doctorName = task.contactName;
  }
  
  // Task deadline as the date reference for the whitelisted documents
  if (task.deadline) {
    const deadlineFormatted = formatDateFrench(task.deadline);
    variables.absenceDate = deadlineFormatted;
    variables.prestationDate = deadlineFormatted;
    variables.sortieDate = deadlineFormatted;
    variables.startDate = deadlineFormatted;
    variables.effectiveDate = deadlineFormatted;
    variables.leaveDate = deadlineFormatted;
    variables.resiliationDate = deadlineFormatted;
  }

  // ============================================
  // FINAL spec: never reuse raw task description in generated documents.
  // We only extract explicit facts via deterministic keyword/date parsing.
  // ============================================

  const taskText = `${task.title || ''}\n${task.description || ''}`.trim();

  // ABSENCES (école/crèche): compute absence date and tense-based wording.
  {
    const explicit = tryParseFrenchExplicitDate(taskText);
    const deadline = task.deadline ? new Date(task.deadline) : null;
    const absenceDateObj = explicit || (deadline && !isNaN(deadline.getTime()) ? deadline : null);

    if (absenceDateObj) {
      variables.absenceDate = formatDateFrench(absenceDateObj.toISOString());
      const today = startOfLocalDay(new Date());
      const absenceDay = startOfLocalDay(absenceDateObj);
      const isFutureOrToday = absenceDay.getTime() >= today.getTime();
      variables.absenceVerb = isFutureOrToday ? 'sera absent(e)' : 'a été absent(e)';
      // Default to school wording; creche wording will still be usable (template-specific).
      // If the task text clearly mentions crèche/creche, use the crèche variant, else school.
      const variant: 'school' | 'creche' =
        stripDiacriticsLower(taskText).includes('creche') ? 'creche' : 'school';
      variables.absenceMotiveSentence = buildAbsenceMotiveSentence({
        taskText,
        absenceDate: variables.absenceDate,
        isFutureOrToday,
        variant,
      });
    }
  }

  // CONTESTATION DE FACTURE: motive must never be "payer la facture" nor raw description.
  variables.contestationReason = buildContestationReasonFromTaskText(taskText);

  // CONTESTATION DE FACTURE: invoice number/amount/date ONLY from the attached PDF when present.
  if (task.imageUrl) {
    const extractedText = await fetchAndExtractPdfText(task.imageUrl);
    if (extractedText) {
      const fromPdfRef = extractInvoiceRefFromText(extractedText) || extractInvoiceRefFromScrambledText(extractedText);
      const fromPdfAmount = extractEuroAmount(extractedText);
      const fromPdfDate = extractInvoiceDateFromText(extractedText);
      if (fromPdfRef && !variables.invoiceRef) variables.invoiceRef = fromPdfRef;
      if (fromPdfAmount && !variables.invoiceAmount) variables.invoiceAmount = fromPdfAmount;
      if (fromPdfDate && !variables.invoiceDate) variables.invoiceDate = fromPdfDate;
    }
  }

  // ATTESTATION SUR L'HONNEUR: handled separately in FINAL pass (requires provided generic template text).
  
  return variables;
}

/**
 * Generate PDF document from template
 */
export async function generatePDF(input: GeneratePDFInput): Promise<GeneratePDFOutput> {
  const template = getTemplateById(input.templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${input.templateId}`);
  }
  
  // Merge variables: profile defaults < task variables < user overrides
  const profileVars = await getProfileVariables(input.userId);
  const taskVars = input.taskId ? await getTaskVariables(input.taskId, input.userId) : {};
  const mergedVars: Record<string, string> = { ...profileVars, ...taskVars, ...input.variables };

  // FINAL spec: Attestation sur l'honneur
  // - If clear fact exists in title/description -> use deterministic reformulation
  // - Else -> generic declaration
  // - Always add a note that it can be refined by editing the task
  if (input.taskId && template.id === 'attestation_honneur') {
    const task = await getTaskById(input.taskId, input.userId);
    const taskText = task ? `${task.title || ''}\n${task.description || ''}` : '';
    const { content, hasFact } = buildAttestationDeclarationContent(taskText);
    const refinementNote = `\n\nNote : ce document peut être précisé en modifiant la tâche.`;
    mergedVars.declarationContent = hasFact ? `${content}${refinementNote}` : `${content}${refinementNote}`;
  }

  // Milestone 5: For absence justificatifs, ensure we use the correct child.
  // Rules (deterministic; NO guessing):
  // 1. Extract child name directly from task text (patterns like "Absence école Héloïse")
  // 2. If no explicit name in text but profile has children, use profile-based selection
  // 3. Otherwise leave blank (better blank than wrong child)
  if (input.taskId && (template.id === 'ecole_absence' || template.id === 'creche_absence')) {
    const task = await getTaskById(input.taskId, input.userId);
    if (task) {
      const taskText = `${task.title || ''}\n${task.description || ''}`;

      // FINAL spec: use the actual absence date everywhere (subject + body) and apply tense rule.
      // Deterministic: prefer a single explicit date in text (with year). Otherwise use task deadline.
      const explicitAbsenceDate = tryParseFrenchExplicitDate(taskText);
      const deadlineDate = task.deadline ? new Date(task.deadline) : null;
      const absenceDateObj =
        explicitAbsenceDate ||
        (deadlineDate && !isNaN(deadlineDate.getTime()) ? deadlineDate : null);
      if (absenceDateObj) {
        const absenceDateStr = formatDateFrench(absenceDateObj.toISOString());
        mergedVars.absenceDate = absenceDateStr;
        const today = startOfLocalDay(new Date());
        const absenceDay = startOfLocalDay(absenceDateObj);
        const isFutureOrToday = absenceDay.getTime() >= today.getTime();
        mergedVars.absenceVerb = isFutureOrToday ? 'sera absent(e)' : 'a été absent(e)';
        mergedVars.absenceMotiveSentence = buildAbsenceMotiveSentence({
          taskText,
          absenceDate: absenceDateStr,
          isFutureOrToday,
          variant: template.id === 'creche_absence' ? 'creche' : 'school',
        });
      }

      const explicitName = extractExplicitChildNameFromAbsenceTaskText(taskText);

      // Highest priority: if the task explicitly names the child, use that name directly.
      // No profile lookup required - we trust the task text.
      if (explicitName) {
        mergedVars.childName = explicitName;
        mergedVars.patientName = explicitName;

        // Try to get birthDate from profile if child exists there
        const profile = await getProfile(input.userId);
        const byName = profile.children.find((c) => (c.firstName || '').trim().toLowerCase() === explicitName.toLowerCase());
        if (byName) {
          mergedVars.childBirthDate = formatDateFrench(byName.birthDate);
        } else {
          delete (mergedVars as any).childBirthDate;
        }
      } else {
        // No explicit name in task text - fall back to profile-based selection
        const profile = await getProfile(input.userId);
        if (profile.children.length > 0) {
          const selected = selectChildFromTaskText(profile.children, taskText);
          if (selected) {
            mergedVars.childName = selected.firstName;
            mergedVars.childBirthDate = formatDateFrench(selected.birthDate);
            mergedVars.patientName = selected.firstName;
          } else if (profile.children.length > 1) {
            // Multiple children but can't determine which one - leave blank
            delete (mergedVars as any).childName;
            delete (mergedVars as any).childBirthDate;
            delete (mergedVars as any).patientName;
          }
          // If exactly 1 child, profile defaults already set correctly
        }
      }
    }
  }
  
  // Fill template
  const content = fillTemplate(template.template, mergedVars);
  
  // Generate PDF
  const pdfBuffer = await createPDFFromText(content, template);
  
  // Generate filename
  const timestamp = Date.now();
  const sanitizedLabel = template.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const filename = `${sanitizedLabel}_${timestamp}.pdf`;
  
  // Upload to Supabase
  let pdfUrl: string | null = null;
  try {
    pdfUrl = await uploadAttachment(pdfBuffer, filename, 'application/pdf');
  } catch (error) {
    console.error('[PDF] Failed to upload to Supabase:', error);
    // Continue without URL - we still have the buffer
  }
  
  return {
    pdfUrl,
    pdfBuffer,
    filename,
  };
}

/**
 * Create PDF from text content using pdfkit
 */
async function createPDFFromText(content: string, template: PDFTemplate): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 70,
          bottom: 70,
          left: 75,
          right: 75,
        },
      });
      
      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      doc.on('error', (error: Error) => {
        reject(error);
      });
      
      // Set font (use built-in Helvetica for French characters support)
      doc.font('Helvetica');
      
      // Add title
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(template.label, { align: 'center' });
      doc.moveDown(3);
      
      // Add content
      doc.fontSize(11).font('Helvetica');
      
      // Split content by lines and render
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') {
          doc.moveDown(1.2);
        } else if (line.startsWith('Objet :') || line.startsWith('ATTESTATION') || line.startsWith('PROCURATION') || line.startsWith('AUTORISATION')) {
          // Make subject lines bold with extra spacing
          doc.font('Helvetica-Bold').text(line, { lineGap: 8 });
          doc.moveDown(1);
          doc.font('Helvetica');
        } else if (line.includes('____________')) {
          // Lines with fillable fields get extra spacing for readability
          doc.text(line, { lineGap: 10 });
          doc.moveDown(0.8);
        } else {
          doc.text(line, { lineGap: 6 });
          doc.moveDown(0.5);
        }
      }
      
      // Finalize
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get preview of filled template (text only, no PDF generation)
 */
export async function previewFilledTemplate(
  templateId: string,
  taskId?: string,
  userVariables?: Record<string, string>,
  userId?: string | null
): Promise<{ content: string; missingVariables: string[] }> {
  const template = getTemplateById(templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Merge variables
  const profileVars = await getProfileVariables(userId);
  const taskVars = taskId ? await getTaskVariables(taskId, userId) : {};
  const mergedVars = { ...profileVars, ...taskVars, ...(userVariables || {}) };
  
  // Find missing variables
  const missingVariables: string[] = [];
  for (const varName of template.variables) {
    if (!mergedVars[varName] || mergedVars[varName].trim() === '') {
      missingVariables.push(varName);
    }
  }
  
  // Fill template
  const content = fillTemplate(template.template, mergedVars);
  
  return {
    content,
    missingVariables,
  };
}
