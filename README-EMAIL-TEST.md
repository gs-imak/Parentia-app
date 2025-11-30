# Milestone 3 - Email → IA → Tâche

## Vue d'ensemble

Cette fonctionnalité permet de créer automatiquement des tâches à partir d'emails reçus sur le domaine `hcfamily.app`. Le système :

1. Reçoit les emails via SendGrid Inbound Parse (webhook instantané)
2. Extrait le contenu (sujet, corps, pièces jointes PDF)
3. Analyse avec l'IA pour extraire les informations structurées
4. Crée automatiquement une tâche
5. Notifie l'utilisateur
6. Affiche l'email traité dans l'Inbox

---

## Configuration SendGrid Inbound Parse

### 1. Prérequis (déjà configurés)

- ✅ Domaine `hcfamily.app` vérifié dans SendGrid (CNAME + DKIM)
- ✅ Enregistrement MX pointant vers `mx.sendgrid.net`
- ✅ Inbound Parse configuré avec webhook URL

### 2. Configuration actuelle

| Paramètre | Valeur |
|-----------|--------|
| Domaine | `hcfamily.app` |
| MX Record | `mx.sendgrid.net` (priorité 10) |
| Webhook URL | `https://parentia-app-production.up.railway.app/email/inbound` |
| Send Raw | ON (pour les pièces jointes) |

### 3. Variables d'environnement (Railway)

```bash
# OpenAI (pour l'analyse IA)
OPENAI_API_KEY=sk-xxxxx

# Supabase (pour les pièces jointes)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# IMAP (optionnel - fallback si SendGrid indisponible)
# IMAP_USER=
# IMAP_PASSWORD=
```

### 4. Format d'adresse email

Adresse de base :
```
inbox@hcfamily.app
```

Adresse avec identifiant utilisateur (pour multi-utilisateurs) :
```
user+{userId}@hcfamily.app
```

Exemples :
```
user+abc123@hcfamily.app
user+famille-dupont@hcfamily.app
```

---

## Test manuel

### Option A : Envoyer un vrai email

1. Envoyez un email à l'adresse Gmail configurée
2. Attendez jusqu'à 5 minutes (ou déclenchez manuellement)
3. Vérifiez l'Inbox dans l'application

### Option B : Déclencher manuellement la vérification

```bash
# Déclencher une vérification immédiate
curl -X POST https://parentia-app-production.up.railway.app/email/check

# Vérifier le statut du service de polling
curl https://parentia-app-production.up.railway.app/email/status
```

### Option C : Test local

```bash
# Démarrer le serveur
npm run dev

# Dans un autre terminal, déclencher la vérification
curl -X POST http://localhost:5000/email/check
```

---

## Cas de test validés

### ✅ École (enfants-école)

**Email :**
```
De: secretariat@ecole-victor-hugo.fr
Sujet: Convocation réunion parents - 15 décembre
Corps: Chers parents, vous êtes convoqués à la réunion parents-professeurs 
le 15 décembre à 18h...
```

**Résultat attendu :**
- Tâche créée : "Réunion parents-professeurs"
- Catégorie : enfants-école
- Deadline : 15 décembre
- Priorité : medium

---

### ✅ Facture (finances)

**Email :**
```
De: noreply@edf.fr
Sujet: Facture EDF - Échéance 10/01/2026
Corps: Votre facture de 156,78€ est disponible. Date limite : 10/01/2026.
```

**Résultat attendu :**
- Tâche créée : "Payer facture EDF - 156,78€"
- Catégorie : finances
- Deadline : 10 janvier 2026
- Priorité : medium

---

### ✅ Impôts (finances)

**Email :**
```
De: impots@dgfip.finances.gouv.fr
Sujet: Avis d'imposition 2025
Corps: Votre avis d'imposition est disponible. Date limite de paiement : 15/09/2025.
```

**Résultat attendu :**
- Tâche créée : "Payer impôts 2025"
- Catégorie : finances
- Deadline : 15 septembre 2025
- Priorité : high

---

### ✅ Santé (santé)

**Email :**
```
De: cabinet@dr-dupont.fr
Sujet: Rappel RDV vaccin - 5 janvier
Corps: Rappel : rendez-vous vaccin pour votre enfant le 5 janvier à 14h.
```

**Résultat attendu :**
- Tâche créée : "RDV vaccin enfant"
- Catégorie : santé
- Deadline : 5 janvier
- Priorité : medium

---

### ✅ Administratif (administratif)

**Email :**
```
De: caf@caf.fr
Sujet: Mise à jour dossier allocations
Corps: Veuillez fournir les justificatifs demandés avant le 30 novembre.
```

**Résultat attendu :**
- Tâche créée : "Fournir justificatifs CAF"
- Catégorie : administratif
- Deadline : 30 novembre
- Priorité : medium

---

### ✅ PDF avec date

**Email avec PDF joint :**
```
Sujet: Document important
Corps: Veuillez trouver ci-joint...
PDF: Contient "Date limite : 25/12/2025"
```

**Résultat attendu :**
- La date du PDF (25/12/2025) est utilisée comme deadline
- Le contenu du PDF enrichit la description

---

### ✅ Email sans date

**Email :**
```
Sujet: Information importante
Corps: Merci de prendre connaissance de ce message.
```

**Résultat attendu :**
- Deadline : date du jour + 7 jours
- Catégorie : administratif (par défaut)

---

### ✅ Email non exploitable

**Email :**
```
De: newsletter@spam.com
Sujet: (vide)
Corps: (vide)
```

**Résultat attendu :**
- Entrée Inbox avec status "error"
- Message d'erreur affiché
- Aucune tâche créée

---

## Vérification des résultats

### Via l'application

1. Ouvrir l'onglet **Inbox** 
2. L'email doit apparaître avec :
   - ✅ Icône verte si succès
   - ❌ Icône rouge si erreur
   - Titre de la tâche créée
   - Lien vers la pièce jointe (si applicable)

### Via l'API

```bash
# Liste des emails traités
curl https://parentia-app-production.up.railway.app/inbox

# Liste des tâches
curl https://parentia-app-production.up.railway.app/tasks

# Notifications
curl https://parentia-app-production.up.railway.app/notifications
```

---

## Dépannage

### L'email n'arrive pas

1. Vérifier les MX records (propagation DNS peut prendre 24h)
2. Vérifier la configuration Inbound Parse dans SendGrid
3. Consulter les logs SendGrid : Activity > Inbound Parse
4. Consulter les logs Railway pour erreurs webhook

### La tâche n'est pas créée

1. Vérifier que `OPENAI_API_KEY` est configurée
2. Consulter les logs Railway pour erreurs AI
3. Tester avec un email simple (sujet + corps texte)

### Le PDF n'est pas analysé

1. Vérifier que le PDF contient du texte (pas un scan/image)
2. Taille max : 10 MB
3. Seul le premier PDF est traité

---

## Limites V1

- 1 tâche par email (pas de multi-actions)
- PDF texte uniquement (pas OCR pour images/scans)
- Single user (pas de multi-utilisateurs)
- Pas de réponse automatique à l'expéditeur
