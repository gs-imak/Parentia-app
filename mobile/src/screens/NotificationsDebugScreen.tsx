import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getProfile, getAllTasks, fetchWeather, fetchQuote, updateTask, deleteTask } from '../api/client';
import { rescheduleAllNotifications, triggerUrgentTask, triggerNearDeadlineTask } from '../notifications/NotificationScheduler';
import { getStoredCity, getStoredCoordinates } from '../utils/storage';
import * as Notifications from 'expo-notifications';

// BUILD VERSION - used to verify correct build is running
const DEBUG_BUILD_VERSION = '2026-01-10-v9-DELETE-BUTTON-FIX';

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
      // Don't set generic "Action exécutée" - let the action itself set status
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

      {/* ===================== CRITICAL TESTS ===================== */}
      <View style={styles.criticalSection}>
        <Text style={styles.criticalTitle}>⚠️ TESTS CRITIQUES (Matthieu)</Text>
        
        {/* Test 1: Show task breakdown */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#7C3AED' }]}
          onPress={() => runAction(async () => {
            const ctx = await loadContext();
            const now = new Date();
            
            console.log('[Debug] Current time:', now.toISOString());
            console.log('[Debug] Total tasks:', ctx.tasks.length);
            
            if (ctx.tasks.length === 0) {
              throw new Error('❌ AUCUNE TÂCHE dans l\'app!');
            }
            
            // Show ALL tasks with their deadlines
            let report = `📊 DIAGNOSTIC COMPLET\n\n`;
            report += `Heure actuelle: ${now.toLocaleString('fr-FR')}\n\n`;
            report += `Total tâches: ${ctx.tasks.length}\n\n`;
            
            // Show each task with its deadline
            report += `📋 TOUTES VOS TÂCHES:\n`;
            ctx.tasks.forEach((t: any) => {
              const deadline = new Date(t.deadline);
              const status = t.status === 'done' ? '✅' : '⏳';
              report += `${status} ${t.title}\n`;
              report += `   Deadline: ${deadline.toLocaleString('fr-FR')}\n`;
              report += `   Status: ${t.status}\n\n`;
            });
            
            // Now compute relative to TODAY
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const overdue = ctx.tasks.filter((t: any) => {
              const d = new Date(t.deadline);
              d.setHours(0, 0, 0, 0);
              return d < today && t.status !== 'done';
            });
            
            const dueToday = ctx.tasks.filter((t: any) => {
              const d = new Date(t.deadline);
              d.setHours(0, 0, 0, 0);
              return d >= today && d < tomorrow && t.status !== 'done';
            });
            
            report += `\n🔍 ANALYSE (par rapport à AUJOURD'HUI ${today.toLocaleDateString('fr-FR')}):\n`;
            report += `• Tâches en retard: ${overdue.length}\n`;
            report += `• Tâches du jour: ${dueToday.length}\n\n`;
            
            if (overdue.length > 0) {
              report += `⚠️ EN RETARD:\n`;
              overdue.forEach((t: any) => report += `• ${t.title}\n`);
            } else {
              report += `✅ Aucune tâche en retard\n`;
            }
            
            if (dueToday.length > 0) {
              report += `\n📅 AUJOURD'HUI:\n`;
              dueToday.forEach((t: any) => report += `• ${t.title}\n`);
            }
            
            setStatus(report);
          })}
        >
          <Feather name="list" size={18} color="#fff" />
          <Text style={styles.buttonText}>1. Diagnostic des tâches</Text>
        </TouchableOpacity>
        
        {/* Test 2: Test overdue notification with action buttons */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#DC2626' }]}
          onPress={() => runAction(async () => {
            const ctx = await loadContext();
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            
            const overdueTasks = ctx.tasks.filter((task: any) => {
              const deadline = new Date(task.deadline);
              deadline.setHours(0, 0, 0, 0);
              return deadline < today && task.status !== 'done';
            });
            
            if (overdueTasks.length === 0) {
              throw new Error('Aucune tâche en retard. Créez une tâche avec deadline passée pour tester.');
            }
            
            // Send notification for ALL overdue tasks (max 5, like the real scheduler)
            const tasksToNotify = overdueTasks.slice(0, 5);
            
            for (let i = 0; i < tasksToNotify.length; i++) {
              const task = tasksToNotify[i];
              const deadlineDate = new Date(task.deadline);
              const daysOverdue = Math.floor((today.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
              const overdueText = daysOverdue === 1 ? '1 jour de retard' : `${daysOverdue} jours de retard`;
              
              // Schedule each task with a slight delay between them
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🔴 TEST ACTION BUTTONS',
                  body: `« ${task.title} » - ${overdueText}`,
                  data: { type: 'overdue', taskId: task.id, deepLink: { route: 'taskDetail', params: { taskId: task.id } } },
                  sound: true,
                  categoryIdentifier: 'OVERDUE_TASK',
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 + i, repeats: false },
              });
            }
            
            setStatus(`✅ ${tasksToNotify.length} NOTIFICATIONS PROGRAMMÉES\n\n📱 ÉTAPES À SUIVRE:\n\n1️⃣ Attendez les notifications (5s, 6s, 7s...)\n   → 1 notification par tâche\n\n2️⃣ TIREZ VERS LE BAS sur chaque notification\n   → Les 3 boutons doivent apparaître:\n   • +1 jour\n   • +3 jours  \n   • Supprimer\n\n3️⃣ Testez un bouton sur UNE notification\n\n4️⃣ Allez dans "Tâches" pour vérifier\n\nTâches:\n${tasksToNotify.map(t => `• ${t.title}`).join('\n')}\n\n⚠️ SI LES BOUTONS N'APPARAISSENT PAS:\n   → Bug de catégorie\n\n⚠️ SI BOUTONS VISIBLES MAIS ACTION NE MARCHE PAS:\n   → Bug dans handleNotificationResponse`);
          })}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={styles.buttonText}>2. Test boutons (toutes tâches)</Text>
        </TouchableOpacity>
        
        {/* Test 3: Manually delete a task via API to verify API works */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#059669' }]}
          onPress={() => runAction(async () => {
            const ctx = await loadContext();
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            
            console.log('[Debug] Total tasks:', ctx.tasks.length);
            
            if (ctx.tasks.length === 0) {
              throw new Error('❌ AUCUNE TÂCHE dans l\'app!\n\n👉 Créez au moins 1 tâche avec une deadline PASSÉE pour tester.');
            }
            
            const overdueTasks = ctx.tasks.filter((task: any) => {
              const deadline = new Date(task.deadline);
              deadline.setHours(0, 0, 0, 0);
              return deadline < today && task.status !== 'done';
            });
            
            console.log('[Debug] Overdue tasks:', overdueTasks.length);
            
            if (overdueTasks.length === 0) {
              const allTasksList = ctx.tasks.map((t: any) => `• ${t.title} (${new Date(t.deadline).toLocaleDateString('fr-FR')})`).join('\n');
              throw new Error(`❌ AUCUNE tâche EN RETARD!\n\nVos ${ctx.tasks.length} tâches:\n${allTasksList}\n\n👉 Créez une tâche avec deadline PASSÉE.`);
            }
            
            const task = overdueTasks[0];
            console.log('[Debug] Attempting to delete task:', task.id, task.title);
            
            // Test the deleteTask API directly
            try {
              await deleteTask(task.id);
              console.log('[Debug] Delete successful');
              
              // Verify it's gone
              const updatedTasks = await getAllTasks();
              const stillExists = updatedTasks.tasks.find((t: any) => t.id === task.id);
              
              if (stillExists) {
                throw new Error(`❌ ÉCHEC! Tâche toujours présente après delete!\n\nTâche: "${task.title}"\nID: ${task.id}`);
              }
              
              setStatus(`✅ API DELETE FONCTIONNE!\n\nTâche supprimée: "${task.title}"\nID: ${task.id}\n\n✅ VÉRIFICATION: Tâche absente de la liste\n\n👉 Si ce bouton fonctionne mais pas les boutons de notification, le problème est dans le handling des actions.`);
            } catch (error: any) {
              console.error('[Debug] Delete failed:', error);
              throw new Error(`❌ API DELETE A ÉCHOUÉ!\n\nTâche: "${task.title}"\nID: ${task.id}\n\nErreur: ${error.message}\n\n👉 Vérifiez que le backend est démarré!`);
            }
          })}
        >
          <Feather name="check-circle" size={18} color="#fff" />
          <Text style={styles.buttonText}>3. Test API Delete (direct)</Text>
        </TouchableOpacity>
        
        {/* Test 4: Manually delay a task via API to verify API works */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#0891B2' }]}
          onPress={() => runAction(async () => {
            const ctx = await loadContext();
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            
            console.log('[Debug] Total tasks:', ctx.tasks.length);
            
            if (ctx.tasks.length === 0) {
              throw new Error('❌ AUCUNE TÂCHE dans l\'app!\n\n👉 Créez au moins 1 tâche avec une deadline PASSÉE pour tester.');
            }
            
            const overdueTasks = ctx.tasks.filter((task: any) => {
              const deadline = new Date(task.deadline);
              deadline.setHours(0, 0, 0, 0);
              return deadline < today && task.status !== 'done';
            });
            
            console.log('[Debug] Overdue tasks:', overdueTasks.length);
            
            if (overdueTasks.length === 0) {
              const allTasksList = ctx.tasks.map((t: any) => `• ${t.title} (${new Date(t.deadline).toLocaleDateString('fr-FR')})`).join('\n');
              throw new Error(`❌ AUCUNE tâche EN RETARD!\n\nVos ${ctx.tasks.length} tâches:\n${allTasksList}\n\n👉 Créez une tâche avec deadline PASSÉE.`);
            }
            
            const task = overdueTasks[0];
            const oldDeadline = new Date(task.deadline);
            console.log('[Debug] Attempting to delay task:', task.id, task.title);
            
            // Test the updateTask API directly (delay by 1 day from today)
            const newDeadline = new Date(today);
            newDeadline.setDate(newDeadline.getDate() + 1);
            
            try {
              await updateTask(task.id, { deadline: newDeadline.toISOString() });
              console.log('[Debug] Update successful');
              
              // Verify it changed
              const updatedTasks = await getAllTasks();
              const updatedTask = updatedTasks.tasks.find((t: any) => t.id === task.id);
              
              if (!updatedTask) {
                throw new Error('❌ Tâche introuvable après update!');
              }
              
              const actualNewDeadline = new Date(updatedTask.deadline);
              actualNewDeadline.setHours(0, 0, 0, 0);
              
              if (actualNewDeadline.getTime() !== newDeadline.getTime()) {
                throw new Error(`❌ Deadline n'a pas changé!\nAttendu: ${newDeadline.toISOString()}\nActuel: ${updatedTask.deadline}`);
              }
              
              setStatus(`✅ API UPDATE FONCTIONNE!\n\nTâche: "${task.title}"\nAncienne deadline: ${oldDeadline.toLocaleDateString('fr-FR')}\nNouvelle deadline: ${newDeadline.toLocaleDateString('fr-FR')}\n\n✅ VÉRIFICATION: Deadline mise à jour\n\n👉 Si ce bouton fonctionne mais pas "+1 jour" de la notification, le problème est dans le handling des actions.`);
            } catch (error: any) {
              console.error('[Debug] Update failed:', error);
              throw new Error(`❌ API UPDATE A ÉCHOUÉ!\n\nTâche: "${task.title}"\nID: ${task.id}\n\nErreur: ${error.message}\n\n👉 Vérifiez que le backend est démarré!`);
            }
          })}
        >
          <Feather name="calendar" size={18} color="#fff" />
          <Text style={styles.buttonText}>4. Test API Décaler +1j (direct)</Text>
        </TouchableOpacity>
        
        {/* Test 5: EXACT morning 7h30 notification - SIMULATES REAL SCENARIO */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#F59E0B' }]}
          onPress={() => runAction(async () => {
            const ctx = await loadContext();
            const now = new Date();
            
            // CRITICAL: Simulate EXACT same logic as NotificationScheduler.ts
            // If it's past 7:30 AM, the notification is scheduled for TOMORROW
            // So we must compute tasks for TOMORROW's perspective
            const morningTriggerTime = new Date(now);
            morningTriggerTime.setHours(7, 30, 0, 0);
            const isScheduledForTomorrow = now > morningTriggerTime;
            
            // Compute the effective date (today or tomorrow based on current time)
            const effectiveDate = new Date(now);
            if (isScheduledForTomorrow) {
              effectiveDate.setDate(effectiveDate.getDate() + 1);
            }
            effectiveDate.setHours(0, 0, 0, 0);
            
            const nextDay = new Date(effectiveDate);
            nextDay.setDate(nextDay.getDate() + 1);
            
            // Compute tasks for the EFFECTIVE date (not current date!)
            const overdue = ctx.tasks.filter((t: any) => {
              const d = new Date(t.deadline);
              d.setHours(0, 0, 0, 0);
              return d < effectiveDate && t.status !== 'done';
            });
            
            const dueOnEffectiveDate = ctx.tasks.filter((t: any) => {
              const d = new Date(t.deadline);
              d.setHours(0, 0, 0, 0);
              return d >= effectiveDate && d < nextDay && t.status !== 'done';
            });
            
            const overdueCount = overdue.length;
            const todayCount = dueOnEffectiveDate.length;
            
            // Build task section - EXACT same logic as scheduler
            let taskSection: string;
            if (todayCount > 0) {
              const todayLines = dueOnEffectiveDate.slice(0, 3).map((t: any) => `• ${t.title}`).join('\n');
              taskSection = `Vos démarches du jour :\n${todayLines}`;
              if (overdueCount > 0) {
                taskSection += `\n\n⚠️ ${overdueCount} tâche(s) en retard`;
              }
            } else if (overdueCount > 0) {
              const overdueLines = overdue.slice(0, 3).map((t: any) => `• ${t.title}`).join('\n');
              taskSection = `⚠️ Vous avez ${overdueCount} tâche(s) en retard :\n${overdueLines}`;
            } else {
              taskSection = "Vous n'avez aucune démarche prévue aujourd'hui.";
            }
            
            const greeting = ctx.profile.firstName ? `Bonjour ${ctx.profile.firstName},` : 'Bonjour,';
            const bodyParts = [greeting];
            
            if (ctx.weather) {
              bodyParts.push(`Météo: ${Math.round(ctx.weather.temperatureC)}°C · ${ctx.weather.outfit || ''}`.trim());
            }
            
            bodyParts.push(taskSection);
            bodyParts.push('Bonne journée.');
            
            const notificationBody = bodyParts.join('\n');
            
            // Send the exact notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: isScheduledForTomorrow ? '☀️ TEST NOTIF DEMAIN 7h30' : '☀️ TEST NOTIF AUJOURD\'HUI 7h30',
                body: notificationBody,
                data: { type: 'morning', deepLink: { route: 'tasks', params: { filter: 'today' } } },
                sound: true,
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
            });
            
            // Build diagnostic
            const effectiveDateStr = effectiveDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            let diagnostic = `✅ NOTIFICATION ENVOYÉE (3s)\n\n`;
            diagnostic += `⏰ SIMULATION:\n`;
            diagnostic += `• Heure actuelle: ${now.toLocaleTimeString('fr-FR')}\n`;
            diagnostic += `• Passé 7h30: ${isScheduledForTomorrow ? 'OUI → notif pour DEMAIN' : 'NON → notif pour AUJOURD\'HUI'}\n`;
            diagnostic += `• Date effective: ${effectiveDateStr}\n\n`;
            
            diagnostic += `📊 TÂCHES (du point de vue de ${effectiveDateStr}):\n`;
            diagnostic += `• Tâches du jour: ${todayCount}\n`;
            diagnostic += `• Tâches en retard: ${overdueCount}\n\n`;
            
            if (todayCount > 0) {
              diagnostic += `✅ CORRECT: Affiche "Vos démarches du jour"\n`;
              diagnostic += `Tâches: ${dueOnEffectiveDate.map((t: any) => t.title).join(', ')}\n`;
            } else if (overdueCount > 0) {
              diagnostic += `⚠️ Affiche tâches en retard (NORMAL si 0 tâches du jour)\n`;
            }
            
            diagnostic += `\n📱 CONTENU:\n${notificationBody}`;
            
            setStatus(diagnostic);
          })}
        >
          <Feather name="sun" size={18} color="#fff" />
          <Text style={styles.buttonText}>5. Test Notif 7h30 (simule demain)</Text>
        </TouchableOpacity>
      </View>

      {/* ===================== AUTRES TESTS ===================== */}
      <Text style={styles.sectionTitle}>Autres tests</Text>

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
    marginBottom: 4,
    color: '#2C3E50',
  },
  version: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
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
  criticalSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  criticalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 12,
  },
});
