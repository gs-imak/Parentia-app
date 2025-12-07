/**
 * PDF Templates for Milestone 5
 * 20 document templates for common family administrative tasks
 */

export type TemplateCategory = 
  | 'ecole' 
  | 'creche' 
  | 'sante_mutuelle' 
  | 'attestation' 
  | 'logement' 
  | 'contrat_facture' 
  | 'documents' 
  | 'travail';

export type TemplateType = 'lettre' | 'attestation' | 'formulaire' | 'note';

export interface PDFTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  type: TemplateType;
  variables: string[];
  template: string;
  // Map template category to task category for suggestions
  taskCategories: string[];
}

export const PDF_TEMPLATES: PDFTemplate[] = [
  // ============================================
  // ÉCOLE (6 templates)
  // ============================================
  {
    id: 'ecole_absence',
    label: 'Justificatif d\'absence scolaire',
    category: 'ecole',
    type: 'lettre',
    variables: ['parentName', 'childName', 'childClass', 'absenceDate', 'absenceReason', 'schoolName', 'city', 'date'],
    taskCategories: ['enfants-école'],
    template: `{{city}}, le {{date}}

Objet : Justificatif d'absence de {{childName}}

Madame, Monsieur,

Je soussigné(e) {{parentName}}, parent de {{childName}}, élève en classe de {{childClass}}, vous prie de bien vouloir excuser son absence du {{absenceDate}}.

Cette absence est due à : {{absenceReason}}.

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'ecole_autorisation_sortie',
    label: 'Autorisation de sortie scolaire',
    category: 'ecole',
    type: 'formulaire',
    variables: ['parentName', 'childName', 'childClass', 'sortieDate', 'sortieDestination', 'schoolName', 'city', 'date'],
    taskCategories: ['enfants-école'],
    template: `AUTORISATION DE SORTIE SCOLAIRE

Je soussigné(e) {{parentName}}, responsable légal de l'élève {{childName}}, en classe de {{childClass}}, autorise mon enfant à participer à la sortie scolaire prévue le {{sortieDate}} à {{sortieDestination}}.

Fait à {{city}}, le {{date}}

Signature du responsable légal :


{{parentName}}`
  },
  {
    id: 'ecole_derogation',
    label: 'Demande de dérogation scolaire',
    category: 'ecole',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'childName', 'childBirthDate', 'currentSchool', 'requestedSchool', 'derogationReason', 'city', 'date'],
    taskCategories: ['enfants-école', 'administratif'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}

{{city}}, le {{date}}

À l'attention de Monsieur/Madame l'Inspecteur(trice) d'Académie

Objet : Demande de dérogation scolaire pour {{childName}}

Madame, Monsieur l'Inspecteur(trice),

Je soussigné(e) {{parentName}}, parent de {{childName}}, né(e) le {{childBirthDate}}, actuellement scolarisé(e) à {{currentSchool}}, sollicite une dérogation afin que mon enfant puisse être inscrit(e) à {{requestedSchool}}.

Les raisons de cette demande sont les suivantes :
{{derogationReason}}

Je reste à votre disposition pour tout renseignement complémentaire et vous prie d'agréer, Madame, Monsieur l'Inspecteur(trice), l'expression de mes respectueuses salutations.

{{parentName}}`
  },
  {
    id: 'ecole_inscription',
    label: 'Demande d\'inscription scolaire',
    category: 'ecole',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'childName', 'childBirthDate', 'requestedClass', 'schoolName', 'schoolYear', 'city', 'date'],
    taskCategories: ['enfants-école', 'administratif'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}

{{city}}, le {{date}}

À l'attention de Monsieur/Madame le/la Directeur(trice)
{{schoolName}}

Objet : Demande d'inscription pour l'année scolaire {{schoolYear}}

Madame, Monsieur le/la Directeur(trice),

Je soussigné(e) {{parentName}}, ai l'honneur de solliciter l'inscription de mon enfant {{childName}}, né(e) le {{childBirthDate}}, en classe de {{requestedClass}} pour l'année scolaire {{schoolYear}}.

Vous trouverez ci-joint les documents nécessaires à la constitution du dossier.

Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur le/la Directeur(trice), l'expression de mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'ecole_cantine',
    label: 'Inscription à la cantine',
    category: 'ecole',
    type: 'formulaire',
    variables: ['parentName', 'childName', 'childClass', 'lunchDays', 'allergies', 'schoolName', 'city', 'date'],
    taskCategories: ['enfants-école'],
    template: `INSCRIPTION AU SERVICE DE RESTAURATION SCOLAIRE

École : {{schoolName}}

Nom de l'enfant : {{childName}}
Classe : {{childClass}}

Jours de présence à la cantine :
{{lunchDays}}

Allergies alimentaires / Régime spécial :
{{allergies}}

Je soussigné(e) {{parentName}}, responsable légal de l'enfant susmentionné, demande son inscription au service de restauration scolaire.

Fait à {{city}}, le {{date}}

Signature :


{{parentName}}`
  },
  {
    id: 'ecole_changement_adresse',
    label: 'Notification de changement d\'adresse',
    category: 'ecole',
    type: 'lettre',
    variables: ['parentName', 'newAddress', 'newPostalCode', 'newCity', 'childName', 'childClass', 'effectiveDate', 'schoolName', 'city', 'date'],
    taskCategories: ['enfants-école', 'administratif'],
    template: `{{parentName}}
{{newAddress}}
{{newPostalCode}} {{newCity}}

{{city}}, le {{date}}

À l'attention de Monsieur/Madame le/la Directeur(trice)
{{schoolName}}

Objet : Changement d'adresse

Madame, Monsieur le/la Directeur(trice),

Je vous informe de notre changement d'adresse à compter du {{effectiveDate}}.

Notre nouvelle adresse est :
{{newAddress}}
{{newPostalCode}} {{newCity}}

Cette modification concerne l'élève {{childName}}, en classe de {{childClass}}.

Je vous prie de bien vouloir mettre à jour le dossier de mon enfant.

Cordialement,

{{parentName}}`
  },

  // ============================================
  // CRÈCHE (1 template)
  // ============================================
  {
    id: 'creche_inscription',
    label: 'Demande d\'inscription en crèche',
    category: 'creche',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'parentPhone', 'childName', 'childBirthDate', 'crecheName', 'startDate', 'city', 'date'],
    taskCategories: ['enfants-école', 'administratif'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}
