import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          tabBarActiveTintColor: '#111827',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: '#e5e7eb',
            borderTopWidth: 1,
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Parentia',
            tabBarLabel: 'Home',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="Tasks"
          component={TasksScreen}
          options={{
            title: 'Tâches',
            tabBarLabel: 'Tâches',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{
            title: 'Inbox',
            tabBarLabel: 'Inbox',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profil',
            tabBarLabel: 'Profil',
            tabBarIcon: () => null,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
