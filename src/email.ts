import { createTask, type Task } from './tasks.js';
import { createInboxEntry, isDuplicateEmail, type InboxEntry } from './inbox.js';
import { createNotification } from './notifications.js';
import { extractPdfText, isPdf } from './pdfParser.js';
import { uploadAttachment, isSupabaseConfigured } from './supabase.js';
import { 
  analyzeEmailWithRetry, 
  createFallbackOutput, 
  type EmailAIInput 
} from './emailAI.js';

/**
 * Structure of an incoming email (from IMAP or other sources)
 */
export interface IncomingEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  receivedAt: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Result of processing an email
 */
export interface ProcessResult {
  success: boolean;
  inboxEntry?: InboxEntry;
  task?: Task;
  error?: string;
}

/**
 * Validate that an incoming email has minimum required fields
 */
export function validateIncomingEmail(
  email: IncomingEmail
): { valid: boolean; error?: string } {
  if (!email.from || !email.from.includes('@')) {
    return { valid: false, error: 'Adresse expéditeur invalide' };
  }
  
  if (!email.subject && !email.text && !email.html) {
    return { valid: false, error: 'Email sans contenu exploitable' };
  }
  
  return { valid: true };
}

/**
 * Main function: Process an incoming email through the full pipeline
 * Email → PDF extraction → AI analysis → Task creation → Notification
 */
export async function processIncomingEmail(
  email: IncomingEmail
): Promise<ProcessResult> {
  console.log(`Processing email from ${email.from}: ${email.subject}`);
  
  // Step 1: Validate email
  const validation = validateIncomingEmail(email);
  if (!validation.valid) {
    console.error('Email validation failed:', validation.error);
    const entry = await createInboxEntry({
      from: email.from || 'unknown',
      subject: email.subject || 'Sans sujet',
      receivedAt: email.receivedAt,
      status: 'error',
      errorMessage: validation.error,
    });
    return { success: false, inboxEntry: entry, error: validation.error };
  }
  
  // Step 2: Check for duplicate
  const isDuplicate = await isDuplicateEmail(
    email.from,
    email.subject,
    email.receivedAt
  );
  if (isDuplicate) {
    console.log('Duplicate email detected, skipping');
    return { success: false, error: 'Email déjà traité' };
  }
  
  // Step 3: Extract PDF text and upload attachment (if any)
  let pdfText: string | null = null;
  let attachmentUrl: string | null = null;
  
  console.log(`Email has ${email.attachments.length} attachment(s)`);
  if (email.attachments.length > 0) {
    email.attachments.forEach((att, i) => {
      console.log(`  Attachment ${i + 1}: ${att.filename} (${att.contentType}, ${att.content.length} bytes)`);
    });
    
    // Find first PDF attachment
    const pdfAttachment = email.attachments.find((a) =>
      isPdf(a.contentType, a.filename)
    );
    
    if (pdfAttachment) {
      console.log(`Processing PDF attachment: ${pdfAttachment.filename}`);
      
      // Extract text
      pdfText = await extractPdfText(pdfAttachment.content);
      if (pdfText) {
        console.log(`Extracted ${pdfText.length} chars from PDF`);
      } else {
        console.log(`PDF text extraction returned null`);
      }
      
      // Upload to Supabase (non-blocking - failure doesn't stop processing)
      if (isSupabaseConfigured()) {
        console.log(`Uploading PDF to Supabase...`);
        try {
          attachmentUrl = await uploadAttachment(
            pdfAttachment.content,
            pdfAttachment.filename,
            pdfAttachment.contentType
          );
          if (attachmentUrl) {
            console.log(`Attachment uploaded: ${attachmentUrl}`);
          } else {
            console.log(`Upload returned null (check Supabase logs)`);
          }
        } catch (uploadErr) {
          console.error(`Upload error:`, uploadErr);
        }
      } else {
        console.log(`Supabase not configured, skipping upload`);
      }
    } else {
      console.log(`No PDF found in attachments (checked contentType and filename)`);
    }
  }
  
  // Step 4: Prepare AI input
  const aiInput: EmailAIInput = {
    subject: email.subject || 'Sans sujet',
    body: email.text || email.html || '',
    sender: email.from,
    receivedAt: email.receivedAt,
    pdfText: pdfText || undefined,
  };
  
  // Step 5: AI Analysis (with retry)
  console.log('Analyzing email with AI...');
  let aiOutput = await analyzeEmailWithRetry(aiInput);
  
  // Step 6: Use fallback if AI fails
  if (!aiOutput) {
    console.warn('AI analysis failed, using fallback');
    aiOutput = createFallbackOutput(aiInput);
  } else {
    console.log(`AI analysis complete: ${aiOutput.title} (${aiOutput.category})`);
  }
  
  // Step 7: Create task
  let task: Task;
  try {
    task = await createTask({
      title: aiOutput.title,
      category: aiOutput.category,
      deadline: aiOutput.deadline,
      description: aiOutput.description,
    });
    console.log(`Task created: ${task.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Task creation failed:', message);
    
    const entry = await createInboxEntry({
      from: email.from,
      subject: email.subject || 'Sans sujet',
      receivedAt: email.receivedAt,
      status: 'error',
      errorMessage: 'Échec de création de tâche',
      attachmentUrl: attachmentUrl || undefined,
    });
    
    return { success: false, inboxEntry: entry, error: 'Task creation failed' };
  }
  
  // Step 8: Create inbox entry (success)
  const inboxEntry = await createInboxEntry({
    from: email.from,
    subject: email.subject || 'Sans sujet',
    receivedAt: email.receivedAt,
    status: 'success',
    taskId: task.id,
    taskTitle: task.title,
    attachmentUrl: attachmentUrl || undefined,
  });
  
  // Step 9: Create notification (non-blocking)
  try {
    await createNotification({
      type: 'email_task_created',
      message: `Nouvelle tâche ajoutée depuis un email : ${task.title}`,
      metadata: { taskId: task.id, inboxId: inboxEntry.id },
    });
  } catch (error) {
    console.error('Notification creation failed:', error);
    // Non-blocking: task and inbox entry already created
  }
  
  console.log(`Email processed successfully: ${inboxEntry.id}`);
  return { success: true, inboxEntry, task };
}

/**
 * Extract user ID from the "to" address
 * Format: user+{userId}@domain.com
 */
export function extractUserIdFromAddress(to: string): string | null {
  const match = to.match(/user\+([^@]+)@/i);
  return match ? match[1] : null;
}
