import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import { type Task } from './src/api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
  }, []);

  const handleTaskDeleted = useCallback((taskId: string) => {
    setSelectedTask(null);
    // Trigger refresh in background screens
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
      case 'Tasks':
        return <TasksScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
      case 'Inbox':
        return <InboxScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
      case 'Profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen onOpenTaskDetail={handleOpenTaskDetail} refreshTrigger={refreshTrigger} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>H&C Family</Text>
      </View>
      <View style={styles.content}>
        {renderScreen()}
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
          onPress={() => setActiveTab('Profile')}
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
