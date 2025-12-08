/**
 * PDF Generator for Milestone 5
 * Uses pdfkit to generate PDF documents from templates
 */

import PDFDocument from 'pdfkit';
import { getTemplateById, type PDFTemplate } from './pdfTemplates.js';
import { uploadAttachment } from './supabase.js';
import { getProfile } from './profile.js';
import { getTaskById } from './tasks.js';

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
  
  // Clean up any remaining unfilled variables
  filled = filled.replace(/\{\{[^}]+\}\}/g, '____________');
  
  return filled;
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
  
  // Task deadline as a potential date
  if (task.deadline) {
    variables.absenceDate = formatDateFrench(task.deadline);
    variables.sortieDate = formatDateFrench(task.deadline);
    variables.startDate = formatDateFrench(task.deadline);
    variables.effectiveDate = formatDateFrench(task.deadline);
    variables.leaveDate = formatDateFrench(task.deadline);
    variables.resiliationDate = formatDateFrench(task.deadline);
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
          top: 50,
          bottom: 50,
          left: 60,
          right: 60,
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
      doc.moveDown(2);
      
      // Add content
      doc.fontSize(11).font('Helvetica');
      
      // Split content by lines and render
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.5);
        } else if (line.startsWith('Objet :') || line.startsWith('ATTESTATION') || line.startsWith('PROCURATION') || line.startsWith('AUTORISATION')) {
          // Make subject lines bold
          doc.font('Helvetica-Bold').text(line);
          doc.font('Helvetica');
        } else {
          doc.text(line);
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
