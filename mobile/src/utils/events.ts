// Simple app-wide event bus for lightweight cross-screen notifications
// Works on web and mobile

class SimpleEventEmitter {
  private listeners: Map<string, Set<(event: any) => void>> = new Map();

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.delete(listener);
    }
  }

  dispatchEvent(event: Event | { type: string; detail?: any }) {
    const type = event.type;
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }
    return true;
  }
}

export const AppEvents = new SimpleEventEmitter();

export const EVENTS = {
  CITY_UPDATED: 'city-updated',
  TASKS_UPDATED: 'tasks-updated',
  PROFILE_LOADED: 'profile-loaded',
  PDF_GENERATED: 'pdf-generated',
  NOTIFICATION_TOGGLES_UPDATED: 'notification-toggles-updated',
} as const;