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

export interface EmailAIInput {
  subject: string;
  body: string;
  sender: string;
  receivedAt: string;
  pdfText?: string;
}

export interface EmailAIOutput {
  title: string;
  category: TaskCategory;
  deadline: string; // ISO date
  description: string;
  priority: 'high' | 'medium' | 'low';
  skip?: boolean; // true if email is newsletter/promo with no action required
  originalSender?: string; // original sender if forwarded email
  metadata: {
    emailType: string;
    confidence: number;
  };
}

/**
 * Build the prompt for OpenAI to analyze an email
 */
export function buildEmailPrompt(input: EmailAIInput): string {
  const pdfSection = input.pdfText 
    ? `\n\n--- CONTENU DU PDF JOINT ---\n${input.pdfText}\n--- FIN DU PDF ---`
    : '';

  return `Tu es un assistant familial intelligent. Analyse cet email et extrait les informations pour créer une tâche.

--- EMAIL ---
De: ${input.sender}
Sujet: ${input.subject}
Date de réception: ${input.receivedAt}

${input.body}${pdfSection}
--- FIN DE L'EMAIL ---

Règles importantes:

1. EMAILS TRANSFÉRÉS (Fwd: / Tr:):
   - Si le sujet commence par "Fwd:", "Tr:", "TR:" ou "FW:", c'est un email transféré
   - Cherche l'expéditeur ORIGINAL dans le corps ("De:", "From:", "Expéditeur:")
   - Utilise cet expéditeur original, pas celui qui a transféré

2. FICHIERS PDF JOINTS:
   - Si un PDF est joint, son contenu sera fourni dans la section "CONTENU DU PDF JOINT"
   - Analyser le PDF pour détecter: factures, relevés, convocations, documents officiels
   - Si le PDF contient une FACTURE (mots-clés: "Facture", "Invoice", "Montant à payer", "Total TTC", "Date limite de paiement"):
     * IMPORTANT: Extraire le MONTANT exact du PDF (chercher: "Total TTC", "Montant à payer", "Total à régler", chiffres suivis de "€" ou "EUR")
     * IMPORTANT: Extraire la DATE LIMITE du PDF (chercher: "Date limite", "Échéance", "Date de paiement", "Paiement avant le", formats: JJ/MM/AAAA, DD-MM-YYYY)
     * Créer une tâche de paiement avec le montant ET l'échéance extraits
     * Titre: "Payer facture [fournisseur] - [montant]€" (ex: "Payer facture Selfbox - 29,99€")
     * Description: Inclure le montant exact ET la date limite trouvée dans le PDF
   - Si le PDF contient des chiffres mais PAS assez de contexte:
     * Chercher TOUS les montants (chiffres avec "," ou "." suivis de "€")
     * Utiliser le montant le plus élevé ou celui mentionné près de "Total" / "Montant"

3. DATE LIMITE (deadline):
   - Extraire en priorité du PDF (date d'échéance, date limite de paiement, date de convocation)
   - Sinon de l'email (date mentionnée dans le sujet ou le corps)
   - IMPORTANT: Si une date explicite est trouvée (ex: "échéance 15 novembre 2025"), GARDE CETTE DATE même si elle est dans le passé
   - Si aucune date explicite trouvée: utilise la date du jour + 7 jours

4. DESCRIPTION:
   - Résume l'action à faire
   - IMPORTANT: Inclure la date trouvée dans la description (ex: "Échéance au 15 novembre 2025")
   - Mentionner le montant si applicable
   - Pour les factures PDF: mentionner qu'une facture est jointe

5. PRÉLÈVEMENT AUTOMATIQUE / Auto-paiement:
   - Si l'email mentionne "prélèvement automatique", "prélevé automatiquement", "sera débité", "auto-débit"
   - Le titre doit être INFORMATIF (ex: "Prélèvement Orange - 25,99€"), PAS une action (ne pas mettre "Payer")
   - La priorité doit être "low" (juste pour information)

6. NEWSLETTERS et EMAILS PROMOTIONNELS:
   - Si l'email est une newsletter, promotion, publicité, ou information générale sans action requise
   - Retourne "skip": true dans le JSON au lieu de créer une tâche
   - Exemples: newsletters d'actualité, offres commerciales, confirmations d'abonnement sans action

7. CATÉGORIE (doit être une de: administratif, enfants-école, santé, finances, logement, personnel):

   FINANCES (documents financiers purs):
   - Impôts (avis d'imposition, déclarations, échéances fiscales)
   - Banque (relevés, opérations bancaires, virements)
   - Revenus (fiches de paie, attestations)
   - Placements, assurance vie, épargne
   - Prêts, crédits, remboursements bancaires

   LOGEMENT (vie quotidienne du foyer):
   - Factures énergie: EDF, Engie, gaz, électricité
   - Factures eau
   - Internet, téléphone fixe, box, mobile (Orange, SFR, Free, Bouygues)
   - Assurance habitation, assurance auto
   - Abonnements du foyer (streaming: Netflix, CANAL+, Disney+, Prime Video, OCS; musique: Spotify, Deezer; autres services du foyer)
   - Entretien maison, travaux
   - Loyer, charges de copropriété
   - Garde-meuble, self-stockage (Selfbox, Homebox, etc.)
   - Déménagement, stockage

   SANTÉ:
   - Rendez-vous médicaux
   - Mutuelle, assurance santé
   - Ordonnances, remboursements CPAM
   - Vaccins, examens médicaux

   ENFANTS-ÉCOLE:
   - École: convocations, réunions parents, bulletins
   - Cantine, garderie, périscolaire
   - Activités extra-scolaires
   - Factures liées aux enfants

   ADMINISTRATIF:
   - CAF, CPAM (hors remboursements santé)
   - Mairie, préfecture
   - Documents officiels

   PERSONNEL:
   - Tâches personnelles diverses
   - Informations générales non catégorisables

8. TITRE: court et actionnable (max 60 caractères)

Réponds UNIQUEMENT avec un JSON valide (pas de texte avant ou après):
{
  "skip": boolean (true si newsletter/promo sans action, sinon false ou omis),
  "title": "string (max 60 chars, actionnable)",
  "category": "administratif|enfants-école|santé|finances|logement|personnel",
  "deadline": "YYYY-MM-DDTHH:mm:ss.sssZ (ISO format)",
  "description": "string (résumé de l'action + date trouvée si applicable)",
  "priority": "high|medium|low",
  "originalSender": "string (expéditeur original si email transféré, sinon omis)",
  "metadata": {
    "emailType": "string (ex: facture, convocation, rdv, impôts, newsletter, promo)",
    "confidence": number (0-1, confiance dans l'analyse)
  }
}`;
}

