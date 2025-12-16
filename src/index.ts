import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { processPipeline } from './pipeline.js';
import { getRandomQuote } from './quotes.js';
import { getWeatherForCity } from './weather.js';
import { getTopNews } from './news.js';
import { getTasksForToday, createTask, getTasks, updateTask, deleteTask, sanitizeAllTasks } from './tasks.js';
import { getProfile, addChild, updateChild, deleteChild, updateSpouse, deleteSpouse, updateMarriageDate, deleteMarriageDate, updateProfileAddress } from './profile.js';
import { getInboxEntries, getInboxEntryById } from './inbox.js';
import { getNotifications, markNotificationRead, getUnreadCount, createNotification } from './notifications.js';
import { startEmailPoller, checkEmailsNow, getPollerStatus } from './emailPoller.js';
import { processSendGridInbound, extractEmailFromMultipart } from './sendgridInbound.js';
import { analyzeImageWithRetry } from './imageAI.js';
import { uploadAttachment, isSupabaseConfigured } from './supabase.js';
import { generatePDF, previewFilledTemplate } from './pdfGenerator.js';
import { getAllTemplates, getTemplateById, getTemplatesForTaskCategory } from './pdfTemplates.js';
import { getTaskById } from './tasks.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for all routes (allows Expo dev server and mobile app to access APIs)
app.use(cors());

app.use(express.json());

// Clean up legacy suggested templates (non-blocking)
sanitizeAllTasks()
  .then(() => console.log('[Init] Suggested templates sanitized'))
  .catch((err) => console.error('[Init] Failed to sanitize templates', err));

// Multer configuration for image uploads
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG ou PNG.'));
    }
  },
});

