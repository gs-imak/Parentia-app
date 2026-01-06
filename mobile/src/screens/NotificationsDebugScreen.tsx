import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getProfile, getAllTasks, fetchWeather, fetchQuote, updateTask, deleteTask } from '../api/client';
import { rescheduleAllNotifications, triggerUrgentTask, triggerNearDeadlineTask } from '../notifications/NotificationScheduler';
import { getStoredCity, getStoredCoordinates } from '../utils/storage';
import * as Notifications from 'expo-notifications';

// BUILD VERSION - used to verify correct build is running
const DEBUG_BUILD_VERSION = '2026-01-06-v3';

interface Props {
  onClose: () => void;
}

export default function NotificationsDebugScreen({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadContext = async () => {
    const [profile, tasks, city, coords, quoteResp] = await Promise.all([
      getProfile(),
      getAllTasks(),
      getStoredCity(),
      getStoredCoordinates(),
      fetchQuote().catch(() => null),
    ]);
    const weather = city ? await fetchWeather(city, coords || undefined).catch(() => undefined) : undefined;
    const quoteEvening = quoteResp && quoteResp.type === 'evening' ? quoteResp.text : undefined;
    return { profile, tasks: tasks.tasks, weather, quoteEvening };
  };

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setStatus(null);
    try {
      await action();
      setStatus('Action exécutée.');
    } catch (e: any) {
      console.error('[Debug] Notification error:', e);
      setStatus(`Erreur: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Debug Notifications</Text>
      <Text style={styles.version}>Build: {DEBUG_BUILD_VERSION}</Text>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Feather name="x" size={18} color="#3A82F7" />
        <Text style={styles.closeText}>Fermer</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Dev uniquement. Déclenche les notifications localement.</Text>

      {/* Cancel all pending notifications */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6B7280' }]}
        onPress={() => runAction(async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          setStatus('✅ Toutes les notifications annulées');
        })}
      >
        <Feather name="x-circle" size={18} color="#fff" />
        <Text style={styles.buttonText}>Annuler toutes les notifications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          console.log('[Debug] Loading context...');
          const ctx = await loadContext();
          console.log('[Debug] Context loaded, scheduling notifications...');
          await rescheduleAllNotifications(ctx);
          console.log('[Debug] Notifications scheduled');
          
          // NEW: Show scheduled notifications count
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          setStatus(`✅ ${scheduled.length} notifications planifiées:\n${scheduled.map(n => n.content.title).join('\n')}`);
        })}
      >
        <Feather name="refresh-ccw" size={18} color="#fff" />
        <Text style={styles.buttonText}>rescheduleAllNotifications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          console.log('[Debug] Loading context...');
          const ctx = await loadContext();
          console.log('[Debug] Context loaded, tasks:', ctx.tasks?.length ?? 0);
          const target = ctx.tasks[0];
          if (!target) throw new Error('Aucune tâche disponible');
          console.log('[Debug] Triggering urgent task:', target.title);
          await triggerUrgentTask(target);
        })}
      >
        <Feather name="alert-triangle" size={18} color="#fff" />
        <Text style={styles.buttonText}>Tâche urgente immédiate</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          console.log('[Debug] Loading context...');
          const ctx = await loadContext();
          console.log('[Debug] Context loaded, tasks:', ctx.tasks?.length ?? 0);
          // Find a task from email or photo source with near deadline
          const target = ctx.tasks.find(t => 
            (t.source === 'email' || t.source === 'photo') && t.status !== 'done'
          );
          if (!target) throw new Error('Aucune tâche email/photo disponible');
          console.log('[Debug] Triggering near deadline notification:', target.title);
          await triggerNearDeadlineTask(target);
        })}
      >
        <Feather name="clock" size={18} color="#fff" />
        <Text style={styles.buttonText}>Tâche échéance proche</Text>
      </TouchableOpacity>

      {/* NEW: Test overdue notification immediately - with action buttons */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#DC2626' }]}
        onPress={() => runAction(async () => {
          const ctx = await loadContext();
          
          // Get all overdue tasks
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          
          const overdueTasks = ctx.tasks.filter((task: any) => {
            const deadline = new Date(task.deadline);
            deadline.setHours(0, 0, 0, 0);
            return deadline < today && task.status !== 'done';
          });
          
          if (overdueTasks.length === 0) {
            throw new Error('Aucune tâche en retard. Créez des tâches avec une deadline passée.');
          }
          
          // Send individual notification for first overdue task only (for testing)
          const task = overdueTasks[0];
          const deadlineDate = new Date(task.deadline);
          const daysOverdue = Math.floor((now.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
          const overdueText = daysOverdue === 1 ? '1 jour de retard' : `${daysOverdue} jours de retard`;
          
          // Schedule with action buttons category
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Tâche en retard',
              body: `« ${task.title} » - ${overdueText}`,
              data: { type: 'overdue', taskId: task.id, deepLink: { route: 'taskDetail', params: { taskId: task.id } } },
              sound: true,
              categoryIdentifier: 'OVERDUE_TASK',
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
          });
          
          setStatus(`✅ Notification avec actions dans 3s\nTâche: ${task.title}\n\n⚠️ Long-press la notification pour voir les actions:\n• +1 jour\n• +3 jours\n• Supprimer`);
        })}
      >
        <Feather name="alert-circle" size={18} color="#fff" />
        <Text style={styles.buttonText}>Test Notification 09h (1 tâche)</Text>
      </TouchableOpacity>

      {/* NEW: Test evening notification immediately */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#10B981' }]}
        onPress={() => runAction(async () => {
          const ctx = await loadContext();
          const eveningMessage = ctx.quoteEvening || 'Bonne soirée. Profitez de ce moment pour vous reposer.';
          
          // Schedule evening notification in 5 seconds
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Phrase du soir',
              body: eveningMessage,
              data: { type: 'evening' },
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
          });
          
          setStatus('✅ Notification du soir dans 5 secondes');
        })}
      >
        <Feather name="moon" size={18} color="#fff" />
        <Text style={styles.buttonText}>Test Notification 19h (dans 5s)</Text>
      </TouchableOpacity>

      {/* NEW: Test morning notification immediately */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#F59E0B' }]}
        onPress={() => runAction(async () => {
          const ctx = await loadContext();
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          // Match actual scheduler: include both overdue AND today tasks
          const overdue = ctx.tasks.filter((task: any) => {
            const deadline = new Date(task.deadline);
            deadline.setHours(0, 0, 0, 0);
            return deadline < today && task.status !== 'done';
          });
          
          const dueToday = ctx.tasks.filter((task: any) => {
            const deadline = new Date(task.deadline);
            deadline.setHours(0, 0, 0, 0);
            return deadline >= today && deadline < tomorrow && task.status !== 'done';
          });
          
          // Build task section - prioritize TODAY's tasks, then mention overdue separately
          let taskSection: string;
          if (dueToday.length > 0) {
            const todayLines = dueToday.slice(0, 3).map((t: any) => `• ${t.title}`).join('\n');
            taskSection = `Vos démarches du jour :\n${todayLines}`;
            if (overdue.length > 0) {
              taskSection += `\n\n⚠️ ${overdue.length} tâche(s) en retard`;
            }
          } else if (overdue.length > 0) {
            const overdueLines = overdue.slice(0, 3).map((t: any) => `• ${t.title}`).join('\n');
            taskSection = `⚠️ Vous avez ${overdue.length} tâche(s) en retard :\n${overdueLines}`;
          } else {
            taskSection = "Vous n'avez aucune démarche prévue aujourd'hui.";
          }
          
          const greeting = ctx.profile.firstName ? `Bonjour ${ctx.profile.firstName},` : 'Bonjour,';
          const bodyParts = [greeting];
          
          // Weather is now optional
          if (ctx.weather) {
            bodyParts.push(`Météo: ${Math.round(ctx.weather.temperatureC)}°C · ${ctx.weather.outfit || ''}`.trim());
          }
          
          bodyParts.push(taskSection);
          bodyParts.push('Bonne journée.');
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Matin',
              body: bodyParts.join('\n'),
              data: { type: 'morning', deepLink: { route: 'tasks', params: { filter: 'today' } } },
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
          });
          
          setStatus(`✅ Notification du matin dans 5s\n${overdue.length} en retard + ${dueToday.length} aujourd'hui`);
        })}
      >
        <Feather name="sun" size={18} color="#fff" />
        <Text style={styles.buttonText}>Test Notification 07h30 (dans 5s)</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
      {status && <Text style={styles.status}>{status}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#2C3E50',
  },
  hint: {
    fontSize: 13,
    color: '#6E7A84',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  closeText: {
    marginLeft: 4,
    fontSize: 16,
    color: '#3A82F7',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#3A82F7',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  status: {
    marginTop: 12,
    fontSize: 14,
    color: '#10B981',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
  },
});
