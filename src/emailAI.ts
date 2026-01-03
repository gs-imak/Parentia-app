import type { TaskCategory } from './tasks.js';
import { getSuggestedTemplateIds } from './pdfTemplates.js';

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
  // Milestone 5: Contact info and template suggestions
  contactEmail?: string; // Extracted contact email
  contactPhone?: string; // Extracted phone number
  contactName?: string; // Contact name
  suggestedTemplates?: string[]; // Suggested PDF template IDs
  metadata: {
    emailType: string;
    confidence: number;
  };
}

const PAYMENT_KEYWORDS = [
  'payer',
  'paiement',
  'facture',
  'à régler',
  'regler',
  'règlement',
  'échéance',
  'montant',
  'prélèvement',
  'prelevement'
];

const DISPUTE_KEYWORDS = [
  'contestation',
  'contester',
  'réclamation',
  'reclamation',
  'litige',
  'erreur',
  'incorrect',
  'abusif',
  'double',
  'fraude'
];

function detectPaymentContext(
  title: string,
  description: string,
  emailType: string
) {
  const haystack = `${title} ${description} ${emailType}`.toLowerCase();
  const isPayment = PAYMENT_KEYWORDS.some((kw) => haystack.includes(kw));
  const isDispute = DISPUTE_KEYWORDS.some((kw) => haystack.includes(kw));
  return { isPayment, isDispute };
}

function sanitizeSuggestedTemplates(
  suggestions: string[] | undefined,
  category: TaskCategory,
  title: string,
  description: string,
  emailType: string
): string[] | undefined {
  if (!suggestions || suggestions.length === 0) return undefined;

  const { isPayment, isDispute } = detectPaymentContext(title, description, emailType);

  // For simple payments, no template is ever needed
  if (isPayment && !isDispute) return undefined;

  // Keep only templates that match the task category
  const allowed = new Set(getSuggestedTemplateIds(category));
  let filtered = suggestions.filter((id) => allowed.has(id));

  // If the task is a contested invoice, keep only the contestation template
  if (isPayment && isDispute) {
    filtered = filtered.filter((id) => id === 'facture_contestation');
  }

  const unique = Array.from(new Set(filtered)).slice(0, 3);
  return unique.length > 0 ? unique : undefined;
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

2. FICHIERS PDF JOINTS (SOURCE DE VÉRITÉ):
   - ⚠️ RÈGLE CRITIQUE: Le PDF joint est TOUJOURS la source de vérité. Si le PDF contient un montant ou une date, IGNORER les montants/dates du corps de l'email.
   - Si un PDF est joint, son contenu sera fourni dans la section "CONTENU DU PDF JOINT"
   - Si le PDF ne peut pas être lu (message "[PDF JOINT: Impossible d'extraire le texte...]"):
     * Créer une tâche avec titre: "Vérifier document PDF - [expéditeur ou sujet]"
     * Catégorie: déduire du sujet/expéditeur (logement si fournisseur, finances si banque, etc.)
     * Priorité: "medium"
     * Description: "Document PDF joint nécessitant une vérification manuelle"
     * NE JAMAIS mettre skip: true
   - Analyser le PDF pour détecter: factures, relevés, convocations, documents officiels
   - Si le PDF contient une FACTURE:
     * MONTANT - PRIORITÉ AU PDF:
       - Chercher dans le PDF: "Total TTC", "Montant TTC", "Montant à régler", "Total à payer", "MONTANT À RÉGLER"
       - ⚠️ IGNORER tout montant mentionné dans le corps de l'email - seul le montant du PDF compte
       - Formats: "30,99€", "30.99€", "30,99 €", "30.99 €", "30,99 EUR"
       - Si plusieurs montants dans le PDF, prendre celui près de "Total TTC" ou "Montant à régler"
     * DATE - PRIORITÉ AU PDF:
       - Chercher dans le PDF: "Date limite", "Échéance", "avant le", "Paiement avant"
       - ⚠️ IGNORER toute date mentionnée dans le corps de l'email si le PDF a une date
       - Formats: JJ/MM/AAAA, DD-MM-YYYY, "le JJ/MM/AAAA"
     * Titre: "Payer facture [fournisseur] - [MONTANT DU PDF]€"
     * Description: Inclure le montant ET la date extraits DU PDF
   - Si le PDF contient des chiffres mais PAS de "Total TTC":
     * Chercher le montant près de: "TTC", "Total", "Montant", "À régler", "À payer"
     * En dernier recours: prendre le montant le plus significatif (pas les centimes seuls)

3. DATE LIMITE (deadline):
   - ⚠️ PRIORITÉ: Si un PDF est joint avec une date, utiliser LA DATE DU PDF, pas celle de l'email.
   - CRITIQUE: Utilise la date EXACTE visible. Ne modifie PAS le jour, le mois OU L'ANNÉE.
   - ⚠️ RESPECT DE L'ANNÉE EXPLICITE:
     * Si l'email/PDF mentionne explicitement une année (ex: "décembre 2025", "15/12/2025"), 
       UTILISER CETTE ANNÉE EXACTE, même si elle est dans le passé récent.
     * NE JAMAIS "corriger" une année explicite vers l'année courante ou future.
     * Ex: "Payer facture décembre 2025" en janvier 2026 → deadline = décembre 2025 (PAS 2026)
   - Pour les dates SANS année explicite (ex: "6 décembre", "31/12"):
     * Utiliser l'année courante
     * Sauf si cela créerait une date trop ancienne (>3 mois dans le passé)
   - Si AUCUNE date n'est visible (ni dans le PDF, ni dans l'email) → aujourd'hui + 7 jours
   - NE JAMAIS inventer ou modifier une date visible.

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
   - ⚠️ IMPORTANT: Si un PDF est joint (section "CONTENU DU PDF JOINT" présente), NE JAMAIS mettre skip: true
   - Les emails avec PDF contiennent généralement des factures ou documents importants, même si le corps semble promotionnel

