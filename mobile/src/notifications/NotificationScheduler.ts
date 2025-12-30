import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task, updateTask, deleteTask } from '../api/client';
import {
  getTasksDueToday,
  getTasksDueTomorrow,
  getOverdueTasks,
  hasNearDeadline,
  hasSchoolAgeChild,
  isRainy,
  getWeekendSimpleTasks,
  formatDateFr,
  formatTemperatureInt,
} from './RuleEngine';
import {
  getMorningNotificationEnabled,
  getJ1NotificationEnabled,
  getEveningNotificationEnabled,
  getOverdueNotificationEnabled,
  getSmartNotificationsEnabled,
} from '../utils/storage';
import { NotificationMeta, SchedulerContext } from './types';

// Notification action identifiers
const ACTION_DELAY_1_DAY = 'DELAY_1_DAY';
const ACTION_DELAY_3_DAYS = 'DELAY_3_DAYS';
const ACTION_DELETE = 'DELETE_TASK';
const CATEGORY_OVERDUE_TASK = 'OVERDUE_TASK';

/**
 * Set up notification categories with action buttons (iOS)
 * Must be called on app startup before any notifications are scheduled
 */
export async function setupNotificationCategories() {
  if (Platform.OS === 'web') return;
  
  await Notifications.setNotificationCategoryAsync(CATEGORY_OVERDUE_TASK, [
    {
      identifier: ACTION_DELAY_1_DAY,
      buttonTitle: '+1 jour',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: ACTION_DELAY_3_DAYS,
      buttonTitle: '+3 jours',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: ACTION_DELETE,
      buttonTitle: 'Supprimer',
      options: { isDestructive: true, isAuthenticationRequired: false },
    },
  ]);
}

type TriggerTime = { hour: number; minute: number };

const MORNING_TIME: TriggerTime = { hour: 7, minute: 30 };
const J1_TIME: TriggerTime = { hour: 18, minute: 0 };
const EVENING_TIME: TriggerTime = { hour: 19, minute: 0 };
const OVERDUE_TIME: TriggerTime = { hour: 9, minute: 0 };
const RAIN_TIME: TriggerTime = { hour: 7, minute: 45 };
const WEEKEND_TIME: TriggerTime = { hour: 9, minute: 30 };

function buildIdentifier(type: string, dateKey: string): string {
  return `${type}-${dateKey}`;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function makeTrigger(time: TriggerTime, dayOffset = 0): Notifications.ScheduleTriggerInput {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + dayOffset);
  target.setHours(time.hour, time.minute, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: target.getHours(), minute: target.getMinutes(), repeats: true };
}

function makeWeeklyTrigger(time: TriggerTime, weekday: number): Notifications.ScheduleTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    weekday,
    hour: time.hour,
    minute: time.minute,
    repeats: true,
  };
}

async function scheduleLocal(
  title: string,
  body: string,
  trigger: Notifications.ScheduleTriggerInput,
  meta: NotificationMeta,
  identifier: string,
  categoryId?: string,
) {
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: meta,
    sound: true,
    ...(categoryId && Platform.OS !== 'web' ? { categoryIdentifier: categoryId } : {}),
  };
  
  await Notifications.scheduleNotificationAsync({
    identifier,
    content,
    trigger,
  });
}

