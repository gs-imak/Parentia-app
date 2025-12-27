import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getProfile, getAllTasks, fetchWeather, fetchQuote } from '../api/client';
import { rescheduleAllNotifications, triggerUrgentTask, triggerDocumentReady } from '../notifications/NotificationScheduler';
import { getStoredCity } from '../utils/storage';
import * as Notifications from 'expo-notifications';

interface Props {
  onClose: () => void;
}

export default function NotificationsDebugScreen({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadContext = async () => {
    const [profile, tasks, city, quoteResp] = await Promise.all([
      getProfile(),
      getAllTasks(),
      getStoredCity(),
      fetchQuote().catch(() => null),
    ]);
    const weather = city ? await fetchWeather(city).catch(() => undefined) : undefined;
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
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Feather name="x" size={18} color="#3A82F7" />
        <Text style={styles.closeText}>Fermer</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Dev uniquement. Déclenche les notifications localement.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          console.log('[Debug] Loading context...');
          const ctx = await loadContext();
          console.log('[Debug] Context loaded, scheduling notifications...');
          await rescheduleAllNotifications({ ...ctx, pdfReadyTaskIds: new Set<string>() });
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
          const target = ctx.tasks.find(t => t.status !== 'done');
          if (!target) throw new Error('Aucune tâche non terminée disponible');
          console.log('[Debug] Triggering document ready:', target.title);
          await triggerDocumentReady(target);
        })}
      >
        <Feather name="file" size={18} color="#fff" />
        <Text style={styles.buttonText}>Document prêt immédiat</Text>
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
          if (!ctx.weather) throw new Error('Météo non disponible');
          
          const dueToday = ctx.tasks.filter((task: any) => {
            const deadline = new Date(task.deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return deadline >= today && deadline < tomorrow;
          }).slice(0, 3);
          
          const taskLines = dueToday.length
            ? dueToday.map((t: any) => `• ${t.title}`).join('\n')
            : 'Vous n\'avez aucune tâche prioritaire aujourd\'hui.';
          
          const greeting = ctx.profile.firstName ? `Bonjour ${ctx.profile.firstName},` : 'Bonjour,';
          const bodyParts = [
            greeting,
            `Météo: ${Math.round(ctx.weather.temperatureC)}° · ${ctx.weather.outfit || ''}`.trim(),
            taskLines,
            'Bonne journée.',
          ];
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Matin',
              body: bodyParts.join('\n'),
              data: { type: 'morning', deepLink: { route: 'tasks', params: { filter: 'today' } } },
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
          });
          
          setStatus(`✅ Notification du matin dans 5s\n${dueToday.length} tâche(s) incluse(s)`);
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