7. EXTRACTION CONTACT:
   - Extraire l'email de l'expéditeur original (pas l'email de transfert)
   - Si un numéro de téléphone est visible dans l'email ou le PDF, l'extraire
   - CRITIQUE pour contactName - C'est L'EXPÉDITEUR, PAS le destinataire:
     * contactName = celui qui ENVOIE l'email, celui qui SIGNE le message
     * NE JAMAIS extraire le nom du DESTINATAIRE (celui qui reçoit l'email)
     * Chercher: signature en bas de l'email, nom après "De:", nom de l'expéditeur original
     * Exemple: Si "M. Alagna" envoie un email à "M. Cochennec" → contactName = "M. Alagna"
     * Si l'email est transféré, prendre le nom de l'EXPÉDITEUR ORIGINAL

8. TEMPLATES PDF SUGGÉRÉS (règles strictes):
   - Règle de base: pour un paiement ou prélèvement normal ("payer facture", "montant à régler", "paiement avant le", "prélèvement automatique"), suggestedTemplates doit être VIDE ou absent. Aucun document n'est nécessaire pour payer.
   - Ne JAMAIS proposer d'attestations, demandes ou formulaires pour un simple paiement.
   - "facture_contestation" uniquement si une contestation est EXPLICITE: "montant incorrect", "erreur de facturation", "double prélèvement", "service non reçu", "réclamation", "litige".
   - ÉCOLE (absences): si l'email décrit une absence d'enfant à l'école (maladie, rendez-vous, absence justifiée), proposer en priorité: ["ecole_absence"].
     * IMPORTANT: décrire la cause de l'absence dans "description" (cela servira à pré-remplir {{absenceReason}}).
   - SANTÉ (rendez-vous / mutuelle): si le contexte est un rendez-vous médical, proposer selon le cas:
     * prise de RDV → ["sante_rdv_medical"]
     * demande de remboursement / mutuelle → ["sante_demande_remboursement"]
     * besoin d'un certificat → ["sante_certificat_medical"]
     * IMPORTANT: mettre le type de consultation / motif dans "description" (pré-remplissage {{consultationType}} / {{certificateReason}}).
   - FACTURES (guidage): si l'email implique une contestation / réclamation, proposer "facture_contestation" et:
     * si un numéro de facture est trouvé (dans le PDF ou le corps), le mentionner clairement dans la description (ex: "Facture n° 123456").
   - Exemples:
     * Sujet: "Payer facture Selfbox - 98,00 €" → suggestedTemplates: []
     * Sujet: "Montant incorrect sur la facture" → suggestedTemplates: ["facture_contestation"]
   - Templates disponibles (utiliser seulement si pertinents): 
     * École: ecole_absence, ecole_autorisation_sortie, ecole_derogation, ecole_inscription, ecole_cantine, ecole_changement_adresse
     * Crèche: creche_inscription
     * Santé: sante_demande_remboursement, sante_rdv_medical, sante_certificat_medical, sante_resiliation_mutuelle
     * Attestations: attestation_hebergement, attestation_honneur, attestation_employeur, attestation_assurance, attestation_domicile, attestation_revenus
     * Logement: logement_preavis, contrat_resiliation, facture_contestation
     * Documents: documents_procuration, documents_reclamation
     * Travail: travail_conges
   - Suggérer 1 à 3 templates maximum, uniquement si CLAIREMENT pertinents
   - Si aucun template n'est pertinent → omis ou tableau vide

9. CATÉGORIE (doit être une de: administratif, enfants-école, santé, finances, logement, personnel):

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

10. TITRE: court et actionnable (max 60 caractères)

Réponds UNIQUEMENT avec un JSON valide (pas de texte avant ou après):
{
  "skip": boolean (true si newsletter/promo sans action, sinon false ou omis),
  "title": "string (max 60 chars, actionnable)",
  "category": "administratif|enfants-école|santé|finances|logement|personnel",
  "deadline": "YYYY-MM-DDTHH:mm:ss.sssZ (ISO format)",
  "description": "string (résumé de l'action + date trouvée si applicable)",
  "priority": "high|medium|low",
  "originalSender": "string (expéditeur original si email transféré, sinon omis)",
  "contactEmail": "string (email de contact extrait, sinon omis)",
  "contactPhone": "string (téléphone extrait au format 0X XX XX XX XX ou +33, sinon omis)",
  "contactName": "string (NOM PROPRE uniquement: 'M. Alagna', 'Jean Martin' - JAMAIS de titres comme 'Président du...')",
  "suggestedTemplates": ["template_id1", "template_id2"] (IDs des templates pertinents, max 3, ou omis),
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
 * Correct deadline if AI returned a clearly wrong date.
 * 
 * CRITICAL FIX: Do NOT auto-correct dates from the previous year if they're
 * within a reasonable range (e.g., "Décembre 2025" when we're in January 2026).
 * 
 * Only correct dates that are:
 * 1. More than 90 days in the past (clearly stale)
 * 2. Invalid/unparseable
 * 
 * Dates that should be PRESERVED as-is:
 * - Any date from the previous month of the previous year (end-of-year transition)
 * - Any date explicitly mentioned in the email with year (even if past)
 */
function correctDeadline(aiDeadline: string): string {
  try {
    const parsed = new Date(aiDeadline);
    if (isNaN(parsed.getTime())) {
      console.log(`[Date Correction] Invalid date format, using D+7: ${aiDeadline}`);
      return getDefaultDeadline();
    }

    const now = new Date();
    
    // Calculate days difference
    const daysDiff = Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
    
    // CRITICAL: Allow dates up to 90 days in the past
    // This handles:
    // - "Décembre 2025" when current date is January 2026
    // - Invoice due dates that are slightly past
    // - End-of-year transitions
    const MAX_PAST_DAYS = 90;
    
    if (daysDiff > MAX_PAST_DAYS) {
      // Date is more than 90 days in the past - likely an error
      console.log(`[Date Correction] Date too old (${daysDiff} days ago), using D+7: ${aiDeadline}`);
      return getDefaultDeadline();
    }
    
    // Date is valid and within acceptable range
    // Preserve the original date even if it's in the past
    if (daysDiff > 0) {
      console.log(`[Date Correction] Preserving recent past date (${daysDiff} days ago): ${aiDeadline}`);
    }
    
    return parsed.toISOString();
  } catch {
    console.log(`[Date Correction] Parse error, using D+7`);
    return getDefaultDeadline();
  }
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

  // Validate and normalize deadline with correction for past years
  let deadline: string;
  try {
    if (typeof obj.deadline === 'string') {
      const parsed = new Date(obj.deadline);
      if (isNaN(parsed.getTime())) {
        deadline = getDefaultDeadline();
      } else {
        // Apply date correction for past years
        deadline = correctDeadline(parsed.toISOString());
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

  const normalizedTitle = String(obj.title || 'Tâche à vérifier').slice(0, 100);
  const normalizedDescription = String(obj.description || '');
  const normalizedEmailType = String(metadataObj.emailType || 'unknown');
  const sanitizedTemplates = sanitizeSuggestedTemplates(
    suggestedTemplates,
    category,
    normalizedTitle,
    normalizedDescription,
    normalizedEmailType
  );

  return {
    title: normalizedTitle,
    category,
    deadline,
    description: normalizedDescription,
    priority,
    skip,
    originalSender,
    contactEmail,
    contactPhone,
    contactName,
    suggestedTemplates: sanitizedTemplates,
    metadata: {
      emailType: normalizedEmailType,
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
