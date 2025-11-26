import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeBaseProvider, extendTheme } from 'native-base';
import { Feather } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Custom theme - Apple-like design per client specs
const theme = extendTheme({
  colors: {
    // Client's exact color palette
    brand: {
      blueGray: '#2C3E50',      // Titles / important text
      mediumGray: '#6E7A84',    // Subtitles / secondary text
      lightGray: '#E9EEF2',     // Separators, borders
      blue: '#3A82F7',          // Buttons, links (accent)
      green: '#4CAF50',         // Validation
      orange: '#F7A45A',        // Near deadline
      white: '#FFFFFF',         // Background
      inputBg: '#F5F7FA',       // Form inputs background
    },
  },
  fontConfig: {
    Inter: {
      400: { normal: 'Inter-Regular' },
      500: { normal: 'Inter-Medium' },
      600: { normal: 'Inter-SemiBold' },
    },
  },
  fonts: {
    heading: 'Inter',
    body: 'Inter',
    mono: 'Inter',
  },
  fontSizes: {
    h1: 24,        // 22-24px per client
    h2: 19,        // 18-20px per client
    body: 16,      // 15-16px per client
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: 9,           // 8-10px per client
        h: 44,                     // 44px height per client
      },
      defaultProps: {
        bg: 'brand.blue',
        _text: { color: 'white', fontWeight: 600 },
        _pressed: { bg: '#2968D8' },
      },
    },
    Input: {
      baseStyle: {
        borderRadius: 10,          // 10px per client
        bg: 'brand.inputBg',
        borderColor: 'brand.lightGray',
        borderWidth: 1,
        fontSize: 16,
        h: 44,
      },
      defaultProps: {
        _focus: {
          bg: 'white',
          borderColor: 'brand.blue',
        },
      },
    },
  },
  config: {
    initialColorMode: 'light',
  },
});

export default function App() {
  // Load Inter font for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      // Apply Inter to body
      document.body.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NativeBaseProvider theme={theme}>
        <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { fontWeight: '600', fontSize: 17 },
            tabBarActiveTintColor: '#2C3E50',
            tabBarInactiveTintColor: '#6E7A84',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopColor: '#E9EEF2',
              borderTopWidth: 1,
              paddingBottom: Platform.OS === 'ios' ? 20 : 10,
              height: Platform.OS === 'ios' ? 85 : 65,
            },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Parentia',
              tabBarLabel: 'Home',
              tabBarIcon: ({ color, size }) => (
                <Feather name="home" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Tasks"
            component={TasksScreen}
            options={{
              title: 'Tâches',
              tabBarLabel: 'Tâches',
              tabBarIcon: ({ color, size }) => (
                <Feather name="check-circle" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Inbox"
            component={InboxScreen}
            options={{
              title: 'Inbox',
              tabBarLabel: 'Inbox',
              tabBarIcon: ({ color, size }) => (
                <Feather name="inbox" size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'Profil',
              tabBarLabel: 'Profil',
              tabBarIcon: ({ color, size }) => (
                <Feather name="user" size={size} color={color} />
              ),
            }}
          />
        </Tab.Navigator>
        </NavigationContainer>
      </NativeBaseProvider>
    </SafeAreaProvider>
  );
}
