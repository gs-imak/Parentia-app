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
   - Si le PDF ne peut pas être lu (message "[PDF JOINT: Impossible d'extraire le texte...]"):
     * Créer une tâche avec titre: "Vérifier document PDF - [expéditeur ou sujet]"
     * Catégorie: déduire du sujet/expéditeur (logement si fournisseur, finances si banque, etc.)
     * Priorité: "medium"
     * Description: "Document PDF joint nécessitant une vérification manuelle"
     * NE JAMAIS mettre skip: true
   - Analyser le PDF pour détecter: factures, relevés, convocations, documents officiels
   - Si le PDF contient une FACTURE (mots-clés: "Facture", "Invoice", "Montant à payer", "Total TTC", "Date limite de paiement", "MONTANT À RÉGLER"):
     * IMPORTANT: Extraire le MONTANT exact du PDF:
       - Chercher: "Total TTC", "Montant à payer", "Total à régler", "MONTANT À RÉGLER", "TOTAL HT"
       - Formats montants: "99,99€", "99.99€", "99,99 €", "99.99 €", "99.00 EUR" (AVEC ou SANS espace avant devise)
       - Extraire le nombre même s'il y a un espace: "98.00 €" = 98.00€
     * IMPORTANT: Extraire la DATE LIMITE du PDF:
       - Chercher: "Date limite", "Échéance", "Date de paiement", "Paiement avant le", "Date 23/11/2025"
       - Formats: JJ/MM/AAAA, DD-MM-YYYY, "le JJ/MM/AAAA"
     * Créer une tâche de paiement avec le montant ET l'échéance extraits
     * Titre: "Payer facture [fournisseur] - [montant]€" (ex: "Payer facture Selfbox - 98,00€")
     * Description: Inclure le montant exact ET la date limite trouvée dans le PDF
   - Si le PDF contient des chiffres mais PAS assez de contexte:
     * Chercher TOUS les montants (chiffres avec "," ou "." suivis optionnellement d'un espace puis "€" ou "EUR")
     * Utiliser le montant le plus élevé ou celui mentionné près de "Total" / "Montant" / "TTC" / "RÉGLER"

3. DATE LIMITE (deadline):
   - CRITIQUE: Utilise la date EXACTE visible dans l'email ou le PDF. Ne modifie PAS le jour ou le mois.
   - Si tu vois "6 décembre" → deadline = 6 décembre 2025 (PAS le 3, PAS le 7)
   - Si tu vois "31 décembre" ou "31/12" → deadline = 31 décembre 2025 (PAS le 1er janvier)
   - Si tu vois "7 décembre" dans un courrier → deadline = 7 décembre 2025 minimum (pas avant)
   - Nous sommes en décembre 2025. Pour les années ambiguës ou passées (2023, 2024), utilise 2025.
   - Extraire en priorité du PDF (date d'échéance, date limite de paiement, date de convocation)
   - Si AUCUNE date n'est visible → aujourd'hui + 7 jours
   - NE JAMAIS inventer ou modifier une date visible. Utilise EXACTEMENT ce qui est écrit.

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
   - Extraire le nom de l'expéditeur ou de l'organisation

8. TEMPLATES PDF SUGGÉRÉS:
   - IMPORTANT: Sois TRÈS conservateur avec les suggestions. NE suggère un template que s'il est VRAIMENT pertinent.
   - Pour les FACTURES:
     * NE suggère "facture_contestation" QUE si l'email ou le PDF indique explicitement un problème, une erreur, un désaccord, ou une contestation nécessaire
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
  "contactName": "string (nom de l'expéditeur/organisation, sinon omis)",
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
 * Correct deadline if AI returned a past year or clearly wrong date
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
      
      // If that date is still in the past (or within last 7 days), use D+7
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (corrected < sevenDaysAgo) {
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

  return {
    title: String(obj.title || 'Tâche à vérifier').slice(0, 100),
    category,
    deadline,
    description: String(obj.description || ''),
    priority,
    skip,
    originalSender,
    contactEmail,
    contactPhone,
    contactName,
    suggestedTemplates,
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
    
    // Debug: Log PDF text if present (first 500 chars)
    if (input.pdfText) {
      console.log(`[AI DEBUG] PDF text received (${input.pdfText.length} chars):`);
      console.log(`[AI DEBUG] PDF preview: ${input.pdfText.slice(0, 500)}...`);
    } else {
      console.log(`[AI DEBUG] No PDF text provided to AI`);
    }
    
    const aiResponse = await callOpenAI(prompt);
    
    // Debug: Log raw AI response
    console.log(`[AI DEBUG] Raw AI response: ${aiResponse}`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      console.error('AI returned invalid JSON:', aiResponse.slice(0, 200));
      return null;
    }

    const result = normalizeAIOutput(parsed);
    
    // Debug: Log extracted title specifically
    if (result) {
      console.log(`[AI DEBUG] Extracted title: "${result.title}"`);
      console.log(`[AI DEBUG] Skip flag: ${result.skip}`);
    }
    
    return result;
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