export async function cancelAllScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleAllNotifications(ctx: SchedulerContext) {
  await cancelAllScheduledNotifications();

  const now = ctx.now ?? new Date();
  const todayKey = dateKey(now);

  const [
    morningEnabled,
    j1Enabled,
    eveningEnabled,
    overdueEnabled,
    smartEnabled,
  ] = await Promise.all([
    getMorningNotificationEnabled(),
    getJ1NotificationEnabled(),
    getEveningNotificationEnabled(),
    getOverdueNotificationEnabled(),
    getSmartNotificationsEnabled(),
  ]);

  // Morning 07:30
  if (morningEnabled && ctx.weather) {
    const dueToday = getTasksDueToday(ctx.tasks, now).slice(0, 3);
    const taskLines = dueToday.length
      ? dueToday.map(t => `• ${t.title}`).join('\n')
      : 'Vous n’avez aucune tâche prioritaire aujourd’hui.';
    const greeting = ctx.profile.firstName ? `Bonjour ${ctx.profile.firstName},` : 'Bonjour,';
    const bodyParts = [
      greeting,
      `Météo: ${formatTemperatureInt(ctx.weather.temperatureC)} · ${ctx.weather.outfit || ''}`.trim(),
      taskLines,
      'Bonne journée.',
    ];
    await scheduleLocal(
      'Matin',
      bodyParts.join('\n'),
      makeTrigger(MORNING_TIME),
      { type: 'morning', deepLink: { route: 'tasks', params: { filter: 'today' } } },
      buildIdentifier('morning', todayKey),
    );
  }

  // J-1 18:00
  if (j1Enabled) {
    const dueTomorrow = getTasksDueTomorrow(ctx.tasks, now);
    if (dueTomorrow.length > 0) {
      // Build rich message with task titles
      let bodyMessage: string;
      if (dueTomorrow.length === 1) {
        bodyMessage = `La tâche « ${dueTomorrow[0].title} » arrive à échéance demain.`;
      } else if (dueTomorrow.length <= 3) {
        const titles = dueTomorrow.map(t => `• ${t.title}`).join('\n');
        bodyMessage = `${dueTomorrow.length} tâches arrivent à échéance demain :\n${titles}`;
      } else {
        bodyMessage = `${dueTomorrow.length} tâches arrivent à échéance demain, dont « ${dueTomorrow[0].title} ».`;
      }
      
      await scheduleLocal(
        'Pour demain',
        bodyMessage,
        makeTrigger(J1_TIME),
        { type: 'j1', deepLink: { route: 'tasks', params: { filter: 'tomorrow' } } },
        buildIdentifier('j1', todayKey),
      );
    }
  }

  // Evening 19:00
  // FIX: Remove quote dependency - evening notification should always send when enabled
  if (eveningEnabled) {
    const eveningMessage = ctx.quoteEvening || 'Bonne soirée. Profitez de ce moment pour vous reposer.';
    await scheduleLocal(
      'Phrase du soir',
      eveningMessage,
      makeTrigger(EVENING_TIME),
      { type: 'evening' },
      buildIdentifier('evening', todayKey),
    );
  }

  // Overdue 09:00 - Individual notifications per task with action buttons
  if (overdueEnabled) {
    const overdue = getOverdueTasks(ctx.tasks, now);
    if (overdue.length > 0) {
      // Schedule individual notification for each overdue task (max 5 to avoid spam)
      // Uses CALENDAR trigger at 9:00 AM to avoid immediate spam
      const tasksToNotify = overdue.slice(0, 5);
      
      for (let i = 0; i < tasksToNotify.length; i++) {
        const task = tasksToNotify[i];
        const deadlineDate = new Date(task.deadline);
        const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
        const overdueText = daysOverdue === 1 ? '1 jour de retard' : `${daysOverdue} jours de retard`;
        
        await scheduleLocal(
          'Tâche en retard',
          `« ${task.title} » - ${overdueText}`,
          // Schedule at 9:00 AM (same time, all notifications arrive together)
          makeTrigger(OVERDUE_TIME),
          { type: 'overdue', taskId: task.id, deepLink: { route: 'taskDetail', params: { taskId: task.id } } },
          buildIdentifier('overdue-task', `${todayKey}-${task.id}`),
          CATEGORY_OVERDUE_TASK,
        );
      }
      
      // If more than 5 overdue tasks, add a summary notification
      if (overdue.length > 5) {
        await scheduleLocal(
          'Tâches en retard',
          `${overdue.length - 5} autres tâches en retard. Appuyez pour voir tout.`,
          makeTrigger(OVERDUE_TIME),
          { type: 'overdue', deepLink: { route: 'tasks', params: { filter: 'overdue' } } },
          buildIdentifier('overdue-summary', todayKey),
        );
      }
    }
  }

  if (smartEnabled) {
    // Rain + children 07:45 (anti-spam: skip if morning will send and rainy overlap)
    if (ctx.weather && isRainy(ctx.weather) && hasSchoolAgeChild(ctx.profile)) {
      const dueToday = getTasksDueToday(ctx.tasks, now);
      const willSendMorning = morningEnabled && ctx.weather && (dueToday.length > 0 || true); // morning always sends weather; so skip rain if morning is active
      if (!willSendMorning) {
        await scheduleLocal(
          'Pluie annoncée',
          'Prévoyez les affaires adaptées pour vos enfants.',
          makeTrigger(RAIN_TIME),
          { type: 'rain_children', deepLink: { route: 'tasks', params: { filter: 'today' } } },
          buildIdentifier('rain', todayKey),
        );
      }
    }

    // Weekend checklist Saturday 09:30
    const isSaturday = (now.getDay() === 6);
    if (isSaturday) {
      const { eligibleTasks } = getWeekendSimpleTasks(ctx.tasks, now, new Set<string>());
      if (eligibleTasks.length > 0) {
        const lines = eligibleTasks.map(t => `• ${t.title}`).join('\n');
        await scheduleLocal(
          'Check-list week-end',
          lines,
          makeWeeklyTrigger(WEEKEND_TIME, 7),
          { type: 'weekend_simple', deepLink: { route: 'tasks', params: { filter: 'weekend', taskIds: eligibleTasks.map(t => t.id) } } },
          buildIdentifier('weekend', todayKey),
        );
      }
    }
  }
}

