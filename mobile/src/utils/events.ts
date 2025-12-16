// Simple app-wide event bus for lightweight cross-screen notifications
// Works on web and mobile
export const AppEvents = new EventTarget();

export const EVENTS = {
  CITY_UPDATED: 'city-updated',
  TASKS_UPDATED: 'tasks-updated',
  PROFILE_LOADED: 'profile-loaded',
  PDF_GENERATED: 'pdf-generated',
  NOTIFICATION_TOGGLES_UPDATED: 'notification-toggles-updated',
} as const;