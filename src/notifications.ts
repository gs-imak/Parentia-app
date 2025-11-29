import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  try {
    const content = await fs.readFile(NOTIFICATIONS_FILE, 'utf-8');
    return JSON.parse(content) as Notification[];
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return [];
  }
}

async function writeNotifications(notifications: Notification[]): Promise<void> {
  await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), 'utf-8');
}

/**
 * Create a new notification
 */
export async function createNotification(
  data: Omit<Notification, 'id' | 'createdAt' | 'read'>
): Promise<Notification> {
  const notifications = await readNotifications();
  
  const newNotification: Notification = {
    ...data,
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  
  notifications.unshift(newNotification); // Add to beginning (newest first)
  
  // Keep only last 100 notifications to prevent file from growing too large
  const trimmed = notifications.slice(0, 100);
  await writeNotifications(trimmed);
  
  return newNotification;
}

/**
 * Get all notifications (newest first)
 */
export async function getNotifications(): Promise<Notification[]> {
  const notifications = await readNotifications();
  return notifications.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(id: string): Promise<Notification | null> {
  const notifications = await readNotifications();
  const index = notifications.findIndex(n => n.id === id);
  
  if (index === -1) return null;
  
  notifications[index].read = true;
  await writeNotifications(notifications);
  
  return notifications[index];
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<number> {
  const notifications = await readNotifications();
  let count = 0;
  
  for (const notification of notifications) {
    if (!notification.read) {
      notification.read = true;
      count++;
    }
  }
  
  if (count > 0) {
    await writeNotifications(notifications);
  }
  
  return count;
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(): Promise<number> {
  const notifications = await readNotifications();
  return notifications.filter(n => !n.read).length;
}
