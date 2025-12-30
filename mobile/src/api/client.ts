import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { AppEvents, EVENTS } from '../utils/events';

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

export type TaskCategory = 'administratif' | 'enfants-école' | 'santé' | 'finances' | 'logement' | 'personnel';
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
  source?: 'manual' | 'email' | 'profile' | 'photo';
  emailId?: string;
  imageUrl?: string;
  // Milestone 5: Contact info and PDF suggestions
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  suggestedTemplates?: string[];
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

export async function fetchWeather(city: string, coords?: { lat: number; lon: number }): Promise<WeatherSummary> {
  const params = new URLSearchParams({ city });
  if (coords) {
    params.append('lat', coords.lat.toString());
    params.append('lon', coords.lon.toString());
  }
  return fetchApi<WeatherSummary>(`/weather?${params.toString()}`);
}

export async function fetchTasks(): Promise<{ tasks: Task[] }> {
  return fetchApi<{ tasks: Task[] }>('/tasks/today');
}

export async function fetchNews(): Promise<{ items: NewsItem[] }> {
  return fetchApi<{ items: NewsItem[] }>('/news');
}

export interface GeocodeResponse {
  city: string;
  weatherCity: string;
  postcode?: string;
  cityName?: string;
  country?: string;
  coordinates?: { lat: number; lon: number };
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResponse> {
  return fetchApi<GeocodeResponse>(`/geocode/reverse?lat=${lat}&lon=${lon}`);
}

export async function geolocateByIP(): Promise<GeocodeResponse> {
  return fetchApi<GeocodeResponse>(`/geocode/ip`);
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

export async function getTaskById(id: string): Promise<Task> {
  return fetchApi<Task>(`/tasks/${id}`);
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
  // Milestone 5: Address fields
  firstName?: string;
  lastName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
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

// Milestone 5: Update profile address
export async function updateProfileAddress(data: {
  firstName?: string;
  lastName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}): Promise<Profile> {
  return fetchApi<Profile>('/profile/address', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ============================================
// Inbox Types & API (Milestone 3)
// ============================================

export interface InboxEntry {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  status: 'success' | 'error';
  taskId?: string;
  taskTitle?: string;
  errorMessage?: string;
  attachmentUrl?: string;
  processedAt: string;
}

export interface Notification {
  id: string;
  type: 'email_task_created' | 'email_error';
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    taskId?: string;
    inboxId?: string;
  };
}

// Inbox API
export async function fetchInbox(): Promise<{ entries: InboxEntry[] }> {
  return fetchApi<{ entries: InboxEntry[] }>('/inbox');
}

export async function fetchInboxEntry(id: string): Promise<InboxEntry> {
  return fetchApi<InboxEntry>(`/inbox/${id}`);
}

export async function deleteInboxEntry(id: string, deleteTask: boolean = false): Promise<void> {
  const url = deleteTask 
    ? `${BACKEND_URL}/inbox/${id}?deleteTask=true`
    : `${BACKEND_URL}/inbox/${id}`;
  await fetch(url, { method: 'DELETE' });
}

// Notifications API
export async function fetchNotifications(): Promise<{ 
  notifications: Notification[]; 
  unreadCount: number; 
}> {
  return fetchApi<{ notifications: Notification[]; unreadCount: number }>('/notifications');
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  return fetchApi<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

// ============================================
// Image to Task API (Milestone 4)
// ============================================

export interface CreateTaskFromImageResponse {
  task: Task;
  imageUrl: string | null;
  imageType: 'photo' | 'capture_ecran';
  confidence: number;
}

/**
 * Create a task from an image (photo or screenshot)
 * @param imageBase64 - Base64 encoded image data
 * @param mimeType - Image MIME type ('image/jpeg' or 'image/png')
 * @param filename - Original filename
 */
export async function createTaskFromImage(
  imageBase64: string,
  mimeType: string,
  filename: string
): Promise<CreateTaskFromImageResponse> {
  // Create FormData with the image
  const formData = new FormData();
  
  // FIX: Platform-specific FormData handling
  // On React Native, FormData requires a different format than web
  if (Platform.OS === 'web') {
    // Web: Convert base64 to blob
    const byteCharacters = atob(imageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    formData.append('image', blob, filename);
  } else {
    // React Native: Use object format with uri, type, and name
    // Convert base64 to data URI
    const dataUri = `data:${mimeType};base64,${imageBase64}`;
    formData.append('image', {
      uri: dataUri,
      type: mimeType,
      name: filename,
    } as any);
  }
  
  const response = await fetch(`${BACKEND_URL}/tasks/from-image`, {
    method: 'POST',
    body: formData,
    // Note: Don't set Content-Type header, let browser/RN set it with boundary
  });
  
  if (!response.ok) {
    const json = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(json.error || `Erreur ${response.status}`);
  }
  
  const json: ApiResponse<CreateTaskFromImageResponse> = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'Échec de la création de tâche');
  }
  
  return json.data;
}

// ============================================
// PDF Templates & Generation API (Milestone 5)
// ============================================

export type TemplateCategory = 
  | 'ecole' 
  | 'creche' 
  | 'sante_mutuelle' 
  | 'attestation' 
  | 'logement' 
  | 'contrat_facture' 
  | 'documents' 
  | 'travail';

export interface PDFTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  type: 'lettre' | 'attestation' | 'formulaire' | 'note';
  variables: string[];
  taskCategories: string[];
}

export interface PDFPreview {
  content: string;
  missingVariables: string[];
}

export interface GeneratedPDF {
  pdfUrl: string | null;
  filename: string;
}

export interface MessageDraft {
  subject?: string;
  body: string;
  recipient: string;
  channel: 'email' | 'sms' | 'whatsapp';
}

/**
 * Get all PDF templates, optionally filtered by category
 */
export async function fetchPDFTemplates(options?: {
  category?: TemplateCategory;
  taskCategory?: TaskCategory;
}): Promise<{ templates: PDFTemplate[] }> {
  let url = '/pdf/templates';
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.taskCategory) params.append('taskCategory', options.taskCategory);
  const query = params.toString();
  if (query) url += `?${query}`;
  
  return fetchApi<{ templates: PDFTemplate[] }>(url);
}

/**
 * Get a single PDF template by ID
 */
export async function fetchPDFTemplate(id: string): Promise<PDFTemplate> {
  return fetchApi<PDFTemplate>(`/pdf/templates/${id}`);
}

/**
 * Preview a filled PDF template (text only, no PDF generation)
 */
export async function previewPDF(options: {
  templateId: string;
  taskId?: string;
  variables?: Record<string, string>;
}): Promise<PDFPreview> {
  return fetchApi<PDFPreview>('/pdf/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}

/**
 * Generate a PDF document from a template
 */
export async function generatePDF(options: {
  templateId: string;
  taskId?: string;
  variables?: Record<string, string>;
}): Promise<GeneratedPDF> {
  const result = await fetchApi<GeneratedPDF>('/pdf/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  // Emit deterministic event for PDF generation success
  try {
    AppEvents.dispatchEvent({
      type: EVENTS.PDF_GENERATED,
      detail: {
        taskId: options.taskId,
        documentType: options.templateId,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch {
    // Do not throw if event dispatch fails
  }

  return result;
}

/**
 * Download PDF directly as blob (for Safari compatibility)
 */
export async function downloadPDFBlob(options: {
  templateId: string;
  taskId?: string;
  variables?: Record<string, string>;
}): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${BACKEND_URL}/pdf/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  
  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'document.pdf';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+?)"/);
    if (match) filename = match[1];
  }
  
  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Generate a message draft for contacting someone about a task
 */
export async function getMessageDraft(
  taskId: string,
  channel: 'email' | 'sms' | 'whatsapp'
): Promise<MessageDraft> {
  return fetchApi<MessageDraft>(`/tasks/${taskId}/message-draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
}

// ============================================
// Push Notification Token API
// ============================================

/**
 * Register push notification token with the backend
 * Called on app startup to enable push notifications
 */
export async function registerPushToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/push-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (!response.ok) {
      console.error('[Push] Failed to register token:', response.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[Push] Network error registering token:', error);
    return false;
  }
}

/**
 * Remove push notification token (on logout)
 */
export async function removePushToken(token: string): Promise<void> {
  await fetch(`${BACKEND_URL}/push-tokens`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}
