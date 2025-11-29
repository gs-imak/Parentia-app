import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { processIncomingEmail, type IncomingEmail } from './email.js';

// IMAP Configuration from environment variables
const IMAP_USER = process.env.IMAP_USER || '';
const IMAP_PASSWORD = process.env.IMAP_PASSWORD || ''; // App-specific password for Gmail
const IMAP_HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);

// Polling interval in milliseconds (default: 5 minutes)
const POLL_INTERVAL = parseInt(process.env.EMAIL_POLL_INTERVAL || '300000', 10);

// Track if poller is running
let isPolling = false;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Check if IMAP is configured
 */
export function isImapConfigured(): boolean {
  return Boolean(IMAP_USER && IMAP_PASSWORD);
}

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
function convertToIncomingEmail(parsed: ParsedMail, uid: number): IncomingEmail {
  // Extract sender email
  let from = '';
  if (parsed.from?.value?.[0]) {
    from = parsed.from.value[0].address || '';
  }
  
  // Extract recipient
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
 * Connect to IMAP and fetch unread emails
 */
async function fetchUnreadEmails(): Promise<void> {
  if (!isImapConfigured()) {
    console.log('IMAP not configured, skipping email check');
    return;
  }
  
  console.log(`[${new Date().toISOString()}] Checking for new emails...`);
  
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: IMAP_USER,
      password: IMAP_PASSWORD,
      host: IMAP_HOST,
      port: IMAP_PORT,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          imap.end();
          reject(err);
          return;
        }
        
        // Search for unread (UNSEEN) emails
        imap.search(['UNSEEN'], async (searchErr, uids) => {
          if (searchErr) {
            console.error('Error searching emails:', searchErr);
            imap.end();
            reject(searchErr);
            return;
          }
          
          if (!uids || uids.length === 0) {
            console.log('No new emails found');
            imap.end();
            resolve();
            return;
          }
          
          console.log(`Found ${uids.length} unread email(s)`);
          
          // Process each email (DON'T mark as seen yet - we'll do it after successful processing)
          const fetch = imap.fetch(uids, { bodies: '', markSeen: false });
          
          fetch.on('message', (msg, seqno) => {
            let uid = 0;
            
            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
            });
            
            msg.on('body', (stream) => {
              // Collect stream data
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.once('end', async () => {
                const buffer = Buffer.concat(chunks);
                
                try {
                  // Parse email
                  const parsed = await simpleParser(buffer);
                  const email = convertToIncomingEmail(parsed, uid);
                  
                  console.log(`Processing email: ${email.subject} from ${email.from}`);
                  
                  // Process through our pipeline
                  const result = await processIncomingEmail(email);
                  
                  if (result.success) {
                    console.log(`✓ Email processed successfully: ${result.task?.title}`);
                    
                    // Mark as read ONLY after successful processing
                    imap.setFlags([uid], ['\\Seen'], (flagErr) => {
                      if (flagErr) {
                        console.error(`Failed to mark email ${uid} as read:`, flagErr);
                      } else {
                        console.log(`Email ${uid} marked as read`);
                      }
                    });
                  } else {
                    console.log(`✗ Email processing failed: ${result.error}`);
                    console.log(`Email ${uid} left unread for retry on next poll`);
                  }
                } catch (parseErr) {
                  console.error('Error parsing email:', parseErr);
                  console.log(`Email ${uid} left unread due to parsing error`);
                }
              });
            });
          });
          
          fetch.once('error', (fetchErr) => {
            console.error('Fetch error:', fetchErr);
          });
          
          fetch.once('end', () => {
            imap.end();
            resolve();
          });
        });
      });
    });
    
    imap.once('error', (err: Error) => {
      console.error('IMAP connection error:', err.message);
      reject(err);
    });
    
    imap.once('end', () => {
      console.log('IMAP connection closed');
    });
    
    imap.connect();
  });
}

/**
 * Start the email polling service
 */
export function startEmailPoller(): void {
  if (!isImapConfigured()) {
    console.log('Email poller not started: IMAP credentials not configured');
    console.log('Set IMAP_USER and IMAP_PASSWORD environment variables to enable');
    return;
  }
  
  if (isPolling) {
    console.log('Email poller already running');
    return;
  }
  
  isPolling = true;
  console.log(`Starting email poller (interval: ${POLL_INTERVAL / 1000}s)`);
  console.log(`IMAP User: ${IMAP_USER}`);
  console.log(`IMAP Host: ${IMAP_HOST}:${IMAP_PORT}`);
  
  // Run immediately on start
  fetchUnreadEmails().catch((err) => {
    console.error('Initial email fetch failed:', err.message);
  });
  
  // Then poll at interval
  pollTimer = setInterval(async () => {
    try {
      await fetchUnreadEmails();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Email polling error:', message);
    }
  }, POLL_INTERVAL);
}

/**
 * Stop the email polling service
 */
export function stopEmailPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPolling = false;
  console.log('Email poller stopped');
}

/**
 * Manually trigger an email check (useful for testing)
 */
export async function checkEmailsNow(): Promise<{ success: boolean; error?: string }> {
  if (!isImapConfigured()) {
    return { success: false, error: 'IMAP not configured' };
  }
  
  try {
    await fetchUnreadEmails();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get poller status
 */
export function getPollerStatus(): {
  running: boolean;
  configured: boolean;
  user: string;
  host: string;
  interval: number;
} {
  return {
    running: isPolling,
    configured: isImapConfigured(),
    user: IMAP_USER ? IMAP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : 'not set',
    host: IMAP_HOST,
    interval: POLL_INTERVAL,
  };
}