Tél : {{parentPhone}}

{{city}}, le {{date}}

À l'attention de Monsieur/Madame le/la Directeur(trice)
{{crecheName}}

Objet : Demande d'inscription en crèche

Madame, Monsieur le/la Directeur(trice),

Je soussigné(e) {{parentName}}, sollicite l'inscription de mon enfant {{childName}}, né(e) le {{childBirthDate}}, au sein de votre établissement à compter du {{startDate}}.

Je reste à votre disposition pour vous fournir tout document complémentaire et pour convenir d'un rendez-vous.

Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur le/la Directeur(trice), l'expression de mes salutations distinguées.

{{parentName}}`
  },

  // ============================================
  // SANTÉ / MUTUELLE (4 templates)
  // ============================================
  {
    id: 'sante_demande_remboursement',
    label: 'Demande de remboursement mutuelle',
    category: 'sante_mutuelle',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'mutuelleRef', 'prestationType', 'prestationDate', 'prestationAmount', 'mutuelleName', 'city', 'date'],
    taskCategories: ['santé'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}

Réf. adhérent : {{mutuelleRef}}

{{city}}, le {{date}}

{{mutuelleName}}

Objet : Demande de remboursement

Madame, Monsieur,

Je vous adresse ci-joint les justificatifs relatifs à {{prestationType}} effectué(e) le {{prestationDate}}, pour un montant de {{prestationAmount}} €.

Je vous prie de bien vouloir procéder au remboursement conformément à mon contrat.

Vous remerciant par avance, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'sante_rdv_medical',
    label: 'Demande de rendez-vous médical',
    category: 'sante_mutuelle',
    type: 'lettre',
    variables: ['parentName', 'parentPhone', 'patientName', 'consultationType', 'preferredDates', 'doctorName', 'city', 'date'],
    taskCategories: ['santé'],
    template: `{{city}}, le {{date}}

À l'attention de {{doctorName}}

Objet : Demande de rendez-vous - {{consultationType}}

Madame, Monsieur,

Je souhaiterais obtenir un rendez-vous pour {{patientName}} afin de {{consultationType}}.

Mes disponibilités sont les suivantes :
{{preferredDates}}

Vous pouvez me joindre au {{parentPhone}}.