// Serve React Native web build with proper MIME types and caching
app.use(express.static(path.join(__dirname, '..', 'mobile', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    if (filePath.includes('service-worker')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

app.post('/parse', async (req, res) => {
  try {
    // Validate request body
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "text" field',
      });
    }

    // Process through pipeline
    const result = await processPipeline(text);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // Handle errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('invalid JSON')) {
      return res.status(422).json({
        success: false,
        error: 'AI returned invalid JSON',
      });
    }

    if (errorMessage.includes('Validation failed')) {
      return res.status(422).json({
        success: false,
        error: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

async function handleQuote(req: express.Request, res: express.Response) {
  try {
    const quote = await getRandomQuote();
    return res.json({ success: true, data: quote });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer une citation pour le moment.',
    });
  }
}

app.get('/quote', handleQuote);
app.get('/citations', handleQuote);

app.get('/weather', async (req, res) => {
  const city = (req.query.city as string | undefined)?.trim();
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;

  if (!city) {
    return res.status(400).json({
      success: false,
      error: "Le paramètre 'city' est requis.",
    });
  }

  try {
    const summary = await getWeatherForCity(city, lat, lon);
    return res.json({ success: true, data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const status = message === 'Ville introuvable' ? 404 : 502;
    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

app.get('/news', async (req, res) => {
  try {
    const items = await getTopNews();
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: 'Impossible de récupérer les news pour le moment.',
    });
  }
});

app.get('/tasks/today', async (req, res) => {
  try {
    const tasks = await getTasksForToday();
    return res.json({ success: true, data: { tasks } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les tâches pour le moment.',
    });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { title, category, deadline, description } = req.body;
    if (!title || !category || !deadline) {
      return res.status(400).json({
        success: false,
        error: 'Les champs title, category et deadline sont requis.',
      });
    }
    const task = await createTask({ title, category, deadline, description });
    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de créer la tâche.',
    });
  }
});

// ============================================
// Image to Task Endpoint (Milestone 4)
// ============================================
app.post('/tasks/from-image', imageUpload.single('image'), async (req, res) => {
  console.log('[Image] POST /tasks/from-image received');
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucune image fournie.',
      });
    }
    
    const { buffer, mimetype, originalname } = req.file;
    console.log(`[Image] File received: ${mimetype}, ${buffer.length} bytes`);
    
    // Convert buffer to base64
    const imageBase64 = buffer.toString('base64');
    
    // Upload to Supabase (non-blocking, we continue even if it fails)
    let imageUrl: string | null = null;
    if (isSupabaseConfigured()) {
      try {
        imageUrl = await uploadAttachment(buffer, originalname, mimetype);
        if (imageUrl) {
          console.log(`[Image] Uploaded to Supabase: ${imageUrl}`);
        }
      } catch (uploadErr) {
        console.error('[Image] Supabase upload failed:', uploadErr);
        // Continue without imageUrl
      }
    }
    
    // Analyze image with GPT-4 Vision
    console.log('[Image] Analyzing with GPT-4 Vision...');
    const aiResult = await analyzeImageWithRetry({
      imageBase64,
      mimeType: mimetype,
      filename: originalname,
    });
    
    if (!aiResult) {
      console.error('[Image] AI analysis failed completely');
      return res.status(500).json({
        success: false,
        error: "Impossible d'analyser l'image. Veuillez réessayer.",
      });
    }
    
    // Check if AI couldn't process the image
    if (!aiResult.canProcess) {
      console.log(`[Image] AI cannot process: ${aiResult.errorReason}`);
      return res.status(422).json({
        success: false,
        error: aiResult.errorReason || "Image illisible ou non exploitable.",
      });
    }
    
    // Create task
    console.log(`[Image] Creating task: category=${aiResult.category}`);
    const task = await createTask({
      title: aiResult.title,
      category: aiResult.category,
      deadline: aiResult.deadline,
      description: aiResult.description,
      source: 'photo',
      imageUrl: imageUrl || undefined,
      // Milestone 5: Contact info and template suggestions
      contactEmail: aiResult.contactEmail,
      contactPhone: aiResult.contactPhone,
      contactName: aiResult.contactName,
      suggestedTemplates: aiResult.suggestedTemplates,
    });
    
    console.log(`[Image] Task created: ${task.id}`);
    
    // Create notification (non-blocking)
    try {
      await createNotification({
        type: 'email_task_created', // Reuse existing type
        message: `Nouvelle tâche créée depuis une photo : ${task.title}`,
        metadata: { taskId: task.id },
      });
    } catch (notifErr) {
      console.error('[Image] Notification creation failed:', notifErr);
      // Non-blocking
    }
    
    return res.status(201).json({
      success: true,
      data: {
        task,
        imageUrl,
        imageType: aiResult.imageType,
        confidence: aiResult.confidence,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Image] Error:', message);
    
    // Handle multer errors
    if (message.includes('Format non supporté')) {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: "Une erreur est survenue lors du traitement de l'image.",
    });
  }
});

app.get('/tasks', async (req, res) => {
  try {
    const tasks = await getTasks();
    return res.json({ success: true, data: { tasks } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les tâches.',
    });
  }
});

app.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { getTaskById } = await import('./tasks.js');
    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Tâche introuvable.',
      });
    }
    return res.json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer la tâche.',
    });
  }
});

app.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const task = await updateTask(id, updates);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Tâche introuvable.',
      });
    }
    return res.json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour la tâche.',
    });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteTask(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Tâche introuvable.',
      });
    }
    return res.json({ success: true, message: 'Tâche supprimée avec succès.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de supprimer la tâche.',
    });
  }
});

// Profile endpoints
app.get('/profile', async (req, res) => {
  try {
    const profile = await getProfile();
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer le profil.',
    });
  }
});

app.post('/profile/children', async (req, res) => {
  try {
    const { firstName, birthDate, height, weight, notes } = req.body;
    if (!firstName || !birthDate) {
      return res.status(400).json({
        success: false,
        error: 'Les champs firstName et birthDate sont requis.',
      });
    }
    const child = await addChild({ firstName, birthDate, height, weight, notes });
    return res.status(201).json({ success: true, data: child });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible d\'ajouter l\'enfant.';
    const status = message.includes('Maximum 5') ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: message,
    });
  }
});

app.patch('/profile/children/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const child = await updateChild(id, updates);
    if (!child) {
      return res.status(404).json({
        success: false,
        error: 'Enfant introuvable.',
      });
    }
    return res.json({ success: true, data: child });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour l\'enfant.',
    });
  }
});

app.delete('/profile/children/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteChild(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Enfant introuvable.',
      });
    }
    return res.json({ success: true, message: 'Enfant supprimé avec succès.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de supprimer l\'enfant.',
    });
  }
});

