import type { TaskCategory } from './tasks.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Valid categories for task creation
const VALID_CATEGORIES: TaskCategory[] = [
  'administratif',
  'enfants-école',
  'santé',
  'finances',
  'logement',
  'personnel'
];

export interface ImageAIInput {
  imageBase64: string;      // Image encoded in base64
  mimeType: string;         // 'image/jpeg' | 'image/png'
  filename: string;         // Original filename
}

export interface ImageAIOutput {
  canProcess: boolean;      // false if image is unreadable
  errorReason?: string;     // Reason if canProcess=false
  title: string;            // Task title (max 60 chars)
  category: TaskCategory;   // administratif | enfants-école | santé | finances | logement | personnel
  deadline: string;         // ISO date string
  description: string;      // Context + action to take
  priority: 'high' | 'medium' | 'low';
  imageType: 'photo' | 'capture_ecran';  // Detected by AI
  confidence: number;       // 0-1
}

/**
 * Build the prompt for GPT-4 Vision to analyze an image
 */
export function buildImagePrompt(): string {
  return `Tu es un assistant familial intelligent. Analyse cette image et extrait les informations pour créer une tâche.

L'image peut être :
- Une photo d'un courrier papier (lettre, convocation, facture, formulaire, document officiel...)
- Une capture d'écran d'un message (WhatsApp, SMS, email, notification...)
- Une photo d'un document quelconque nécessitant une action

Règles importantes :

1. DÉTECTION DU TYPE D'IMAGE :
   - Si c'est une photo d'un document papier posé sur une table/surface → imageType: "photo"
   - Si c'est une capture d'écran d'une interface (téléphone, ordinateur, app) → imageType: "capture_ecran"

2. IMAGE ILLISIBLE :
   - Si l'image est trop floue, trop sombre, ou si tu ne peux pas lire le texte
   - Retourne canProcess: false avec errorReason expliquant le problème
   - Ne force JAMAIS une tâche si tu ne peux pas comprendre le contenu

3. EXTRACTION DU TITRE :
   - Titre court et actionnable (max 60 caractères)
   - Commence par un verbe d'action : "Payer", "Envoyer", "Répondre", "Appeler", "Vérifier"...
   - Inclure le montant si c'est une facture : "Payer facture EDF - 89,50€"

4. CATÉGORIE (doit être une de: administratif, enfants-école, santé, finances, logement, personnel) :

   FINANCES (documents financiers purs) :
   - Impôts (avis d'imposition, déclarations fiscales)
   - Banque (relevés, virements)
   - Prêts, crédits, placements

   LOGEMENT (vie quotidienne du foyer) :
   - Factures énergie : EDF, Engie, gaz, électricité
   - Factures eau, internet, téléphone (Orange, SFR, Free, Bouygues)
   - Assurance habitation/auto
   - Loyer, charges, copropriété
   - Abonnements (streaming, etc.)

   SANTÉ :
   - Rendez-vous médicaux
   - Mutuelle, remboursements CPAM
   - Ordonnances, vaccins

   ENFANTS-ÉCOLE :
   - École : convocations, réunions, bulletins
   - Cantine, garderie, périscolaire
   - Messages de la nounou, crèche
   - Activités extra-scolaires

   ADMINISTRATIF :
   - CAF, CPAM (hors remboursements santé)
   - Mairie, préfecture
   - Documents officiels divers

   PERSONNEL :
   - Tout le reste

5. DATE LIMITE (deadline) :
   - Si une date explicite est visible (échéance, rendez-vous, "avant le JJ/MM/AAAA") → utilise cette date
   - Si le message implique une urgence ("urgent", "rapidement", "dès que possible") → aujourd'hui + 3 jours
   - Sinon → aujourd'hui + 7 jours

6. PRIORITÉ :
   - high : facture avec échéance proche, convocation, message urgent
   - medium : document standard, demande normale
   - low : information à conserver, rappel sans urgence

7. DESCRIPTION :
   - Résume brièvement le contenu de l'image
   - Indique clairement l'action à faire
   - Mentionne la date si trouvée
   - Mentionne le montant si c'est une facture

8. CAPTURES D'ÉCRAN DE MESSAGES :
   - WhatsApp/SMS : identifie qui envoie le message et ce qu'il demande
   - Le titre doit refléter l'action demandée, pas juste "Message de X"

Réponds UNIQUEMENT avec un JSON valide (pas de texte avant ou après) :
{
  "canProcess": boolean (false si image illisible, sinon true),
  "errorReason": "string (raison si canProcess=false, sinon omis)",
  "title": "string (max 60 chars, actionnable)",
  "category": "administratif|enfants-école|santé|finances|logement|personnel",
  "deadline": "YYYY-MM-DDTHH:mm:ss.sssZ (ISO format)",
  "description": "string (résumé + action + date/montant si applicable)",
  "priority": "high|medium|low",
  "imageType": "photo|capture_ecran",
  "confidence": number (0-1, confiance dans l'analyse)
}`;
}