export async function triggerUrgentTask(task: Task) {
  const smartEnabled = await getSmartNotificationsEnabled();
  if (!smartEnabled) return;
  const nowKey = dateKey(new Date());
  await scheduleLocal(
    'Tâche urgente',
    `${task.title} · Deadline ${formatDateFr(new Date(task.deadline))}`,
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false },
    { type: 'urgent', deepLink: { route: 'taskDetail', params: { taskId: task.id } }, taskId: task.id },
    buildIdentifier('urgent', `${nowKey}-${task.id}`),
  );
}

/**
 * Trigger notification when a task is created via email/photo with deadline < 3 days
 */
export async function triggerNearDeadlineTask(task: Task) {
  const smartEnabled = await getSmartNotificationsEnabled();
  if (!smartEnabled) return;
  
  // Only trigger for tasks created from email or photo
  if (task.source !== 'email' && task.source !== 'photo') return;
  
  // Check if deadline is within 3 days
  if (!hasNearDeadline(task, new Date())) return;
  
  const nowKey = dateKey(new Date());
  const sourceLabel = task.source === 'email' ? 'email' : 'photo';
  
  await scheduleLocal(
    'Nouvelle tâche urgente',
    `Une tâche a été créée depuis un ${sourceLabel} avec une échéance proche : « ${task.title} » - ${formatDateFr(new Date(task.deadline))}`,
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false },
    { type: 'near_deadline', deepLink: { route: 'taskDetail', params: { taskId: task.id } }, taskId: task.id },
    buildIdentifier('near_deadline', `${nowKey}-${task.id}`),
  );
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  tasks: Task[],
): Promise<{ actionTaken: boolean }> {
  const meta = response.notification.request.content.data as NotificationMeta | undefined;
  if (!meta) return { actionTaken: false };
  
  const actionId = response.actionIdentifier;
  const taskId = meta.taskId;
  
  // Handle notification action buttons
  if (taskId && actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return { actionTaken: false };
      
      if (actionId === ACTION_DELETE) {
        await deleteTask(taskId);
        return { actionTaken: true };
      }
      
      if (actionId === ACTION_DELAY_1_DAY || actionId === ACTION_DELAY_3_DAYS) {
        const daysToAdd = actionId === ACTION_DELAY_1_DAY ? 1 : 3;
        const currentDeadline = new Date(task.deadline);
        const newDeadline = new Date(currentDeadline);
        newDeadline.setDate(newDeadline.getDate() + daysToAdd);
        
        await updateTask(taskId, { deadline: newDeadline.toISOString() });
        return { actionTaken: true };
      }
    } catch (error) {
      console.error('Failed to process notification action:', error);
    }
  }
  
  // DeepLink navigation is handled by App.tsx based on meta.deepLink
  return { actionTaken: false };
}












