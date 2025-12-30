import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quote } from '../api/client';

const STORAGE_KEY_CITY = 'parentia_profile_city';
const STORAGE_KEY_WEATHER_CITY = 'parentia_weather_city';
const STORAGE_KEY_COORDINATES = 'parentia_coordinates';
const STORAGE_KEY_LOCATION_CACHE = 'parentia_location_cache';
const STORAGE_KEY_QUOTE = 'parentia_daily_quote';
const STORAGE_KEY_QUOTE_DATE = 'parentia_quote_date';
const STORAGE_KEY_QUOTE_TYPE = 'parentia_quote_type';
const STORAGE_KEY_NOTIF_PERMISSIONS = 'parentia_notif_permissions';
const STORAGE_KEY_TOGGLE_MORNING = 'parentia_toggle_morning';
const STORAGE_KEY_TOGGLE_J1 = 'parentia_toggle_j1';
const STORAGE_KEY_TOGGLE_EVENING = 'parentia_toggle_evening';
const STORAGE_KEY_TOGGLE_OVERDUE = 'parentia_toggle_overdue';
const STORAGE_KEY_TOGGLE_SMART = 'parentia_toggle_smart';

const LOCATION_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours (refresh more frequently)
const LOCATION_PROXIMITY_THRESHOLD = 0.01; // ~1km radius (much tighter for accuracy)

export async function getStoredCity(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY_CITY);
  } catch {
    return null;
  }
}

export async function setStoredCity(city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_CITY, city);
  } catch {
    // ignore storage errors
  }
}

export async function getStoredWeatherCity(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY_WEATHER_CITY);
  } catch {
    return null;
  }
}

export async function setStoredWeatherCity(city: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_WEATHER_CITY, city);
  } catch {
    // ignore storage errors
  }
}

export async function getStoredCoordinates(): Promise<{ lat: number; lon: number } | null> {
  try {
    const coords = await AsyncStorage.getItem(STORAGE_KEY_COORDINATES);
    return coords ? JSON.parse(coords) : null;
  } catch {
    return null;
  }
}

export async function setStoredCoordinates(lat: number, lon: number): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_COORDINATES, JSON.stringify({ lat, lon }));
  } catch {
    // ignore storage errors
  }
}

interface LocationCache {
  city: string;
  weatherCity: string;
  coordinates: { lat: number; lon: number };
  timestamp: number;
}

export async function getCachedLocation(currentLat: number, currentLon: number): Promise<{ city: string; weatherCity: string } | null> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY_LOCATION_CACHE);
    if (!cached) return null;

    const data: LocationCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - data.timestamp > LOCATION_CACHE_DURATION) {
      return null;
    }

    // Check if user is still in the same area (within ~5km)
    const latDiff = Math.abs(data.coordinates.lat - currentLat);
    const lonDiff = Math.abs(data.coordinates.lon - currentLon);
    
    if (latDiff < LOCATION_PROXIMITY_THRESHOLD && lonDiff < LOCATION_PROXIMITY_THRESHOLD) {
      return { city: data.city, weatherCity: data.weatherCity };
    }

    return null;
  } catch {
    return null;
  }
}

export async function setCachedLocation(city: string, weatherCity: string, lat: number, lon: number): Promise<void> {
  try {
    const cache: LocationCache = {
      city,
      weatherCity,
      coordinates: { lat, lon },
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY_LOCATION_CACHE, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

// Get current time period (morning: 5h-17h, evening: 17h-5h)
function getCurrentPeriod(): 'morning' | 'evening' {
  const hour = new Date().getHours();
  return hour >= 5 && hour < 17 ? 'morning' : 'evening';
}

// Get today's date as string (YYYY-MM-DD)
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getStoredQuote(): Promise<Quote | null> {
  try {
    const storedDate = await AsyncStorage.getItem(STORAGE_KEY_QUOTE_DATE);
    const storedType = await AsyncStorage.getItem(STORAGE_KEY_QUOTE_TYPE);
    const storedQuote = await AsyncStorage.getItem(STORAGE_KEY_QUOTE);

    const today = getTodayDate();
    const currentPeriod = getCurrentPeriod();

    // Check if we have a quote for today and the current period
    if (storedDate === today && storedType === currentPeriod && storedQuote) {
      return JSON.parse(storedQuote);
    }

    return null;
  } catch {
    return null;
  }
}

export async function setStoredQuote(quote: Quote): Promise<void> {
  try {
    const today = getTodayDate();
    const currentPeriod = getCurrentPeriod();

    await AsyncStorage.setItem(STORAGE_KEY_QUOTE, JSON.stringify(quote));
    await AsyncStorage.setItem(STORAGE_KEY_QUOTE_DATE, today);
    await AsyncStorage.setItem(STORAGE_KEY_QUOTE_TYPE, currentPeriod);
  } catch {
    // ignore storage errors
  }
}

export interface StoredNotificationPermission {
  status: 'granted' | 'denied' | 'undetermined';
  updatedAt: string;
}

async function setBoolean(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // ignore
  }
}

async function getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setNotificationPermissionStatus(status: StoredNotificationPermission['status']): Promise<void> {
  try {
    const payload: StoredNotificationPermission = { status, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEY_NOTIF_PERMISSIONS, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export async function getNotificationPermissionStatus(): Promise<StoredNotificationPermission | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_NOTIF_PERMISSIONS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setMorningNotificationEnabled(value: boolean): Promise<void> {
  return setBoolean(STORAGE_KEY_TOGGLE_MORNING, value);
}
export async function getMorningNotificationEnabled(): Promise<boolean> {
  return getBoolean(STORAGE_KEY_TOGGLE_MORNING, true);
}

export async function setJ1NotificationEnabled(value: boolean): Promise<void> {
  return setBoolean(STORAGE_KEY_TOGGLE_J1, value);
}
export async function getJ1NotificationEnabled(): Promise<boolean> {
  return getBoolean(STORAGE_KEY_TOGGLE_J1, true);
}

export async function setEveningNotificationEnabled(value: boolean): Promise<void> {
  return setBoolean(STORAGE_KEY_TOGGLE_EVENING, value);
}
export async function getEveningNotificationEnabled(): Promise<boolean> {
  return getBoolean(STORAGE_KEY_TOGGLE_EVENING, true);
}

export async function setOverdueNotificationEnabled(value: boolean): Promise<void> {
  return setBoolean(STORAGE_KEY_TOGGLE_OVERDUE, value);
}
export async function getOverdueNotificationEnabled(): Promise<boolean> {
  return getBoolean(STORAGE_KEY_TOGGLE_OVERDUE, true);
}

export async function setSmartNotificationsEnabled(value: boolean): Promise<void> {
  return setBoolean(STORAGE_KEY_TOGGLE_SMART, value);
}
export async function getSmartNotificationsEnabled(): Promise<boolean> {
  return getBoolean(STORAGE_KEY_TOGGLE_SMART, true);
}

// Track which email task IDs have already been notified to avoid duplicate notifications
const STORAGE_KEY_PROCESSED_EMAIL_TASKS = 'parentia_processed_email_tasks';

export async function getStoredProcessedEmailTaskIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PROCESSED_EMAIL_TASKS);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function setStoredProcessedEmailTaskIds(ids: Set<string>): Promise<void> {
  try {
    // Keep only the last 100 IDs to prevent storage bloat
    const arr = Array.from(ids).slice(-100);
    await AsyncStorage.setItem(STORAGE_KEY_PROCESSED_EMAIL_TASKS, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}
