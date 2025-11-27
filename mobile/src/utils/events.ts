// Simple app-wide event bus for lightweight cross-screen notifications
// Works on web and mobile
export const AppEvents = new EventTarget();

export const EVENTS = {
  CITY_UPDATED: 'city-updated',
} as const;