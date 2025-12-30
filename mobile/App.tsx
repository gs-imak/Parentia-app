import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import { type Task } from './src/api/client';
import NotificationsDebugScreen from './src/screens/NotificationsDebugScreen';
import { getProfile, getAllTasks, getTaskById, fetchWeather, fetchQuote, registerPushToken } from './src/api/client';
import { rescheduleAllNotifications, handleNotificationResponse, setupNotificationCategories } from './src/notifications/NotificationScheduler';
import { AppEvents, EVENTS } from './src/utils/events';
import { getStoredCity } from './src/utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tasksCache, setTasksCache] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const [tasksFilter, setTasksFilter] = useState<string | null>(null);
  const [filterTaskIds, setFilterTaskIds] = useState<string[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [profileKey, setProfileKey] = useState(0);
  
  // Secret tap gesture to access debug screen (3 quick taps)
  const [debugTapCount, setDebugTapCount] = useState(0);
  const debugTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleSecretTap = useCallback(() => {
    setDebugTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setShowDebug(true);
        return 0;
      }
      return newCount;
    });
    
    if (debugTapTimeoutRef.current) clearTimeout(debugTapTimeoutRef.current);
    debugTapTimeoutRef.current = setTimeout(() => setDebugTapCount(0), 1000);
  }, []);

  const handleOpenTaskDetail = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleCloseTaskDetail = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskUpdated = useCallback((updatedTask: Task) => {
    setSelectedTask(updatedTask);
    // Trigger refresh in background screens
    setRefreshTrigger(prev => prev + 1);
    setTasksCache(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    tasksRef.current = tasksRef.current.map(t => t.id === updatedTask.id ? updatedTask : t);
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setSelectedTask(null);
    // Trigger refresh in background screens
    setRefreshTrigger(prev => prev + 1);
    setTasksCache(prev => prev.filter(t => t.id !== taskId));
    tasksRef.current = tasksRef.current.filter(t => t.id !== taskId);
  }, []);

  const refreshAndSchedule = useCallback(async () => {
    try {
      const [profile, tasks, city, quoteResp] = await Promise.all([
        getProfile(),
        getAllTasks(),
        getStoredCity(),
        fetchQuote().catch(() => null),
      ]);
      setTasksCache(tasks.tasks);
      tasksRef.current = tasks.tasks;
      let weather = undefined;
      if (city) {
        try {
          weather = await fetchWeather(city);
        } catch {
          weather = undefined;
        }
      }
      const eveningQuote = quoteResp && quoteResp.type === 'evening' ? quoteResp.text : undefined;
      await rescheduleAllNotifications({
        tasks: tasks.tasks,
        profile,
        weather,
        quoteEvening: eveningQuote,
      });
    } catch (error) {
      // best effort
    }
  }, []);

  // Request notification permissions and register push token on app init
  useEffect(() => {
    const setupPushNotifications = async () => {
      if (Platform.OS === 'web') return; // Skip on web
      
      try {
        // Step 1: Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }
        
        // Step 2: Get Expo Push Token
        // Use project ID from app.json extra.eas.projectId
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.warn('[Push] No project ID found in app.json');
          return;
        }
        
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token = tokenData.data;
        console.log('[Push] Token:', token.substring(0, 30) + '...');
        
        // Step 3: Register token with backend
        await registerPushToken(token);
        console.log('[Push] Token registered with backend');
      } catch (error) {
        console.warn('[Push] Setup failed:', error);
      }
    };
    
    setupPushNotifications();
  }, []);

  // Reset Profile sections when app returns from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Increment profileKey to reset Profile sections to collapsed state
        setProfileKey(prev => prev + 1);
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Set up notification categories with action buttons (must be done before scheduling)
    setupNotificationCategories();
    
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const { actionTaken } = await handleNotificationResponse(response, tasksRef.current);
      
      // Refresh app state after action (delete/delay)
      await refreshAndSchedule();
      setRefreshTrigger(prev => prev + 1);
      
      // If an action was taken (delete/delay), don't navigate - task was handled
      if (actionTaken) return;
      
      const meta = response.notification.request.content.data as any;
      const deepLink = meta?.deepLink as { route?: string; params?: any } | undefined;
      if (deepLink?.route === 'tasks') {
        setTasksFilter(deepLink.params?.filter ?? null);
        setFilterTaskIds(deepLink.params?.taskIds ?? null);
        setActiveTab('Tasks');
      }
      if (deepLink?.route === 'taskDetail' && deepLink.params?.taskId) {
        try {
          const task = await getTaskById(deepLink.params.taskId);
          setSelectedTask(task);
        } catch {
          setActiveTab('Tasks');
        }
      }
    });

    const onEvents = async () => {
      await refreshAndSchedule();
    };
    // @ts-ignore
    AppEvents.addEventListener(EVENTS.TASKS_UPDATED, onEvents);
    // @ts-ignore
    AppEvents.addEventListener(EVENTS.PROFILE_LOADED, onEvents);
    // @ts-ignore
    AppEvents.addEventListener(EVENTS.NOTIFICATION_TOGGLES_UPDATED, onEvents);

    refreshAndSchedule();

    return () => {
      subResponse.remove();
      // @ts-ignore
      AppEvents.removeEventListener(EVENTS.TASKS_UPDATED, onEvents);
      // @ts-ignore
      AppEvents.removeEventListener(EVENTS.PROFILE_LOADED, onEvents);
      // @ts-ignore
      AppEvents.removeEventListener(EVENTS.NOTIFICATION_TOGGLES_UPDATED, onEvents);
    };
  }, [refreshAndSchedule]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
      case 'Tasks':
        return (
          <TasksScreen
            onOpenTaskDetail={handleOpenTaskDetail}
            refreshTrigger={refreshTrigger}
            initialFilter={tasksFilter ?? undefined}
            filterTaskIds={filterTaskIds ?? undefined}
          />
        );
      case 'Inbox':
        return <InboxScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
      case 'Profile':
        return <ProfileScreen key={profileKey} />;
      default:
        return <HomeScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text
            style={styles.headerTitle}
            onPress={handleSecretTap}
          >
            HC Family
          </Text>
        </View>
        <View style={styles.content}>
          {showDebug ? <NotificationsDebugScreen onClose={() => setShowDebug(false)} /> : renderScreen()}
        </View>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('Home')}
          >
            <Feather
              name="home"
              size={24}
              color={activeTab === 'Home' ? '#2C3E50' : '#6E7A84'}
            />
            <Text style={[styles.tabLabel, activeTab === 'Home' && styles.tabLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('Tasks')}
          >
            <Feather
              name="check-circle"
              size={24}
              color={activeTab === 'Tasks' ? '#2C3E50' : '#6E7A84'}
            />
            <Text style={[styles.tabLabel, activeTab === 'Tasks' && styles.tabLabelActive]}>
              Tâches
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('Inbox')}
          >
            <Feather
              name="inbox"
              size={24}
              color={activeTab === 'Inbox' ? '#2C3E50' : '#6E7A84'}
            />
            <Text style={[styles.tabLabel, activeTab === 'Inbox' && styles.tabLabelActive]}>
              Inbox
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => {
              setProfileKey(prev => prev + 1);
              setActiveTab('Profile');
            }}
          >
            <Feather
              name="user"
              size={24}
              color={activeTab === 'Profile' ? '#2C3E50' : '#6E7A84'}
            />
            <Text style={[styles.tabLabel, activeTab === 'Profile' && styles.tabLabelActive]}>
              Profil
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailScreen
            task={selectedTask}
            onClose={handleCloseTaskDetail}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EEF2',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2C3E50',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9EEF2',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    color: '#6E7A84',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#2C3E50',
  },
});
