import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { processIncomingEmail, extractUserIdFromAddress, type IncomingEmail } from './email.js';

/**
 * SendGrid Inbound Parse webhook handler
 * 
 * When "Send Raw" is enabled, SendGrid sends the full MIME message
 * in the "email" field of a multipart/form-data POST request.
 */

/**
 * Convert mailparser attachment to our format
 */
function convertAttachment(att: Attachment): IncomingEmail['attachments'][0] | null {
  if (!att.content) return null;
  
  return {
    filename: att.filename || 'attachment',
    content: att.content,
    contentType: att.contentType || 'application/octet-stream',
  };
}

/**
 * Convert ParsedMail to our IncomingEmail format
 */
function convertToIncomingEmail(parsed: ParsedMail): IncomingEmail {
  // Extract sender email
  let from = '';
  if (parsed.from?.value?.[0]) {
    from = parsed.from.value[0].address || '';
  }
  
  // Extract recipient (important for user+id routing)
  let to = '';
  if (parsed.to) {
    const toValue = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
    if (toValue?.value?.[0]) {
      to = toValue.value[0].address || '';
    }
  }
  
  // Convert attachments
  const attachments: IncomingEmail['attachments'] = [];
  if (parsed.attachments) {
    for (const att of parsed.attachments) {
      const converted = convertAttachment(att);
      if (converted) {
        attachments.push(converted);
      }
    }
  }
  
  return {
    from,
    to,
    subject: parsed.subject || '',
    text: parsed.text || '',
    html: parsed.html || undefined,
    receivedAt: (parsed.date || new Date()).toISOString(),
    attachments,
  };
}

/**
 * Process raw MIME email from SendGrid Inbound Parse
 * @param rawEmail - The raw MIME message string
 * @returns Processing result
 */
export async function processSendGridInbound(rawEmail: string | Buffer): Promise<{
  success: boolean;
  userId?: string | null;
  taskId?: string;
  error?: string;
}> {
  try {
    console.log(`[SendGrid Inbound] Received webhook, parsing MIME...`);
    
    // Parse the raw MIME message
    const parsed = await simpleParser(rawEmail);
    
    // Convert to our format
    const email = convertToIncomingEmail(parsed);
    
    console.log(`[SendGrid Inbound] Email from: ${email.from}`);
    console.log(`[SendGrid Inbound] Email to: ${email.to}`);
    console.log(`[SendGrid Inbound] Subject: ${email.subject}`);
    console.log(`[SendGrid Inbound] Attachments: ${email.attachments.length}`);
    
    // Extract user ID from the "to" address (user+{id}@hcfamily.app)
    const userId = extractUserIdFromAddress(email.to);
    console.log(`[SendGrid Inbound] Extracted userId: ${userId || 'none (default user)'}`);
    
    // Process through existing pipeline
    const result = await processIncomingEmail(email);
    
    if (result.success) {
      console.log(`[SendGrid Inbound] ✓ Email processed successfully`);
      return {
        success: true,
        userId,
        taskId: result.task?.id,
      };
    } else {
      console.log(`[SendGrid Inbound] ✗ Processing failed: ${result.error}`);
      return {
        success: false,
        userId,
        error: result.error,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SendGrid Inbound] Parse error:`, message);
    return {
      success: false,
      error: `Failed to parse email: ${message}`,
    };
  }
}

/**
 * Parse multipart form data manually (simple implementation)
 * SendGrid sends: Content-Type: multipart/form-data with field "email"
 */
export function extractEmailFromMultipart(
  body: Buffer,
  contentType: string
): string | null {
  try {
    // Extract boundary from content-type
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
    if (!boundaryMatch) {
      console.error('[SendGrid Inbound] No boundary found in content-type');
      return null;
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    
    // Convert body to string for parsing
    const bodyStr = body.toString('utf-8');
    
    // Split by boundary
    const parts = bodyStr.split(`--${boundary}`);
    
    // Find the "email" field
    for (const part of parts) {
      // Check if this part contains the "email" field
      if (part.includes('name="email"')) {
        // Extract content after headers (double newline)
        const headerEndIndex = part.indexOf('\r\n\r\n');
        if (headerEndIndex !== -1) {
          const content = part.substring(headerEndIndex + 4);
          // Remove trailing boundary markers
          const cleanContent = content.replace(/\r\n--.*$/, '').trim();
          return cleanContent;
        }
      }
    }
    
    console.error('[SendGrid Inbound] "email" field not found in multipart data');
    return null;
  } catch (error) {
    console.error('[SendGrid Inbound] Error extracting email from multipart:', error);
    return null;
  }
}
