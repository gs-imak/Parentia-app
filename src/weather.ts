import { z } from 'zod';
import { getProfile } from './profile.js';

const GeocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
      })
    )
    .optional(),
});

const WeatherCurrentSchema = z.object({
  temperature_2m: z.number(),
  precipitation: z.number().optional().default(0),
  snowfall: z.number().optional().default(0),
  wind_speed_10m: z.number().optional().default(0),
});

const WeatherResponseSchema = z.object({
  current: WeatherCurrentSchema,
});

export interface WeatherSummary {
  city: string;
  temperatureC: number;
  isRaining: boolean;
  isSnowing: boolean;
  windSpeedKmh: number;
  outfit: string;
}

async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; resolvedName: string }> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'fr');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur API géocoding: ${response.status}`);
  }

  const json = await response.json();
  const parsed = GeocodingResponseSchema.parse(json);

  if (!parsed.results || parsed.results.length === 0) {
    throw new Error("Ville introuvable");
  }

  const first = parsed.results[0];
  const resolvedName = first.country ? `${first.name}, ${first.country}` : first.name;
  return { latitude: first.latitude, longitude: first.longitude, resolvedName };
}

async function fetchCurrentWeather(lat: number, lon: number) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,precipitation,snowfall,wind_speed_10m');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur API météo: ${response.status}`);
  }

  const json = await response.json();
  const parsed = WeatherResponseSchema.parse(json);
  return parsed.current;
}

function buildOutfitRecommendation(tempC: number, isRaining: boolean, isSnowing: boolean, windSpeedKmh: number): string {
  const parts: string[] = [];

  if (tempC < 5) {
    parts.push('manteau épais, bonnet, gants');
  } else if (tempC >= 5 && tempC < 12) {
    parts.push('manteau chaud + pull');
  } else if (tempC >= 12 && tempC < 18) {
    parts.push('manteau léger + pull');
  } else if (tempC >= 18 && tempC < 22) {
    parts.push('t-shirt + petite veste');
  } else {
    parts.push('t-shirt léger');
  }

  if (isSnowing) {
    parts.push('combinaison + bottes neige + gants imperméables');
  } else if (isRaining) {
    parts.push('pantalon étanche + bottes + manteau imperméable');
  }

  if (windSpeedKmh >= 30) {
    parts.push('ajouter coupe-vent, bonnet léger ou tour de cou');
  }

  return parts.join(' ; ');
}

// Helper: Check if user has young children (<=15 years old) for outfit recommendations
async function shouldShowOutfit(): Promise<boolean> {
  try {
    const profile = await getProfile();
    if (profile.children.length === 0) return false;
    
    const now = new Date();
    return profile.children.some(child => {
      const birthDate = new Date(child.birthDate);
      const ageYears = (now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears <= 15;
    });
  } catch (error) {
    // If profile loading fails, default to showing outfit
    return true;
  }
}

export async function getWeatherForCity(city: string, lat?: number, lon?: number): Promise<WeatherSummary> {
  let latitude: number;
  let longitude: number;
  let resolvedName: string;

  // If coordinates are provided, use them directly (most accurate)
  if (lat !== undefined && lon !== undefined) {
    latitude = lat;
    longitude = lon;
    resolvedName = city; // Use the display city name directly
  } else {
    // Fallback to geocoding if no coordinates provided
    const geocoded = await geocodeCity(city);
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
    resolvedName = geocoded.resolvedName;
  }

  const current = await fetchCurrentWeather(latitude, longitude);

  const temperatureC = current.temperature_2m;
  const precipitation = current.precipitation ?? 0;
  const snowfall = current.snowfall ?? 0;
  const windSpeedKmh = current.wind_speed_10m ?? 0;

  const isSnowing = snowfall > 0;
  const isRaining = !isSnowing && precipitation > 0;

  // Only show outfit recommendations if user has young children
  const showOutfit = await shouldShowOutfit();
  const outfit = showOutfit ? buildOutfitRecommendation(temperatureC, isRaining, isSnowing, windSpeedKmh) : '';

  return {
    city: resolvedName,
    temperatureC,
    isRaining,
    isSnowing,
    windSpeedKmh,
    outfit,
  };
}
