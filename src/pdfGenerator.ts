/**
 * PDF Generator for Milestone 5
 * Uses pdfkit to generate PDF documents from templates
 */

import PDFDocument from 'pdfkit';
import { getTemplateById, type PDFTemplate } from './pdfTemplates.js';
import { uploadAttachment } from './supabase.js';
import { getProfile } from './profile.js';
import { getTaskById } from './tasks.js';
import { extractPdfText, isPdf } from './pdfParser.js';
import { ocrTextFromUrl } from './ocr.js';

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

function extractInvoiceRefFromText(text: string): string | null {
  const s = text || '';

  // Common explicit patterns
  const patterns: RegExp[] = [
    /facture\s*(?:n(?:°|o)?|num(?:[ée]ro)?|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
    // Some PDFs/extraction replace "n°" with garbage like "m*" or other short tokens.
    // Accept up to ~6 non-separator chars between "facture" and ":"/"-".
    /facture\s*[^\S\r\n]*[^\w\r\n]{0,3}[\w*°º]{0,6}\s*[:\-]\s*([A-Z0-9][A-Z0-9\-_/]{2,})/i,
    /invoice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
    /\b(?:ref|réf(?:érence)?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})/i,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    const candidate = m?.[1]?.trim();
    // Require at least one digit to avoid grabbing random words.
    if (candidate && /\d/.test(candidate)) return candidate;
  }

  // Fallback: a long-ish numeric token often used as invoice number
  const numeric = s.match(/\b(\d{6,})\b/);
  if (numeric?.[1]) return numeric[1];

  return null;
}

function extractEuroAmount(text: string): string | null {
  const s = text || '';
  const m = s.match(/(\d{1,6}(?:[.,]\d{2})?)\s*€?/);
  if (!m?.[1]) return null;
  return m[1].replace(',', '.');
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

const FRENCH_MONTHS: Record<string, number> = {
  'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12,
};

/**
 * Extract a date from French text (e.g., "15 décembre", "le 15/12", "rendez-vous le 15")
 * Returns formatted DD/MM/YYYY string or null
 */
function extractFrenchDateFromText(text: string): string | null {
  const s = (text || '').toLowerCase();
  
  // Pattern 1: "15 décembre 2024" or "15 décembre"
  const monthPattern = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)(?:\s+(\d{4}))?/i;
  const monthMatch = s.match(monthPattern);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const month = FRENCH_MONTHS[monthMatch[2].toLowerCase()];
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
    if (day >= 1 && day <= 31 && month) {
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }
  }
  
  // Pattern 2: "le 15/12" or "15/12/2024"
  const slashPattern = /(?:le\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
  const slashMatch = s.match(slashPattern);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10);
    let year = slashMatch[3] ? parseInt(slashMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000; // Handle 2-digit years
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }
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
    variables.doctorName = task.contactName;
  }
  
  // Try to extract specific date from description/title (e.g., "rendez-vous le 15 décembre")
  const contextText = `${task.title || ''} ${task.description || ''}`;
  const extractedDate = extractFrenchDateFromText(contextText);
  
  // Task deadline as a potential date (fallback)
  if (task.deadline) {
    const deadlineFormatted = formatDateFrench(task.deadline);
    // Use extracted date if available, otherwise fallback to deadline
    variables.absenceDate = extractedDate || deadlineFormatted;
    variables.prestationDate = extractedDate || deadlineFormatted;
    variables.sortieDate = extractedDate || deadlineFormatted;
    variables.startDate = extractedDate || deadlineFormatted;
    variables.effectiveDate = extractedDate || deadlineFormatted;
    variables.leaveDate = deadlineFormatted;
    variables.resiliationDate = deadlineFormatted;
  } else if (extractedDate) {
    // No deadline but extracted a date from text
    variables.absenceDate = extractedDate;
    variables.prestationDate = extractedDate;
    variables.sortieDate = extractedDate;
    variables.startDate = extractedDate;
    variables.effectiveDate = extractedDate;
  }

  // Use task description as best-effort prefill for common "reason/type" fields
  if (task.description && task.description.trim()) {
    const cleaned = normalizeReasonText(task.description);
    if (!variables.absenceReason) variables.absenceReason = cleaned;
    if (!variables.contestationReason) variables.contestationReason = cleaned;
    if (!variables.consultationType) variables.consultationType = cleaned;
    if (!variables.certificateReason) variables.certificateReason = cleaned;
  }

  // Invoice heuristics (best-effort) for contestation templates
  const invoiceContextText = `${task.title || ''}\n${task.description || ''}`;
  const looksLikeInvoiceTask = /facture|invoice|selfbox|r[ée]f/i.test(invoiceContextText);
  if (looksLikeInvoiceTask) {
    const fromTitle = extractInvoiceRefFromText(task.title || '');
    const fromDescription = extractInvoiceRefFromText(task.description || '');

    const attachmentFilename = task.imageUrl ? extractFilenameFromUrl(task.imageUrl) : null;
    const fromFilename = attachmentFilename ? extractInvoiceRefFromText(attachmentFilename) : null;

    // Try to extract from attached PDF content (best-effort)
    let fromPdfContent: string | null = null;
    let amountFromPdf: string | null = null;
    let dateFromPdf: string | null = null;
    
    // Always try to extract from the attachment URL when present.
    // Relying on filename extension is fragile (signed URLs / missing .pdf suffix).
    if (task.imageUrl) {
      try {
        const pdfText = await fetchAndExtractPdfText(task.imageUrl);
        if (pdfText) {
          fromPdfContent = extractInvoiceRefFromText(pdfText);
          amountFromPdf = extractEuroAmount(pdfText);
          dateFromPdf = extractInvoiceDateFromText(pdfText);
        } else {
          // Scanned PDF: try OCR fallback if configured.
          const ocrText = await ocrTextFromUrl(task.imageUrl);
          if (ocrText) {
            console.log('[PDF] OCR fallback used for invoice extraction');
            fromPdfContent = extractInvoiceRefFromText(ocrText);
            amountFromPdf = extractEuroAmount(ocrText);
            dateFromPdf = extractInvoiceDateFromText(ocrText);
          }
        }
      } catch (err) {
        console.warn('[PDF] Failed to extract text from attached PDF:', err);
      }
    }

    const invoiceRef = fromTitle || fromDescription || fromFilename || fromPdfContent;
    if (invoiceRef && !variables.invoiceRef) {
      variables.invoiceRef = invoiceRef;
    }

    const amount = extractEuroAmount(invoiceContextText) || amountFromPdf;
    if (amount && !variables.invoiceAmount) {
      variables.invoiceAmount = amount;
    }

    if (dateFromPdf && !variables.invoiceDate) {
      variables.invoiceDate = dateFromPdf;
    }
  }
  
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
  const mergedVars = { ...profileVars, ...taskVars, ...input.variables };
  
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
