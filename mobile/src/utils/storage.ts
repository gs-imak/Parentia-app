import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_CITY = 'parentia_profile_city';

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
