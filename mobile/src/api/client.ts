import Constants from 'expo-constants';
import { Platform } from 'react-native';

// For web, use relative URLs (same domain as Railway)
// For mobile (Expo Go), use the configured backend URL
const BACKEND_URL = Platform.OS === 'web' 
  ? '' // Empty string = relative URLs on web
  : (Constants.expoConfig?.extra?.backendUrl || 'http://localhost:5000');

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Quote {
  type: 'morning' | 'evening';
  text: string;
}

export interface WeatherSummary {
  city: string;
  temperatureC: number;
  isRaining: boolean;
  isSnowing: boolean;
  windSpeedKmh: number;
  outfit: string;
}

export interface Task {
  id: string;
  title: string;
  deadline: string;
  category: string;
  status: 'todo' | 'in_progress' | 'done';
}

export interface NewsItem {
  title: string;
  link: string;
  source: 'Le Monde' | 'France Info';
  publishedAt: string;
  summary: string | null;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const json: ApiResponse<T> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Unknown API error');
  }
  return json.data;
}

export async function fetchQuote(): Promise<Quote> {
  return fetchApi<Quote>('/quote');
}

export async function fetchWeather(city: string): Promise<WeatherSummary> {
  return fetchApi<WeatherSummary>(`/weather?city=${encodeURIComponent(city)}`);
}

export async function fetchTasks(): Promise<{ tasks: Task[] }> {
  return fetchApi<{ tasks: Task[] }>('/tasks/today');
}

export async function fetchNews(): Promise<{ items: NewsItem[] }> {
  return fetchApi<{ items: NewsItem[] }>('/news');
}
