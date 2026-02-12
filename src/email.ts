import { createTask, type Task } from './tasks.js';
import { createInboxEntry, isDuplicateEmail, type InboxEntry } from './inbox.js';
import { createNotification } from './notifications.js';
import { sendTaskCreatedPushNotificationForUser } from './pushNotifications.js';
import { extractPdfText, isPdf } from './pdfParser.js';
import { uploadAttachment, isSupabaseConfigured } from './supabase.js';
import crypto from 'node:crypto';
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
  messageId?: string;
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
  email: IncomingEmail,
  userId?: string | null
): Promise<ProcessResult> {
  // Sanitize email for logging (hide local part)
  const sanitizedFrom = email.from?.replace(/^[^@]+@/, '***@') || 'unknown';
  console.log(`Processing email from ${sanitizedFrom}`);
  
  // Step 1: Validate email
  const validation = validateIncomingEmail(email);
  if (!validation.valid) {
    console.error('Email validation failed:', validation.error);
    const dedupeKey = (() => {
      const mid = (email.messageId || '').trim();
      if (mid) return `msgid:${mid.toLowerCase()}`;
      const base = [email.from || '', email.to || '', email.subject || '', email.text || ''].join('|');
      return `sha256:${crypto.createHash('sha256').update(base).digest('hex')}`;
    })();
    const entry = await createInboxEntry({
      from: email.from || 'unknown',
      subject: email.subject || 'Sans sujet',
      receivedAt: email.receivedAt,
      status: 'error',
      errorMessage: validation.error,
      dedupeKey,
    }, userId);
    return { success: false, inboxEntry: entry, error: validation.error };
  }
  
  // Step 2: Check for duplicate
  const dedupeKey = (() => {
    const mid = (email.messageId || '').trim();
    if (mid) return `msgid:${mid.toLowerCase()}`;
    const base = [email.from || '', email.to || '', email.subject || '', email.text || ''].join('|');
    return `sha256:${crypto.createHash('sha256').update(base).digest('hex')}`;
  })();
  const isDuplicate = await isDuplicateEmail(
    email.from,
    email.subject,
    email.receivedAt,
    dedupeKey,
    userId
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
      console.log(`  Attachment ${i + 1}: ${att.contentType}, ${att.content.length} bytes`);
    });
    
    // Find first PDF attachment for text extraction
    const pdfAttachment = email.attachments.find((a) =>
      isPdf(a.contentType, a.filename)
    );
    
    if (pdfAttachment) {
      console.log(`Processing PDF attachment (${pdfAttachment.content.length} bytes)`);
      
      // Extract text
      pdfText = await extractPdfText(pdfAttachment.content);
      if (pdfText) {
        console.log(`Extracted ${pdfText.length} chars from PDF`);
      } else {
        console.log(`PDF text extraction returned null`);
      }
      
      // Upload PDF to Supabase
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
      // No PDF found - try to upload first supported attachment (image, document, etc.)
      const supportedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.', 'text/'];
      const firstAttachment = email.attachments.find((a) =>
        supportedTypes.some(type => a.contentType.startsWith(type))
      );
      
      if (firstAttachment && isSupabaseConfigured()) {
        console.log(`Uploading non-PDF attachment: ${firstAttachment.contentType}, ${firstAttachment.content.length} bytes`);
        try {
          attachmentUrl = await uploadAttachment(
            firstAttachment.content,
            firstAttachment.filename,
            firstAttachment.contentType
          );
          if (attachmentUrl) {
            console.log(`Attachment uploaded: ${attachmentUrl}`);
          }
        } catch (uploadErr) {
          console.error(`Upload error:`, uploadErr);
        }
      } else {
        console.log(`No supported attachment found in email`);
      }
    }
  }
  
  // Step 4: Prepare AI input
  // If a PDF was attached but text extraction failed, still notify the AI
  const hasPdfAttachment = email.attachments.some((a) => isPdf(a.contentType, a.filename));
  let pdfTextForAI = pdfText || undefined;
  if (hasPdfAttachment && !pdfText) {
    // PDF exists but couldn't be read (probably scanned/image-based)
    console.log('PDF attachment exists but text extraction failed - notifying AI');
    pdfTextForAI = '[PDF JOINT: Impossible d\'extraire le texte - document probablement scanné/image. Veuillez créer une tâche de vérification manuelle pour ce document.]';
  }
  
  const aiInput: EmailAIInput = {
    subject: email.subject || 'Sans sujet',
    body: email.text || email.html || '',
    sender: email.from,
    receivedAt: email.receivedAt,
    pdfText: pdfTextForAI,
  };
  
  // Step 5: AI Analysis (with retry)
  console.log('Analyzing email with AI...');
  let aiOutput = await analyzeEmailWithRetry(aiInput);
  
  // Step 6: Use fallback if AI fails
  if (!aiOutput) {
    console.warn('AI analysis failed, using fallback');
    aiOutput = createFallbackOutput(aiInput);
  } else {
    console.log(`AI analysis complete: category=${aiOutput.category}`);
  }
  
  // Step 6b: Check if AI flagged this as a newsletter/promo to skip
  if (aiOutput.skip) {
    console.log('Email flagged as newsletter/promo - skipping task creation');
    const entry = await createInboxEntry({
      from: aiOutput.originalSender || email.from,
      subject: email.subject || 'Sans sujet',
      receivedAt: email.receivedAt,
      status: 'success',
      taskTitle: '(Newsletter/Promo - ignoré)',
      attachmentUrl: attachmentUrl || undefined,
      dedupeKey,
    }, userId);
    return { success: true, inboxEntry: entry };
  }
  
  // Use original sender if AI detected a forwarded email
  const effectiveSender = aiOutput.originalSender || email.from;
  
  // Step 7: Create task
  let task: Task;
  try {
    task = await createTask({
      title: aiOutput.title,
      category: aiOutput.category,
      deadline: aiOutput.deadline,
      description: aiOutput.description,
      source: 'email',
      imageUrl: attachmentUrl || undefined, // Include PDF attachment URL
      // Milestone 5: Contact info and template suggestions
      contactEmail: aiOutput.contactEmail || effectiveSender, // Use extracted or sender email
      contactPhone: aiOutput.contactPhone,
      contactName: aiOutput.contactName,
      suggestedTemplates: aiOutput.suggestedTemplates,
    }, userId);
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
      dedupeKey,
    }, userId);
    
    return { success: false, inboxEntry: entry, error: 'Task creation failed' };
  }
  
  // Step 8: Create inbox entry (success)
  const inboxEntry = await createInboxEntry({
    from: effectiveSender,
    subject: email.subject || 'Sans sujet',
    receivedAt: email.receivedAt,
    status: 'success',
    taskId: task.id,
    taskTitle: task.title,
    attachmentUrl: attachmentUrl || undefined,
    dedupeKey,
  }, userId);
  
  // Step 9: Create notification record (non-blocking)
  try {
    await createNotification({
      type: 'email_task_created',
      message: `Nouvelle tâche ajoutée depuis un email : ${task.title}`,
      metadata: { taskId: task.id, inboxId: inboxEntry.id },
    }, userId);
  } catch (error) {
    console.error('Notification creation failed:', error);
    // Non-blocking: task and inbox entry already created
  }
  
  // Step 10: Send push notification (works even when app is closed)
  try {
    await sendTaskCreatedPushNotificationForUser(userId, task.id, task.title, 'email');
    console.log(`Push notification sent for task: ${task.id}`);
  } catch (error) {
    console.error('Push notification failed:', error);
    // Non-blocking: task already created
  }
  
  console.log(`Email processed successfully: ${inboxEntry.id}`);
  return { success: true, inboxEntry, task };
}

/**
 * Extract user ID from the "to" address
 * Format: user+{userId}@domain.com
 */
export function extractUserIdFromAddress(to: string): string | null {
  const t = (to || '').trim();
  if (!t) return null;

  // Milestone 7: uid_xxx@hcfamily.app
  const uidMatch = t.match(/\b(uid_[a-z0-9]+)@/i);
  if (uidMatch?.[1]) return uidMatch[1].toLowerCase();

  // Backward compatibility: user+{id}@domain
  const legacy = t.match(/user\+([^@]+)@/i);
  return legacy?.[1] ? legacy[1] : null;
}
