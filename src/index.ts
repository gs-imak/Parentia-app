import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processPipeline } from './pipeline.js';
import { getRandomQuote } from './quotes.js';
import { getWeatherForCity } from './weather.js';
import { getTopNews } from './news.js';
import { getTasksForToday } from './tasks.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for all routes (allows Expo dev server and mobile app to access APIs)
app.use(cors());

app.use(express.json());

// Serve React Native web build with proper MIME types and caching
app.use(express.static(path.join(__dirname, '..', 'mobile', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
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

function handleQuote(req: express.Request, res: express.Response) {
  try {
    const quote = getRandomQuote();
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

  if (!city) {
    return res.status(400).json({
      success: false,
      error: "Le paramètre 'city' est requis.",
    });
  }

  try {
    const summary = await getWeatherForCity(city);
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

app.get('/tasks/today', (req, res) => {
  try {
    const tasks = getTasksForToday();
    return res.json({ success: true, data: { tasks } });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les tâches pour le moment.',
    });
  }
});

app.get('/geocode/reverse', async (req, res) => {
  const lat = req.query.lat as string | undefined;
  const lon = req.query.lon as string | undefined;

  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      error: 'Les paramètres lat et lon sont requis.',
    });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ParentiaApp/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();
    const cityName = data.address?.postcode || data.address?.city || data.address?.town || data.address?.village || '';

    return res.json({
      success: true,
      data: {
        city: cityName,
        fullAddress: data,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Impossible de récupérer l\'adresse.',
    });
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
    const city = data.postal || data.city || '';
    return res.json({ success: true, data: { city, provider: 'ipapi', raw: data } });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Impossible d'obtenir la localisation par IP." });
  }
});

// Fallback route for client-side routing
app.get('*', (req, res) => {
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
});