Dans l'attente de votre retour, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'sante_certificat_medical',
    label: 'Demande de certificat médical',
    category: 'sante_mutuelle',
    type: 'lettre',
    variables: ['parentName', 'patientName', 'certificateReason', 'doctorName', 'city', 'date'],
    taskCategories: ['santé'],
    template: `{{city}}, le {{date}}

À l'attention de {{doctorName}}

Objet : Demande de certificat médical

Madame, Monsieur,

Je sollicite un certificat médical pour {{patientName}} attestant de son aptitude / inaptitude à {{certificateReason}}.

Ce document est nécessaire pour des raisons administratives.

Je vous remercie par avance et vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'sante_resiliation_mutuelle',
    label: 'Résiliation de mutuelle',
    category: 'sante_mutuelle',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'mutuelleRef', 'resiliationDate', 'resiliationReason', 'mutuelleName', 'city', 'date'],
    taskCategories: ['santé', 'administratif'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}

Réf. adhérent : {{mutuelleRef}}

{{city}}, le {{date}}

{{mutuelleName}}
Service Résiliation

Objet : Demande de résiliation - Réf. {{mutuelleRef}}

Madame, Monsieur,

Par la présente, je vous informe de ma décision de résilier mon contrat de mutuelle santé, référence {{mutuelleRef}}, à compter du {{resiliationDate}}.

Motif : {{resiliationReason}}

Je vous prie de bien vouloir me confirmer la prise en compte de cette résiliation et de m'adresser le solde de tout compte le cas échéant.

Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

{{parentName}}`
  },

  // ============================================
  // ATTESTATIONS (6 templates)
  // ============================================
  {
    id: 'attestation_hebergement',
    label: 'Attestation d\'hébergement',
    category: 'attestation',
    type: 'attestation',
    variables: ['hostName', 'hostAddress', 'hostPostalCode', 'hostCity', 'guestName', 'guestBirthDate', 'guestBirthPlace', 'startDate', 'city', 'date'],
    taskCategories: ['administratif', 'logement'],
    template: `ATTESTATION D'HÉBERGEMENT

Je soussigné(e) {{hostName}}, demeurant au :
{{hostAddress}}
{{hostPostalCode}} {{hostCity}}

Atteste sur l'honneur héberger à mon domicile :
{{guestName}}
Né(e) le : {{guestBirthDate}}
À : {{guestBirthPlace}}

Et ce depuis le {{startDate}}.

Cette attestation est établie pour servir et valoir ce que de droit.

Fait à {{city}}, le {{date}}

Signature :


{{hostName}}`
  },
  {
    id: 'attestation_honneur',
    label: 'Attestation sur l\'honneur',
    category: 'attestation',
    type: 'attestation',
    variables: ['declarantName', 'declarantAddress', 'declarantPostalCode', 'declarantCity', 'declarationContent', 'city', 'date'],
    taskCategories: ['administratif'],
    template: `ATTESTATION SUR L'HONNEUR

Je soussigné(e) {{declarantName}}, demeurant au :
{{declarantAddress}}
{{declarantPostalCode}} {{declarantCity}}

Atteste sur l'honneur :

{{declarationContent}}

Je suis informé(e) que toute fausse déclaration m'expose à des poursuites pénales.

Fait pour servir et valoir ce que de droit.

Fait à {{city}}, le {{date}}

Signature :


{{declarantName}}`
  },
  {
    id: 'attestation_employeur',
    label: 'Demande d\'attestation employeur',
    category: 'attestation',
    type: 'lettre',
    variables: ['employeeName', 'employeePosition', 'attestationType', 'attestationPurpose', 'employerName', 'city', 'date'],
    taskCategories: ['travail', 'administratif'],
    template: `{{city}}, le {{date}}

À l'attention du Service des Ressources Humaines
{{employerName}}

Objet : Demande d'attestation - {{attestationType}}

Madame, Monsieur,

Je soussigné(e) {{employeeName}}, occupant le poste de {{employeePosition}}, sollicite la délivrance d'une attestation de {{attestationType}}.

Ce document m'est nécessaire pour {{attestationPurpose}}.

Je vous remercie par avance et reste à votre disposition.

Cordialement,

{{employeeName}}`
  },
  {
    id: 'attestation_assurance',
    label: 'Demande d\'attestation d\'assurance',
    category: 'attestation',
    type: 'lettre',
    variables: ['parentName', 'parentAddress', 'parentPostalCode', 'parentCity', 'contractRef', 'attestationType', 'insurerName', 'city', 'date'],
    taskCategories: ['logement', 'administratif'],
    template: `{{parentName}}
{{parentAddress}}
{{parentPostalCode}} {{parentCity}}

Réf. contrat : {{contractRef}}

{{city}}, le {{date}}

{{insurerName}}

Objet : Demande d'attestation d'assurance

Madame, Monsieur,

Je vous prie de bien vouloir me faire parvenir une attestation d'assurance {{attestationType}} pour le contrat référencé ci-dessus.

Ce document m'est nécessaire pour des démarches administratives.

Je vous remercie par avance et vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{parentName}}`
  },
  {
    id: 'attestation_domicile',
    label: 'Attestation de domicile',
    category: 'attestation',
    type: 'attestation',
    variables: ['declarantName', 'declarantAddress', 'declarantPostalCode', 'declarantCity', 'residenceSince', 'city', 'date'],
    taskCategories: ['administratif', 'logement'],
    template: `ATTESTATION DE DOMICILE

Je soussigné(e) {{declarantName}}, atteste sur l'honneur résider à l'adresse suivante :

{{declarantAddress}}
{{declarantPostalCode}} {{declarantCity}}

Et ce depuis le {{residenceSince}}.

Cette attestation est établie pour servir et valoir ce que de droit.

Fait à {{city}}, le {{date}}

Signature :


{{declarantName}}`
  },
  {
    id: 'attestation_revenus',
    label: 'Attestation de revenus',
    category: 'attestation',
    type: 'attestation',
    variables: ['declarantName', 'declarantAddress', 'declarantPostalCode', 'declarantCity', 'monthlyIncome', 'incomeSource', 'city', 'date'],
    taskCategories: ['finances', 'administratif'],
    template: `ATTESTATION DE REVENUS

Je soussigné(e) {{declarantName}}, demeurant au :
{{declarantAddress}}
{{declarantPostalCode}} {{declarantCity}}

Atteste sur l'honneur percevoir un revenu mensuel de {{monthlyIncome}} € provenant de {{incomeSource}}.

Je suis informé(e) que toute fausse déclaration m'expose à des poursuites pénales.

Fait pour servir et valoir ce que de droit.

Fait à {{city}}, le {{date}}

Signature :


{{declarantName}}`
  },

  // ============================================
  // LOGEMENT (1 template)
  // ============================================
  {
    id: 'logement_preavis',
    label: 'Lettre de préavis de départ',
    category: 'logement',
    type: 'lettre',
    variables: ['tenantName', 'tenantAddress', 'tenantPostalCode', 'tenantCity', 'landlordName', 'landlordAddress', 'leaveDate', 'preavisReason', 'city', 'date'],
    taskCategories: ['logement', 'administratif'],
    template: `{{tenantName}}
{{tenantAddress}}
{{tenantPostalCode}} {{tenantCity}}

{{city}}, le {{date}}

{{landlordName}}
{{landlordAddress}}

Lettre recommandée avec accusé de réception

Objet : Congé du logement

Madame, Monsieur,

Par la présente, je vous informe de ma décision de quitter le logement situé au {{tenantAddress}}, {{tenantPostalCode}} {{tenantCity}}, que j'occupe en tant que locataire.

Conformément aux dispositions légales, je respecterai un préavis de {{preavisReason}}.

La date effective de mon départ sera le {{leaveDate}}.

Je reste à votre disposition pour convenir d'une date de remise des clés et d'état des lieux de sortie.

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

{{tenantName}}`
  },

  // ============================================
  // CONTRAT / FACTURE (2 templates)
  // ============================================
  {
    id: 'contrat_resiliation',
    label: 'Résiliation de contrat',
    category: 'contrat_facture',
    type: 'lettre',
    variables: ['customerName', 'customerAddress', 'customerPostalCode', 'customerCity', 'contractRef', 'serviceName', 'resiliationDate', 'resiliationReason', 'providerName', 'city', 'date'],
    taskCategories: ['logement', 'administratif'],
    template: `{{customerName}}
{{customerAddress}}
{{customerPostalCode}} {{customerCity}}

Réf. client/contrat : {{contractRef}}

{{city}}, le {{date}}

{{providerName}}
Service Résiliation

Objet : Résiliation de contrat {{serviceName}}

Madame, Monsieur,

Par la présente, je vous notifie ma décision de résilier mon contrat {{serviceName}}, référence {{contractRef}}.

Cette résiliation prendra effet le {{resiliationDate}}.

Motif : {{resiliationReason}}

Je vous prie de bien vouloir me confirmer la prise en compte de cette résiliation.

Veuillez agréer, Madame, Monsieur, mes salutations distinguées.

{{customerName}}`
  },
  {
    id: 'facture_contestation',
    label: 'Contestation de facture',
    category: 'contrat_facture',
    type: 'lettre',
    variables: ['customerName', 'customerAddress', 'customerPostalCode', 'customerCity', 'customerRef', 'invoiceRef', 'invoiceDate', 'invoiceAmount', 'contestationReason', 'providerName', 'city', 'date'],
    taskCategories: ['logement', 'finances'],
    template: `{{customerName}}
{{customerAddress}}
{{customerPostalCode}} {{customerCity}}

Réf. client : {{customerRef}}

{{city}}, le {{date}}

{{providerName}}
Service Réclamations

Objet : Contestation de la facture n°{{invoiceRef}}

Madame, Monsieur,

Je me permets de contester la facture n°{{invoiceRef}} du {{invoiceDate}}, d'un montant de {{invoiceAmount}} €.

En effet, {{contestationReason}}.

Je vous prie de bien vouloir procéder à la vérification et, le cas échéant, à la régularisation de ma situation.

Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

{{customerName}}`
  },

  // ============================================
  // DOCUMENTS DIVERS (2 templates)
  // ============================================
  {
    id: 'documents_procuration',
    label: 'Procuration',
    category: 'documents',
    type: 'attestation',
    variables: ['mandantName', 'mandantBirthDate', 'mandantBirthPlace', 'mandantAddress', 'mandantPostalCode', 'mandantCity', 'mandataireName', 'mandataireBirthDate', 'mandataireBirthPlace', 'procurationObject', 'validityDate', 'city', 'date'],
    taskCategories: ['administratif'],
    template: `PROCURATION

Je soussigné(e) :
Nom : {{mandantName}}
Né(e) le : {{mandantBirthDate}} à {{mandantBirthPlace}}
Demeurant : {{mandantAddress}}, {{mandantPostalCode}} {{mandantCity}}

Donne pouvoir à :
Nom : {{mandataireName}}
Né(e) le : {{mandataireBirthDate}} à {{mandataireBirthPlace}}

Pour me représenter et agir en mon nom afin de :
{{procurationObject}}

Cette procuration est valable jusqu'au {{validityDate}}.

Fait à {{city}}, le {{date}}

Signature du mandant :                    Signature du mandataire :


{{mandantName}}                           {{mandataireName}}`
  },
  {
    id: 'documents_reclamation',
    label: 'Lettre de réclamation générale',
    category: 'documents',
    type: 'lettre',
    variables: ['senderName', 'senderAddress', 'senderPostalCode', 'senderCity', 'recipientName', 'reclamationSubject', 'reclamationDetails', 'requestedAction', 'city', 'date'],
    taskCategories: ['administratif'],
    template: `{{senderName}}
{{senderAddress}}
{{senderPostalCode}} {{senderCity}}

{{city}}, le {{date}}

{{recipientName}}

Objet : Réclamation - {{reclamationSubject}}

Madame, Monsieur,

Je me permets de vous adresser cette réclamation concernant {{reclamationSubject}}.

{{reclamationDetails}}

En conséquence, je vous demande de bien vouloir {{requestedAction}}.

Dans l'attente de votre réponse rapide, je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

{{senderName}}`
  },

  // ============================================
  // TRAVAIL (1 template)
  // ============================================
  {
    id: 'travail_conges',
    label: 'Demande de congés',
    category: 'travail',
    type: 'lettre',
    variables: ['employeeName', 'employeePosition', 'startDate', 'endDate', 'returnDate', 'congesType', 'employerName', 'city', 'date'],
    taskCategories: ['travail', 'administratif'],
    template: `{{city}}, le {{date}}

À l'attention du Service des Ressources Humaines
{{employerName}}

Objet : Demande de {{congesType}}

Madame, Monsieur,

Je soussigné(e) {{employeeName}}, occupant le poste de {{employeePosition}}, souhaite poser des {{congesType}} du {{startDate}} au {{endDate}} inclus.

Ma reprise de travail est prévue le {{returnDate}}.

Je reste à votre disposition pour tout renseignement complémentaire.

Cordialement,

{{employeeName}}`
  }
];

/**
 * Get all templates
 */
export function getAllTemplates(): PDFTemplate[] {
  return PDF_TEMPLATES;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): PDFTemplate | undefined {
  return PDF_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): PDFTemplate[] {
  return PDF_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get templates suggested for a task category
 */
export function getTemplatesForTaskCategory(taskCategory: string): PDFTemplate[] {
  return PDF_TEMPLATES.filter(t => t.taskCategories.includes(taskCategory));
}

/**
 * Get template IDs that match a task category
 * Used by AI for suggestions
 */
export function getSuggestedTemplateIds(taskCategory: string): string[] {
  return getTemplatesForTaskCategory(taskCategory).map(t => t.id);
}
