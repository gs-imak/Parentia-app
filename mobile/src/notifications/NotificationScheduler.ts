import * as Notifications from 'expo-notifications';
import { Task, Profile, WeatherSummary, updateTask, deleteTask } from '../api/client';
import {
  getTasksDueToday,
  getTasksDueTomorrow,
  getOverdueTasks,
  isUrgentTask,
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
import { NotificationMeta, SchedulerContext, DeepLinkPayload } from './types';

type TriggerTime = { hour: number; minute: number };

const MORNING_TIME: TriggerTime = { hour: 7, minute: 30 };
const J1_TIME: TriggerTime = { hour: 18, minute: 0 };
const EVENING_TIME: TriggerTime = { hour: 19, minute: 0 };
const OVERDUE_TIME: TriggerTime = { hour: 9, minute: 0 };
const RAIN_TIME: TriggerTime = { hour: 7, minute: 45 };
const WEEKEND_TIME: TriggerTime = { hour: 9, minute: 30 };

const CATEGORY_OVERDUE = 'overdue-actions';

function buildIdentifier(type: string, dateKey: string): string {
  return `${type}-${dateKey}`;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function ensureCategories() {
  await Notifications.setNotificationCategoryAsync(CATEGORY_OVERDUE, [
    { identifier: 'delay', buttonTitle: 'Décaler la deadline' },
    { identifier: 'delete', buttonTitle: 'Supprimer la tâche', options: { isDestructive: true } },
  ]);
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
) {
  const content: Notifications.NotificationContentInput = {
    title,
    body,
    data: meta,
    sound: true,
  };
  
  // Only add categoryIdentifier if it's for overdue notifications (iOS crashes on undefined)
  if (meta.type === 'overdue') {
    content.categoryIdentifier = CATEGORY_OVERDUE;
  }
  
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
  await ensureCategories();
  await cancelAllScheduledNotifications();

  const now = ctx.now ?? new Date();
  const todayKey = dateKey(now);
  const pdfReadyIds = ctx.pdfReadyTaskIds ?? new Set<string>();

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

  // Overdue 09:00
  if (overdueEnabled) {
    const overdue = getOverdueTasks(ctx.tasks, now);
    if (overdue.length > 0) {
      const targetTask = overdue[0];
      
      // Build rich message with task titles
      let bodyMessage: string;
      if (overdue.length === 1) {
        bodyMessage = `La tâche « ${overdue[0].title} » est en retard.`;
      } else if (overdue.length <= 3) {
        const titles = overdue.map(t => `• ${t.title}`).join('\n');
        bodyMessage = `${overdue.length} tâches en retard :\n${titles}`;
      } else {
        bodyMessage = `${overdue.length} tâches en retard, dont « ${overdue[0].title} ».`;
      }
      
      await scheduleLocal(
        'Tâches en retard',
        bodyMessage,
        makeTrigger(OVERDUE_TIME),
        { type: 'overdue', deepLink: { route: 'tasks', params: { filter: 'overdue' } }, taskId: targetTask.id },
        buildIdentifier('overdue', todayKey),
      );
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
      const { eligibleTasks } = getWeekendSimpleTasks(ctx.tasks, now, pdfReadyIds);
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

export async function triggerDocumentReady(task: Task) {
  const smartEnabled = await getSmartNotificationsEnabled();
  if (!smartEnabled) return;
  const nowKey = dateKey(new Date());
  await scheduleLocal(
    'Document prêt',
    `${task.title}`,
    { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false },
    { type: 'document_ready', deepLink: { route: 'taskDetail', params: { taskId: task.id } }, taskId: task.id },
    buildIdentifier('doc', `${nowKey}-${task.id}`),
  );
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  tasks: Task[],
) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/dd150d80-0fe5-40cf-9c99-37e53bfab0b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NotificationScheduler.ts:267',message:'handleNotificationResponse called',data:{actionId:response.actionIdentifier},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  
  const meta = response.notification.request.content.data as NotificationMeta | undefined;
  if (!meta || meta.type !== 'overdue' || !meta.taskId) return;

  const actionId = response.actionIdentifier;
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dd150d80-0fe5-40cf-9c99-37e53bfab0b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NotificationScheduler.ts:275',message:'Before action execution',data:{actionId,taskId:meta.taskId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    if (actionId === 'delay') {
      const task = tasks.find(t => t.id === meta.taskId);
      if (task) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        await updateTask(task.id, { deadline: tomorrow.toISOString() });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/dd150d80-0fe5-40cf-9c99-37e53bfab0b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NotificationScheduler.ts:281',message:'Task delay successful',data:{taskId:task.id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
      }
    } else if (actionId === 'delete') {
      await deleteTask(meta.taskId);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dd150d80-0fe5-40cf-9c99-37e53bfab0b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NotificationScheduler.ts:284',message:'Task delete successful',data:{taskId:meta.taskId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dd150d80-0fe5-40cf-9c99-37e53bfab0b3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NotificationScheduler.ts:290',message:'ERROR in notification action',data:{actionId,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    
    // Fail gracefully - don't crash the app
    console.warn('[handleNotificationResponse] Action failed:', error);
  }
}