app.put('/profile/spouse', async (req, res) => {
  try {
    const { firstName, birthDate } = req.body;
    if (!firstName) {
      return res.status(400).json({
        success: false,
        error: 'Le champ firstName est requis.',
      });
    }
    const profile = await updateSpouse({ firstName, birthDate });
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour le conjoint.',
    });
  }
});

app.delete('/profile/spouse', async (req, res) => {
  try {
    const profile = await deleteSpouse();
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de supprimer le conjoint.',
    });
  }
});

app.put('/profile/marriage-date', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Le champ date est requis.',
      });
    }
    const profile = await updateMarriageDate(date);
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour la date de mariage.',
    });
  }
});

app.delete('/profile/marriage-date', async (req, res) => {
  try {
    const profile = await deleteMarriageDate();
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de supprimer la date de mariage.',
    });
  }
});

app.get('/geocode/reverse', async (req, res) => {
  const lat = req.query.lat as string | undefined;
  const lon = req.query.lon as string | undefined;

  if (!lat || !lon) {
    return res.status(400).json({ success: false, error: 'Les paramètres lat et lon sont requis.' });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      { headers: { 'User-Agent': 'ParentiaApp/1.0' } }
    );

    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

    const data = await response.json();
    const postcode = data.address?.postcode || '';
    const cityName = data.address?.city || data.address?.town || data.address?.village || '';
    const country = data.address?.country || '';
    
    // Return human-readable city name for display, but include postcode for weather API
    const displayCity = cityName || postcode;
    const weatherCity = postcode || cityName;

    return res.json({
      success: true,
      data: { 
        city: displayCity,
        weatherCity,
        postcode, 
        cityName, 
        country,
        coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) }
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Impossible de récupérer l'adresse." });
  }
});

