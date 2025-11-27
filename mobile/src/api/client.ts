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

export type TaskCategory = 'administratif' | 'enfants-école' | 'santé' | 'finances' | 'personnel';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  deadline: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  isRecurring?: boolean;
  recurringSource?: string;
}

export interface NewsItem {
  title: string;
  link: string;
  source: 'Le Monde' | 'France Info';
  publishedAt: string;
  summary: string | null;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, options);
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

export async function reverseGeocode(lat: number, lon: number): Promise<{ city: string; postcode?: string; cityName?: string; country?: string }> {
  return fetchApi<{ city: string }>(`/geocode/reverse?lat=${lat}&lon=${lon}`);
}

export async function geolocateByIP(): Promise<{ city: string; postcode?: string; cityName?: string; country?: string }> {
  return fetchApi<{ city: string }>(`/geocode/ip`);
}

// Task CRUD operations
export async function createTask(data: { title: string; category: TaskCategory; deadline: string; description?: string }): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getAllTasks(): Promise<{ tasks: Task[] }> {
  return fetchApi<{ tasks: Task[] }>('/tasks');
}

export async function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> {
  return fetchApi<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`${BACKEND_URL}/tasks/${id}`, { method: 'DELETE' });
}

// Profile types
export interface Child {
  id: string;
  firstName: string;
  birthDate: string;
  height?: number;
  weight?: number;
  notes?: string;
}

export interface Spouse {
  firstName: string;
  birthDate?: string;
}

export interface Profile {
  children: Child[];
  spouse?: Spouse;
  marriageDate?: string;
}

// Profile CRUD operations
export async function getProfile(): Promise<Profile> {
  return fetchApi<Profile>('/profile');
}

export async function addChild(data: { firstName: string; birthDate: string; height?: number; weight?: number; notes?: string }): Promise<Child> {
  return fetchApi<Child>('/profile/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateChild(id: string, updates: Partial<Omit<Child, 'id'>>): Promise<Child> {
  return fetchApi<Child>(`/profile/children/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteChild(id: string): Promise<void> {
  await fetch(`${BACKEND_URL}/profile/children/${id}`, { method: 'DELETE' });
}

export async function updateSpouse(data: { firstName: string; birthDate?: string }): Promise<Profile> {
  return fetchApi<Profile>('/profile/spouse', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteSpouse(): Promise<Profile> {
  return fetchApi<Profile>('/profile/spouse', { method: 'DELETE' });
}

export async function updateMarriageDate(date: string): Promise<Profile> {
  return fetchApi<Profile>('/profile/marriage-date', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  });
}

export async function deleteMarriageDate(): Promise<Profile> {
  return fetchApi<Profile>('/profile/marriage-date', { method: 'DELETE' });
}
