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
  // Deterministic, non-accusatory, administratively credible.
  return `Je conteste le montant indiqué et vous demande une vérification détaillée de cette facture.`;
}

function extractInvoiceRefFromText(text: string): string | null {
  const s = text || '';

  // ONLY match explicit invoice/facture patterns - avoid generic "ref" that could match SIRET, customer ref, etc.
  const patterns: RegExp[] = [
    // "Facture n° : CE25/3924" or "Facture numero 123"
    /facture\s*(?:n(?:°|o)?|num(?:[ée]ro)?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
    // "Facture m* : CE25/3924" (OCR noise tolerance)
    /facture\s*[^\S\r\n]*[^\w\r\n]{0,3}[\w*°º]{0,6}\s*[:\-]\s*([A-Z0-9][A-Z0-9\-_/]{2,})/i,
    // "Invoice no. ABC123" or "Invoice number: 456"
    /invoice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
    // "Réf. facture : XYZ" (only if "facture" is present nearby)
    /réf(?:érence)?\s*[:\.]?\s*(?:de\s+)?facture\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    const candidate = m?.[1]?.trim();
    // Require at least one digit to avoid grabbing random words.
    // Also reject pure numeric strings longer than 12 digits (likely SIRET/SIREN, not invoice refs)
    if (candidate && /\d/.test(candidate)) {
      const isAllDigits = /^\d+$/.test(candidate);
      if (isAllDigits && candidate.length > 12) {
        console.log('[INVOICE DEBUG] Rejected candidate (too long, likely SIRET):', candidate);
        continue; // Skip SIRET/SIREN-like numbers
      }
      return candidate;
    }
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
export async function getProfileVariables(): Promise<Record<string, string>> {
  const profile = await getProfile();
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
export async function getTaskVariables(taskId: string): Promise<Record<string, string>> {
  const task = await getTaskById(taskId);
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

  // Use task description as the direct motive/type content for whitelisted templates
  if (task.description && task.description.trim()) {
    const cleaned = normalizeReasonText(task.description);
    if (!variables.absenceReason) variables.absenceReason = cleaned;
    if (!variables.prestationType) variables.prestationType = cleaned;
    if (!variables.contestationReason) variables.contestationReason = cleaned;
    if (!variables.declarationContent) variables.declarationContent = cleaned;
  }

  // Deterministic defaults (no inference), to keep generated documents administratively credible.
  // Mutuelle: template already explicitly references a consultation; leave prestationType empty if unknown.
  if (!variables.prestationType) variables.prestationType = '';
  if (!variables.declarationContent) {
    variables.declarationContent = `Je déclare sur l'honneur que les informations ci-dessus sont exactes.`;
  }

  // Contestation de facture: if a PDF is present, it is authoritative for invoice number / amount / date.
  const invoiceContextText = `${task.title || ''}\n${task.description || ''}`;
  const fromTitle = extractInvoiceRefFromText(task.title || '');
  const fromDescription = extractInvoiceRefFromText(task.description || '');
  const fromTextAmount = extractEuroAmount(invoiceContextText);

  const attachmentFilename = task.imageUrl ? extractFilenameFromUrl(task.imageUrl) : null;
  const fromFilename = attachmentFilename ? extractInvoiceRefFromFilename(attachmentFilename) : null;

  let fromPdfRef: string | null = null;
  let fromPdfAmount: string | null = null;
  let fromPdfDate: string | null = null;

  if (task.imageUrl) {
    const extractedText = await fetchAndExtractPdfText(task.imageUrl);
    if (extractedText) {
      console.log('[PDF EXTRACTION DEBUG] Extracted text length:', extractedText.length);
      console.log('[PDF EXTRACTION DEBUG] First 500 chars:', extractedText.substring(0, 500));
      fromPdfRef = extractInvoiceRefFromText(extractedText);
      fromPdfAmount = extractEuroAmount(extractedText);
      fromPdfDate = extractInvoiceDateFromText(extractedText);
      console.log('[PDF EXTRACTION DEBUG] fromPdfRef:', fromPdfRef);
      console.log('[PDF EXTRACTION DEBUG] fromPdfAmount:', fromPdfAmount);
      console.log('[PDF EXTRACTION DEBUG] fromPdfDate:', fromPdfDate);
    } else {
      console.log('[PDF EXTRACTION DEBUG] No text extracted from PDF');
    }
  }

  // Priority: PDF (if present) → then other sources
  // BUT: sanity check for corrupted PDF extraction
  let invoiceRef = fromPdfRef || fromTitle || fromDescription || fromFilename;
  let invoiceAmount = fromPdfAmount || fromTextAmount;
  
  // Sanity check: if PDF amount and text amount both exist but differ significantly,
  // the PDF extraction may be corrupted - prefer the task text (from AI)
  if (fromPdfAmount && fromTextAmount) {
    const pdfNum = parseFloat(fromPdfAmount);
    const textNum = parseFloat(fromTextAmount);
    const diff = Math.abs(pdfNum - textNum);
    const percentDiff = diff / Math.max(pdfNum, textNum);
    
    // If amounts differ by >20%, PDF extraction is likely corrupted
    if (percentDiff > 0.20) {
      console.log('[INVOICE DEBUG] PDF amount differs significantly from task text - using task text');
      console.log('[INVOICE DEBUG] PDF:', pdfNum, 'vs Text:', textNum, '(diff:', (percentDiff * 100).toFixed(1), '%)');
      invoiceAmount = fromTextAmount;
    }
  }
  
  console.log('[INVOICE DEBUG] Final invoiceRef:', invoiceRef, '(PDF:', fromPdfRef, 'Title:', fromTitle, 'Desc:', fromDescription, 'File:', fromFilename, ')');
  console.log('[INVOICE DEBUG] Final invoiceAmount:', invoiceAmount, '(PDF:', fromPdfAmount, 'Text:', fromTextAmount, ')');
  
  if (invoiceRef && !variables.invoiceRef) variables.invoiceRef = invoiceRef;
  if (invoiceAmount && !variables.invoiceAmount) variables.invoiceAmount = invoiceAmount;
  if (fromPdfDate && !variables.invoiceDate) variables.invoiceDate = fromPdfDate;

  const currentContestation = (variables.contestationReason || '').trim();
  if (!currentContestation) variables.contestationReason = defaultContestationReason();
  
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
  const profileVars = await getProfileVariables();
  const taskVars = input.taskId ? await getTaskVariables(input.taskId) : {};
  const mergedVars: Record<string, string> = { ...profileVars, ...taskVars, ...input.variables };

  // Milestone 5: For absence justificatifs, ensure we use the correct child.
  // Rules (deterministic; NO guessing):
  // 1. Extract child name directly from task text (patterns like "Absence école Héloïse")
  // 2. If no explicit name in text but profile has children, use profile-based selection
  // 3. Otherwise leave blank (better blank than wrong child)
  if (input.taskId && (template.id === 'ecole_absence' || template.id === 'creche_absence')) {
    const task = await getTaskById(input.taskId);
    if (task) {
      const taskText = `${task.title || ''}\n${task.description || ''}`;
      const explicitName = extractExplicitChildNameFromAbsenceTaskText(taskText);

      // Highest priority: if the task explicitly names the child, use that name directly.
      // No profile lookup required - we trust the task text.
      if (explicitName) {
        mergedVars.childName = explicitName;
        mergedVars.patientName = explicitName;

        // Try to get birthDate from profile if child exists there
        const profile = await getProfile();
        const byName = profile.children.find((c) => (c.firstName || '').trim().toLowerCase() === explicitName.toLowerCase());
        if (byName) {
          mergedVars.childBirthDate = formatDateFrench(byName.birthDate);
        } else {
          delete (mergedVars as any).childBirthDate;
        }
      } else {
        // No explicit name in task text - fall back to profile-based selection
        const profile = await getProfile();
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
    console.log(`[PDF] Uploaded to Supabase: ${pdfUrl}`);
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
  userVariables?: Record<string, string>
): Promise<{ content: string; missingVariables: string[] }> {
  const template = getTemplateById(templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Merge variables
  const profileVars = await getProfileVariables();
  const taskVars = taskId ? await getTaskVariables(taskId) : {};
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