app.get('/geocode/ip', async (req, res) => {
  try {
    // Prefer client IP from headers if present (behind Railway proxy)
    const forwarded = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const url = forwarded ? `https://ipapi.co/${forwarded}/json/` : 'https://ipapi.co/json/';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ipapi error: ${response.status}`);
    }
    const data = await response.json();
    const postcode = data.postal || '';
    const cityName = data.city || '';
    const country = data.country_name || '';
    
    // Return human-readable city name for display, but include postcode for weather API
    const displayCity = cityName || postcode;
    const weatherCity = postcode || cityName;
    
    return res.json({ 
      success: true, 
      data: { 
        city: displayCity,
        weatherCity,
        postcode, 
        cityName, 
        country, 
        provider: 'ipapi',
        coordinates: { lat: data.latitude, lon: data.longitude }
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Impossible d'obtenir la localisation par IP." });
  }
});

// ============================================
// Email Polling & Inbox Endpoints (Milestone 3)
// ============================================

// SendGrid Inbound Parse webhook
// Receives raw MIME email when someone sends to *@hcfamily.app
app.post('/email/inbound', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  console.log('[Webhook] POST /email/inbound received');
  console.log('[Webhook] Content-Type:', req.headers['content-type']);
  console.log('[Webhook] Body length:', req.body?.length || 0);
  
  try {
    const contentType = req.headers['content-type'] || '';
    let rawEmail: string | null = null;
    
    if (contentType.includes('multipart/form-data')) {
      // SendGrid sends multipart form data with "email" field containing raw MIME
      rawEmail = extractEmailFromMultipart(req.body, contentType);
    } else {
      // Fallback: treat entire body as raw email
      rawEmail = req.body.toString('utf-8');
    }
    
    if (!rawEmail) {
      console.error('[Webhook] Could not extract email from request');
      // Return 200 to prevent SendGrid from retrying
      return res.status(200).json({ success: false, error: 'Could not extract email' });
    }
    
    console.log('[Webhook] Extracted email, length:', rawEmail.length);
    
    // Process the email
    const result = await processSendGridInbound(rawEmail);
    
    // Always return 200 to SendGrid to acknowledge receipt
    // (even on processing errors, we don't want retries for bad emails)
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Error:', message);
    // Return 200 to prevent infinite retries
    return res.status(200).json({ success: false, error: message });
  }
});

// Get email service status
app.get('/email/status', (req, res) => {
  const imapStatus = getPollerStatus();
  const imapEnabled = process.env.ENABLE_IMAP_POLLER === 'true';
  
  return res.json({ 
    success: true, 
    data: {
      // Primary: SendGrid Inbound Parse
      sendgrid: {
        enabled: true,
        domain: 'hcfamily.app',
        webhook: '/email/inbound',
      },
      // Fallback: IMAP polling (disabled by default)
      imap: {
        enabled: imapEnabled,
        running: imapEnabled && imapStatus.running,
        configured: imapStatus.configured,
        user: imapStatus.user,
        host: imapStatus.host,
      },
    }
  });
});

// Manually trigger email check (useful for testing)
app.post('/email/check', async (req, res) => {
  console.log('Manual email check triggered');
  const result = await checkEmailsNow();
  return res.json({ success: result.success, error: result.error });
});

// Get all inbox entries
app.get('/inbox', async (req, res) => {
  try {
    const entries = await getInboxEntries();
    return res.json({ success: true, data: { entries } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer la boîte de réception.',
    });
  }
});

// Get single inbox entry
app.get('/inbox/:id', async (req, res) => {
  try {
    const entry = await getInboxEntryById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Entrée introuvable.',
      });
    }
    return res.json({ success: true, data: entry });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer l\'entrée.',
    });
  }
});

// Delete inbox entry (with optional cascade delete of associated task)
app.delete('/inbox/:id', async (req, res) => {
  try {
    const { deleteInboxEntry, getInboxEntryById } = await import('./inbox.js');
    const { deleteTask } = await import('./tasks.js');
    
    const shouldDeleteTask = req.query.deleteTask === 'true';
    
    // If cascade delete requested, first get the entry to find taskId
    if (shouldDeleteTask) {
      const entry = await getInboxEntryById(req.params.id);
      if (entry && entry.taskId) {
        // Delete the associated task first
        await deleteTask(entry.taskId);
        console.log(`[Inbox] Cascade deleted task ${entry.taskId} for inbox entry ${req.params.id}`);
      }
    }
    
    const deleted = await deleteInboxEntry(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Entrée introuvable.',
      });
    }
    return res.json({ 
      success: true, 
      message: shouldDeleteTask ? 'Entrée et tâche associée supprimées.' : 'Entrée supprimée avec succès.' 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Inbox] Delete error:', message);
    return res.status(500).json({
      success: false,
      error: 'Impossible de supprimer l\'entrée.',
    });
  }
});

// Get all notifications
app.get('/notifications', async (req, res) => {
  try {
    const notifications = await getNotifications();
    const unreadCount = await getUnreadCount();
    return res.json({ 
      success: true, 
      data: { notifications, unreadCount } 
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les notifications.',
    });
  }
});

// Mark notification as read
app.patch('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await markNotificationRead(req.params.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification introuvable.',
      });
    }
    return res.json({ success: true, data: notification });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour la notification.',
    });
  }
});

// ============================================
// Profile Address Endpoints (Milestone 5)
// ============================================
app.put('/profile/address', async (req, res) => {
  try {
    const { firstName, lastName, address, postalCode, city } = req.body;
    const profile = await updateProfileAddress({ firstName, lastName, address, postalCode, city });
    return res.json({ success: true, data: profile });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de mettre à jour l\'adresse.',
    });
  }
});

// ============================================
// PDF Templates & Generation Endpoints (Milestone 5)
// ============================================

// Get all PDF templates
app.get('/pdf/templates', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const taskCategory = req.query.taskCategory as string | undefined;
    
    let templates;
    if (taskCategory) {
      templates = getTemplatesForTaskCategory(taskCategory);
    } else {
      templates = getAllTemplates();
    }
    
    // If category filter, further filter
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    return res.json({ success: true, data: { templates } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les modèles.',
    });
  }
});

// Get single template
app.get('/pdf/templates/:id', async (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Modèle introuvable.',
      });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer le modèle.',
    });
  }
});

// Preview filled template (text only)
app.post('/pdf/preview', async (req, res) => {
  try {
    const { templateId, taskId, variables } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId est requis.',
      });
    }
    
    const preview = await previewFilledTemplate(templateId, taskId, variables);
    return res.json({ success: true, data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// Generate PDF document
app.post('/pdf/generate', async (req, res) => {
  try {
    const { templateId, taskId, variables } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId est requis.',
      });
    }
    
    const result = await generatePDF({
      templateId,
      taskId,
      variables: variables || {},
    });
    
    return res.json({
      success: true,
      data: {
        pdfUrl: result.pdfUrl,
        filename: result.filename,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[PDF] Generation error:', message);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// Download PDF (returns raw PDF buffer)
app.post('/pdf/download', async (req, res) => {
  try {
    const { templateId, taskId, variables } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId est requis.',
      });
    }
    
    const result = await generatePDF({
      templateId,
      taskId,
      variables: variables || {},
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[PDF] Download error:', message);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

// ============================================
// Message Draft Generation (Milestone 5)
// ============================================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post('/tasks/:id/message-draft', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { channel } = req.body; // 'email' | 'sms' | 'whatsapp'
    
    if (!channel || !['email', 'sms', 'whatsapp'].includes(channel)) {
      return res.status(400).json({
        success: false,
        error: 'channel doit être email, sms ou whatsapp.',
      });
    }
    
    const task = await getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Tâche introuvable.',
      });
    }
    
    // Get contact info
    const recipient = channel === 'email' ? task.contactEmail : task.contactPhone;
    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: `Aucun contact ${channel === 'email' ? 'email' : 'téléphone'} disponible pour cette tâche.`,
      });
    }
    
    // Generate message draft via AI
    const profile = await getProfile();
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    const senderName = fullName || profile.lastName || 'Le parent';
    
    let subject: string | undefined;
    let body: string;
    
    if (OPENAI_API_KEY) {
      // Use AI to generate message
      const prompt = `Tu es un assistant familial. Génère un message ${channel === 'email' ? 'email' : 'SMS/WhatsApp'} professionnel mais amical pour la tâche suivante:

Tâche: ${task.title}
Description: ${task.description || 'Pas de description'}
Catégorie: ${task.category}
Échéance: ${task.deadline}
Destinataire: ${task.contactName || recipient}
Expéditeur: ${senderName}

Règles:
- ${channel === 'email' ? 'Format email avec objet et corps' : 'Message court (max 160 caractères pour SMS)'}
- Ton professionnel mais chaleureux
- En français
- Si c'est pour une école/crèche, utiliser les formules de politesse appropriées

Réponds UNIQUEMENT avec un JSON valide:
{
  ${channel === 'email' ? '"subject": "objet du message",' : ''}
  "body": "contenu du message"
}`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Tu génères des messages pour des communications familiales. Réponds uniquement en JSON valide.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 300,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          subject = parsed.subject;
          body = parsed.body;
        } else {
          throw new Error('AI API error');
        }
      } catch (aiError) {
        console.error('[Message Draft] AI error:', aiError);
        // Fall back to default
        subject = channel === 'email' ? `À propos de : ${task.title}` : undefined;
        body = `Bonjour,\n\nJe vous contacte concernant : ${task.title}.\n\nCordialement,\n${senderName}`;
      }
    } else {
      // No AI key, use default template
      subject = channel === 'email' ? `À propos de : ${task.title}` : undefined;
      body = channel === 'email'
        ? `Bonjour,\n\nJe vous contacte concernant : ${task.title}.\n\n${task.description || ''}\n\nCordialement,\n${senderName}`
        : `Bonjour, je vous contacte au sujet de: ${task.title}. ${senderName}`;
    }
    
    return res.json({
      success: true,
      data: {
        subject,
        body,
        recipient,
        channel,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[Message Draft] Error:', message);
    return res.status(500).json({
      success: false,
      error: 'Impossible de générer le brouillon.',
    });
  }
});

// Fallback route for client-side routing
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, '..', 'mobile', 'dist', 'index.html'));
});

// Error handler middleware (must be after routes or it will not be called)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
    });
  }
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.OPENAI_API_KEY ? 'REAL AI' : 'MOCK'}`);
  console.log(`Email: SendGrid Inbound Parse webhook at /email/inbound`);
  
  // IMAP polling disabled - now using SendGrid Inbound Parse webhooks
  // The poller can still be started manually via environment variable if needed as fallback
  if (process.env.ENABLE_IMAP_POLLER === 'true') {
    console.log('IMAP poller enabled via ENABLE_IMAP_POLLER=true');
    startEmailPoller();
  }
});
