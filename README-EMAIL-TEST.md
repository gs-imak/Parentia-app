# Milestone 3 - Email → IA → Tâche

## Vue d'ensemble

Cette fonctionnalité permet de créer automatiquement des tâches à partir d'emails reçus sur une adresse Gmail dédiée. Le système :

1. Vérifie la boîte Gmail toutes les 5 minutes (IMAP polling)
2. Extrait le contenu (sujet, corps, pièces jointes PDF)
3. Analyse avec l'IA pour extraire les informations structurées
4. Crée automatiquement une tâche
5. Notifie l'utilisateur
6. Affiche l'email traité dans l'Inbox
7. Marque l'email comme lu dans Gmail

---

## Configuration Gmail IMAP

### 1. Prérequis

- Un compte Gmail dédié (ex: `parentia.inbox@gmail.com`)
- Activer IMAP dans Gmail
- Créer un mot de passe d'application

### 2. Activer IMAP dans Gmail

1. Ouvrir Gmail
2. Cliquer sur l'engrenage → **Voir tous les paramètres**
3. Onglet **Transfert et POP/IMAP**
4. Section IMAP : cocher **Activer IMAP**
5. Cliquer **Enregistrer les modifications**

### 3. Créer un mot de passe d'application

1. Aller sur https://myaccount.google.com/apppasswords
2. Se connecter avec le compte Gmail
3. Nom de l'application : `Parentia`
4. Cliquer **Créer**
5. **Copier le mot de passe généré** (16 caractères sans espaces)

> **Note** : Si vous ne voyez pas l'option "Mots de passe d'application", vous devez d'abord activer la validation en 2 étapes.

### 4. Variables d'environnement (Railway)

```bash
# Gmail IMAP (obligatoire)
IMAP_USER=parentia.inbox@gmail.com
IMAP_PASSWORD=xxxx xxxx xxxx xxxx    # Mot de passe d'application

# Configuration optionnelle
IMAP_HOST=imap.gmail.com             # Par défaut
IMAP_PORT=993                         # Par défaut
EMAIL_POLL_INTERVAL=300000           # 5 minutes en ms (par défaut)

# OpenAI (pour l'analyse IA)
OPENAI_API_KEY=sk-xxxxx

# Supabase (pour les pièces jointes)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

### 5. Format d'adresse email

Utilisez directement l'adresse Gmail configurée :
```
parentia.inbox@gmail.com
```

Ou avec un alias (+) pour catégoriser :
```
parentia.inbox+factures@gmail.com
parentia.inbox+ecole@gmail.com
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
