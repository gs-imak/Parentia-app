import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getProfile, getAllTasks, fetchWeather, fetchQuote } from '../api/client';
import { rescheduleAllNotifications, triggerUrgentTask, triggerDocumentReady } from '../notifications/NotificationScheduler';
import { getStoredCity } from '../utils/storage';

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
    } catch (e) {
      setStatus('Erreur lors du déclenchement.');
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
          const ctx = await loadContext();
          await rescheduleAllNotifications({ ...ctx, pdfReadyTaskIds: new Set<string>() });
        })}
      >
        <Feather name="refresh-ccw" size={18} color="#fff" />
        <Text style={styles.buttonText}>rescheduleAllNotifications</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          const ctx = await loadContext();
          const target = ctx.tasks[0];
          if (target) await triggerUrgentTask(target);
        })}
      >
        <Feather name="alert-triangle" size={18} color="#fff" />
        <Text style={styles.buttonText}>Tâche urgente immédiate</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => runAction(async () => {
          const ctx = await loadContext();
          const target = ctx.tasks.find(t => t.status !== 'done');
          if (target) await triggerDocumentReady(target);
        })}
      >
        <Feather name="file" size={18} color="#fff" />
        <Text style={styles.buttonText}>Document prêt immédiat</Text>
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
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#6E7A84',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3A82F7',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    marginTop: 12,
    color: '#2C3E50',
    fontSize: 14,
  },
  closeButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  closeText: {
    color: '#3A82F7',
    fontSize: 14,
    fontWeight: '600',
  },
});





