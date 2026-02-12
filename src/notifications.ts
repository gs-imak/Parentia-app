import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureUserJsonFile, readJsonFile, requireUserId, writeJsonFile } from './userData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTIFICATIONS_FILE = path.join(__dirname, '..', 'data', 'notifications.json');

export type NotificationType = 'email_task_created' | 'email_error';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    taskId?: string;
    inboxId?: string;
  };
}

async function readNotifications(): Promise<Notification[]> {
  // Legacy (no user scoping)
  return readJsonFile<Notification[]>(NOTIFICATIONS_FILE, []);
}

async function writeNotifications(notifications: Notification[]): Promise<void> {
  await writeJsonFile(NOTIFICATIONS_FILE, notifications);
}

async function getNotificationsPath(userId?: string | null): Promise<string> {
  const uid = requireUserId(userId);
  return ensureUserJsonFile({
    userId: uid,
    perUserFilename: 'notifications.json',
    legacyAbsolutePath: NOTIFICATIONS_FILE,
    defaultJson: '[]',
  });
}

async function readNotificationsForUser(userId?: string | null): Promise<Notification[]> {
  const p = await getNotificationsPath(userId);
  return readJsonFile<Notification[]>(p, []);
}

async function writeNotificationsForUser(notifications: Notification[], userId?: string | null): Promise<void> {
  const p = await getNotificationsPath(userId);
  await writeJsonFile(p, notifications);
}

/**
 * Create a new notification
 */
export async function createNotification(
  data: Omit<Notification, 'id' | 'createdAt' | 'read'>,
  userId?: string | null
): Promise<Notification> {
  const notifications = await readNotificationsForUser(userId);
  
  const newNotification: Notification = {
    ...data,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  
  notifications.unshift(newNotification); // Add to beginning (newest first)
  
  // Keep only last 100 notifications to prevent file from growing too large
  const trimmed = notifications.slice(0, 100);
  await writeNotificationsForUser(trimmed, userId);
  
  return newNotification;
}

/**
 * Get all notifications (newest first)
 */
export async function getNotifications(userId?: string | null): Promise<Notification[]> {
  const notifications = await readNotificationsForUser(userId);
  return notifications.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(id: string, userId?: string | null): Promise<Notification | null> {
  const notifications = await readNotificationsForUser(userId);
  const index = notifications.findIndex(n => n.id === id);
  
  if (index === -1) return null;
  
  notifications[index].read = true;
  await writeNotificationsForUser(notifications, userId);
  
  return notifications[index];
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId?: string | null): Promise<number> {
  const notifications = await readNotificationsForUser(userId);
  let count = 0;
  
  for (const notification of notifications) {
    if (!notification.read) {
      notification.read = true;
      count++;
    }
  }
  
  if (count > 0) {
    await writeNotificationsForUser(notifications, userId);
  }
  
  return count;
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(userId?: string | null): Promise<number> {
  const notifications = await readNotificationsForUser(userId);
  return notifications.filter(n => !n.read).length;
}
