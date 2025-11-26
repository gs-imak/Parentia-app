import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quote } from '../api/client';

const STORAGE_KEY_CITY = 'parentia_profile_city';
const STORAGE_KEY_QUOTE = 'parentia_daily_quote';
const STORAGE_KEY_QUOTE_DATE = 'parentia_quote_date';
const STORAGE_KEY_QUOTE_TYPE = 'parentia_quote_type';

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
