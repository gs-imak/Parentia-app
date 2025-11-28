import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quote } from '../api/client';

const STORAGE_KEY_CITY = 'parentia_profile_city';
const STORAGE_KEY_WEATHER_CITY = 'parentia_weather_city';
const STORAGE_KEY_LOCATION_CACHE = 'parentia_location_cache';
const STORAGE_KEY_QUOTE = 'parentia_daily_quote';
const STORAGE_KEY_QUOTE_DATE = 'parentia_quote_date';
const STORAGE_KEY_QUOTE_TYPE = 'parentia_quote_type';

const LOCATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const LOCATION_PROXIMITY_THRESHOLD = 0.05; // ~5km radius

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
