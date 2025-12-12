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
  // Milestone 5: Contact info and template suggestions
  contactEmail?: string;    // Extracted email if visible
  contactPhone?: string;    // Extracted phone number if visible
  contactName?: string;     // Organization/sender name
  suggestedTemplates?: string[]; // Suggested PDF template IDs
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
   - CRITIQUE: Utilise la date EXACTE visible sur le document comme deadline. NE JAMAIS ajouter de jours.
   - Si un courrier est daté du "7 décembre" → deadline = 7 décembre 2025 (PAS le 8, PAS le 14)
   - Si tu vois "6 décembre" → deadline = 6 décembre 2025 (PAS le 3, PAS le 7)
   - Si tu vois "31 décembre" ou "31/12" → deadline = 31 décembre 2025 (PAS le 1er janvier)
   - La date du document EST la deadline. N'ajoute JAMAIS +1, +3, ou +7 jours à une date visible.
   - Nous sommes en décembre 2025. Pour les années ambiguës ou passées (2023, 2024), utilise 2025.
   - UNIQUEMENT si AUCUNE date n'est visible dans le document → aujourd'hui + 7 jours
   - NE JAMAIS inventer, arrondir, ou modifier une date visible. Utilise EXACTEMENT le jour écrit.

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

9. EXTRACTION CONTACT :
   - Si une adresse email est visible dans le document, l'extraire
   - Si un numéro de téléphone est visible, l'extraire (format: 0X XX XX XX XX ou +33...)
   - CRITIQUE pour contactName:
     * Pour une CAPTURE D'ÉCRAN SMS/iMessage/WhatsApp:
       - LE NOM EST EN HAUT DE L'ÉCRAN dans l'en-tête de la conversation
       - Exemple: si tu vois "Alagna" en haut de l'écran → contactName = "Alagna"
       - IGNORER tout texte de signature dans le corps du message
       - NE JAMAIS extraire "Président du..." ou autre titre du corps du message
     * Pour une lettre/email: contactName = celui qui signe
     * Le nom dans L'EN-TÊTE de l'app de messagerie EST le contact

10. TEMPLATES PDF SUGGÉRÉS :
   - IMPORTANT: Sois TRÈS conservateur avec les suggestions. NE suggère un template que s'il est VRAIMENT pertinent.
   - Pour les FACTURES:
     * NE suggère "facture_contestation" QUE si le document indique explicitement un problème, une erreur, un désaccord, ou une contestation nécessaire
     * Si c'est juste une facture normale à payer → NE PAS suggérer de template (omis ou tableau vide)
     * Exemples où suggérer facture_contestation: "montant incorrect", "erreur de facturation", "service non reçu", "tarif erroné"
   - Templates disponibles:
     * École: ecole_absence, ecole_autorisation_sortie, ecole_derogation, ecole_inscription, ecole_cantine, ecole_changement_adresse
     * Crèche: creche_inscription
     * Santé: sante_demande_remboursement, sante_rdv_medical, sante_certificat_medical, sante_resiliation_mutuelle
     * Attestations: attestation_hebergement, attestation_honneur, attestation_employeur, attestation_assurance, attestation_domicile, attestation_revenus
     * Logement: logement_preavis, contrat_resiliation, facture_contestation
     * Documents: documents_procuration, documents_reclamation
     * Travail: travail_conges
   - Suggérer 1 à 3 templates maximum, uniquement si CLAIREMENT pertinents
   - Si aucun template n'est pertinent → omis ou tableau vide

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
  "confidence": number (0-1, confiance dans l'analyse),
  "contactEmail": "string (email extrait si visible, sinon omis)",
  "contactPhone": "string (téléphone extrait si visible, sinon omis)",
  "contactName": "string (pour SMS/WhatsApp: nom en HAUT de l'écran comme 'Alagna' - JAMAIS le texte du message)",
  "suggestedTemplates": ["template_id1", "template_id2"] (IDs des templates pertinents, max 3, ou omis)
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
 * Correct deadline if AI returned a past year or clearly wrong date
 * Rules:
 * - If year < current year: try same day/month in current year, if that's in past use D+7
 * - If date is more than 1 year in the past: use D+7
 */
function correctDeadline(aiDeadline: string): string {
  try {
    const parsed = new Date(aiDeadline);
    if (isNaN(parsed.getTime())) {
      return getDefaultDeadline();
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const aiYear = parsed.getFullYear();

    // If AI returned a past year (2023, 2024, etc.)
    if (aiYear < currentYear) {
      // Try same day/month in current year
      const corrected = new Date(currentYear, parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
      
      // If that date is still in the past (or within last 7 days), use next year or D+7
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (corrected < sevenDaysAgo) {
        // Date already passed this year too, use D+7
        return getDefaultDeadline();
      }
      
      console.log(`[Date Correction] Fixed past year: ${aiDeadline} → ${corrected.toISOString()}`);
      return corrected.toISOString();
    }

    // If date is more than 1 year in the past
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (parsed < oneYearAgo) {
      console.log(`[Date Correction] Date too old, using D+7: ${aiDeadline}`);
      return getDefaultDeadline();
    }

    return parsed.toISOString();
  } catch {
    return getDefaultDeadline();
  }
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

  // Validate and normalize deadline with correction for past years
  const rawDeadline = validateDeadline(obj.deadline);
  const deadline = rawDeadline ? correctDeadline(rawDeadline) : getDefaultDeadline();

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
  
  // Milestone 5: Extract contact info
  const contactEmail = typeof obj.contactEmail === 'string' ? obj.contactEmail : undefined;
  const contactPhone = typeof obj.contactPhone === 'string' ? obj.contactPhone : undefined;
  const contactName = typeof obj.contactName === 'string' ? obj.contactName : undefined;
  
  // Extract suggested templates
  let suggestedTemplates: string[] | undefined;
  if (Array.isArray(obj.suggestedTemplates)) {
    suggestedTemplates = obj.suggestedTemplates
      .filter((t: unknown) => typeof t === 'string')
      .slice(0, 3) as string[];
    if (suggestedTemplates.length === 0) suggestedTemplates = undefined;
  }

  return {
    canProcess: true,
    title: String(obj.title || 'Tâche à vérifier').slice(0, 100),
    category,
    deadline,
    description: String(obj.description || ''),
    priority,
    imageType,
    confidence,
    contactEmail,
    contactPhone,
    contactName,
    suggestedTemplates,
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
