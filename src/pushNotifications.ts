import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUSH_TOKENS_FILE = path.join(__dirname, '..', 'data', 'push-tokens.json');

// Create a new Expo SDK client
const expo = new Expo();

interface PushTokenRecord {
  token: string;
  createdAt: string;
  lastUsedAt: string;
}

/**
 * Read stored push tokens
 */
async function readTokens(): Promise<PushTokenRecord[]> {
  try {
    const content = await fs.readFile(PUSH_TOKENS_FILE, 'utf-8');
    return JSON.parse(content) as PushTokenRecord[];
  } catch {
    return [];
  }
}

/**
 * Write push tokens to storage
 */
async function writeTokens(tokens: PushTokenRecord[]): Promise<void> {
  await fs.writeFile(PUSH_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
}

/**
 * Register a push token (called from mobile app)
 */
export async function registerPushToken(token: string): Promise<boolean> {
  // Validate token format
  if (!Expo.isExpoPushToken(token)) {
    console.warn('[Push] Invalid token format:', token);
    return false;
  }

  const tokens = await readTokens();
  const existing = tokens.find(t => t.token === token);

  if (existing) {
    // Update last used timestamp
    existing.lastUsedAt = new Date().toISOString();
    await writeTokens(tokens);
    console.log('[Push] Token updated:', token.substring(0, 20) + '...');
    return true;
  }

  // Add new token
  tokens.push({
    token,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  });

  await writeTokens(tokens);
  console.log('[Push] Token registered:', token.substring(0, 20) + '...');
  return true;
}

/**
 * Remove a push token (when user logs out or token becomes invalid)
 */
export async function removePushToken(token: string): Promise<boolean> {
  const tokens = await readTokens();
  const filtered = tokens.filter(t => t.token !== token);

  if (filtered.length === tokens.length) {
    return false; // Token wasn't found
  }

  await writeTokens(filtered);
  console.log('[Push] Token removed');
  return true;
}

/**
 * Get all registered push tokens
 */
export async function getAllPushTokens(): Promise<string[]> {
  const tokens = await readTokens();
  return tokens.map(t => t.token);
}

/**
 * Send push notification to all registered devices
 */
export async function sendPushNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ sent: number; failed: number }> {
  const tokenRecords = await readTokens();
  
  if (tokenRecords.length === 0) {
    console.log('[Push] No registered tokens, skipping notification');
    return { sent: 0, failed: 0 };
  }

  // Build messages
  const messages: ExpoPushMessage[] = [];
  for (const record of tokenRecords) {
    if (!Expo.isExpoPushToken(record.token)) {
      console.warn('[Push] Invalid token found, skipping:', record.token);
      continue;
    }

    messages.push({
      to: record.token,
      sound: 'default',
      title,
      body,
      data: data || {},
    });
  }

  if (messages.length === 0) {
    console.log('[Push] No valid tokens to send to');
    return { sent: 0, failed: 0 };
  }

  // Send in chunks (Expo recommends batches of 100)
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      
      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i] as ExpoPushTicket;
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          // Check if token is invalid and should be removed
          if (ticket.status === 'error') {
            const details = ticket.details;
            if (details && 'error' in details && details.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[i].to as string);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Push] Error sending chunk:', error);
      failed += chunk.length;
    }
  }

  // Remove invalid tokens
  if (invalidTokens.length > 0) {
    console.log('[Push] Removing', invalidTokens.length, 'invalid tokens');
    const tokens = await readTokens();
    const filtered = tokens.filter(t => !invalidTokens.includes(t.token));
    await writeTokens(filtered);
  }

  console.log(`[Push] Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
}

/**
 * Send push notification for a new task created via email
 */
export async function sendTaskCreatedPushNotification(
  taskId: string,
  taskTitle: string,
  source: 'email' | 'photo' = 'email'
): Promise<void> {
  const sourceLabel = source === 'email' ? 'email' : 'photo';
  
  await sendPushNotification(
    'Nouvelle tâche',
    `Tâche créée depuis un ${sourceLabel} : ${taskTitle}`,
    {
      type: 'task_created',
      taskId,
      source,
      deepLink: { route: 'taskDetail', params: { taskId } },
    }
  );
}