/**
 * Call OpenAI to analyze an email
 */
async function callOpenAI(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Mock mode for testing without API key
    console.log('OpenAI API key not set, using mock response');
    return JSON.stringify({
      title: 'Tâche à vérifier (mode test)',
      category: 'administratif',
      deadline: getDefaultDeadline(),
      description: 'Email reçu - vérification manuelle requise',
      priority: 'medium',
      metadata: {
        emailType: 'unknown',
        confidence: 0.5
      }
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // Cost-effective model for this task
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant qui analyse des emails familiaux et extrait des informations structurées. Réponds uniquement en JSON valide.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent outputs
      max_tokens: 500,
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
 * Get default deadline (7 days from now)
 */
function getDefaultDeadline(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setHours(12, 0, 0, 0); // Noon
  return date.toISOString();
}

/**
 * Validate and normalize AI output
 */
export function normalizeAIOutput(raw: unknown): EmailAIOutput | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Check if AI flagged this as a newsletter/promo to skip
  const skip = obj.skip === true;

  // Validate and normalize category
  let category: TaskCategory = 'administratif';
  if (typeof obj.category === 'string' && VALID_CATEGORIES.includes(obj.category as TaskCategory)) {
    category = obj.category as TaskCategory;
  }

  // Validate and normalize deadline
  // IMPORTANT: Keep explicit past dates (AI is instructed to preserve them)
  let deadline: string;
  try {
    if (typeof obj.deadline === 'string') {
      const parsed = new Date(obj.deadline);
      if (isNaN(parsed.getTime())) {
        // Invalid date: use J+7
        deadline = getDefaultDeadline();
      } else {
        // Keep the date as-is (even if in past)
        deadline = parsed.toISOString();
      }
    } else {
      deadline = getDefaultDeadline();
    }
  } catch {
    deadline = getDefaultDeadline();
  }

  // Validate priority
  const validPriorities = ['high', 'medium', 'low'];
  const priority = validPriorities.includes(String(obj.priority))
    ? (obj.priority as 'high' | 'medium' | 'low')
    : 'medium';

  // Extract metadata
  const metadataObj = (obj.metadata && typeof obj.metadata === 'object') 
    ? obj.metadata as Record<string, unknown>
    : {};

  // Extract original sender if present (for forwarded emails)
  const originalSender = typeof obj.originalSender === 'string' ? obj.originalSender : undefined;

  return {
    title: String(obj.title || 'Tâche à vérifier').slice(0, 100),
    category,
    deadline,
    description: String(obj.description || ''),
    priority,
    skip,
    originalSender,
    metadata: {
      emailType: String(metadataObj.emailType || 'unknown'),
      confidence: typeof metadataObj.confidence === 'number' 
        ? Math.min(1, Math.max(0, metadataObj.confidence))
        : 0.5,
    },
  };
}

/**
 * Analyze an email and extract task information
 * Returns normalized output or null if analysis fails
 */
export async function analyzeEmail(input: EmailAIInput): Promise<EmailAIOutput | null> {
  try {
    const prompt = buildEmailPrompt(input);
    const aiResponse = await callOpenAI(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      console.error('AI returned invalid JSON:', aiResponse.slice(0, 200));
      return null;
    }

    return normalizeAIOutput(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Email AI analysis failed:', message);
    return null;
  }
}

/**
 * Analyze email with retry logic and timeout
 */
export async function analyzeEmailWithRetry(
  input: EmailAIInput,
  maxRetries = 2,
  timeoutMs = 25000
): Promise<EmailAIOutput | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        analyzeEmail(input),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout')), timeoutMs)
        ),
      ]);

      if (result) {
        return result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`AI attempt ${attempt + 1}/${maxRetries + 1} failed:`, message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return null;
}

/**
 * Create fallback output when AI fails
 */
export function createFallbackOutput(input: EmailAIInput): EmailAIOutput {
  const subject = input.subject || 'Email sans sujet';
  return {
    title: `À vérifier: ${subject.slice(0, 45)}`,
    category: 'administratif',
    deadline: getDefaultDeadline(),
    description: `Email reçu de ${input.sender}. Traitement automatique impossible - vérification manuelle requise.`,
    priority: 'medium',
    metadata: {
      emailType: 'unknown',
      confidence: 0,
    },
  };
}