/**
 * Get default deadline (7 days from now)
 */
function getDefaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(12, 0, 0, 0); // Noon
  return date.toISOString();
}

/**
 * Validate deadline string
 */
function validateDeadline(deadline: unknown): string | null {
  if (typeof deadline !== 'string') return null;
  try {
    const parsed = new Date(deadline);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  } catch {
    return null;
  }
}

/**
 * Call OpenAI GPT-4 Vision to analyze an image
 */
async function callOpenAIVision(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Mock mode for testing without API key
    console.log('[Image AI] OpenAI API key not set, using mock response');
    return JSON.stringify({
      canProcess: true,
      title: 'Tâche à vérifier (mode test)',
      category: 'administratif',
      deadline: getDefaultDeadline(),
      description: 'Image reçue - vérification manuelle requise (mode test sans clé API)',
      priority: 'medium',
      imageType: 'photo',
      confidence: 0.5
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o', // GPT-4o supports vision
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high' // High resolution for better OCR
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.3, // Lower temperature for consistent outputs
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('OpenAI returned unexpected response structure');
  }

  return data.choices[0].message.content;
}

/**
 * Validate and normalize AI output
 */
export function normalizeImageAIOutput(raw: unknown): ImageAIOutput | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Check if AI cannot process the image
  if (obj.canProcess === false) {
    return {
      canProcess: false,
      errorReason: String(obj.errorReason || 'Image non exploitable'),
      title: '',
      category: 'administratif',
      deadline: getDefaultDeadline(),
      description: '',
      priority: 'medium',
      imageType: 'photo',
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
    };
  }

  // Validate and normalize category
  let category: TaskCategory = 'administratif';
  if (typeof obj.category === 'string' && VALID_CATEGORIES.includes(obj.category as TaskCategory)) {
    category = obj.category as TaskCategory;
  }

  // Validate and normalize deadline
  const deadline = validateDeadline(obj.deadline) || getDefaultDeadline();

  // Validate priority
  const validPriorities = ['high', 'medium', 'low'];
  const priority = validPriorities.includes(String(obj.priority))
    ? (obj.priority as 'high' | 'medium' | 'low')
    : 'medium';

  // Validate imageType
  const imageType = obj.imageType === 'capture_ecran' ? 'capture_ecran' : 'photo';

  // Validate confidence
  const confidence = typeof obj.confidence === 'number'
    ? Math.min(1, Math.max(0, obj.confidence))
    : 0.5;

  return {
    canProcess: true,
    title: String(obj.title || 'Tâche à vérifier').slice(0, 100),
    category,
    deadline,
    description: String(obj.description || ''),
    priority,
    imageType,
    confidence,
  };
}

/**
 * Analyze an image and extract task information
 * Returns normalized output or null if analysis fails
 */
export async function analyzeImage(input: ImageAIInput): Promise<ImageAIOutput | null> {
  try {
    console.log(`[Image AI] Analyzing image: ${input.filename} (${input.mimeType})`);
    
    const prompt = buildImagePrompt();
    const aiResponse = await callOpenAIVision(input.imageBase64, input.mimeType, prompt);

    console.log(`[Image AI] Raw response received`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      console.error('[Image AI] AI returned invalid JSON:', aiResponse.slice(0, 200));
      return null;
    }

    const result = normalizeImageAIOutput(parsed);

    if (result) {
      if (result.canProcess) {
        console.log(`[Image AI] Analysis complete: "${result.title}" (${result.category}, confidence: ${result.confidence})`);
      } else {
        console.log(`[Image AI] Cannot process image: ${result.errorReason}`);
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Image AI] Analysis failed:', message);
    return null;
  }
}

/**
 * Analyze image with retry logic and timeout
 */
export async function analyzeImageWithRetry(
  input: ImageAIInput,
  maxRetries = 1,
  timeoutMs = 30000
): Promise<ImageAIOutput | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        analyzeImage(input),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout')), timeoutMs)
        ),
      ]);

      if (result) {
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Image AI] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  return null;
}
