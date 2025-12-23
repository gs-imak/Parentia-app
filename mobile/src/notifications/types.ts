import { Task, Profile, WeatherSummary } from '../api/client';

export type NotificationType =
  | 'morning'
  | 'j1'
  | 'evening'
  | 'overdue'
  | 'urgent'
  | 'rain_children'
  | 'document_ready'
  | 'weekend_simple';

export interface SchedulerContext {
  tasks: Task[];
  profile: Profile;
  weather?: WeatherSummary;
  quoteEvening?: string;
  now?: Date;
  pdfReadyTaskIds?: Set<string>;
}

export interface DeepLinkPayload {
  route: 'tasks' | 'taskDetail';
  params?: Record<string, any>;
}

export interface NotificationMeta {
  type: NotificationType;
  deepLink?: DeepLinkPayload;
  taskId?: string;
}












