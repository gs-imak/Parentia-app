# Milestone 4 – Création de tâche depuis une image

## Fonctionnalité

Cette fonctionnalité permet de créer une tâche automatiquement à partir d'une image :
- **Photo d'un courrier papier** (lettre, convocation, facture, formulaire...)
- **Capture d'écran** (WhatsApp, SMS, email, notification...)

## Pipeline

```
Image (JPG/PNG) → Upload → OCR (GPT-4 Vision) → Analyse IA → JSON → Tâche créée
```

## Comment tester

### Prérequis

1. **Backend** : `npm run dev` (avec `OPENAI_API_KEY` configuré)
2. **Mobile** : `cd mobile && npx expo start`

### Test avec une photo de courrier

1. Ouvrez l'application sur iOS ou Android
2. Allez dans l'onglet **Tâches**
3. Cliquez sur le bouton **"📷 Créer depuis une photo"**
4. Choisissez **"Appareil photo"**
5. Prenez une photo d'un courrier (CAF, impôts, facture, convocation...)
6. Attendez le message **"Analyse en cours..."** (5-15 secondes)
7. Une tâche est automatiquement créée avec :
   - Titre actionnable (ex: "Envoyer justificatifs à la CAF")
   - Catégorie appropriée
   - Date d'échéance (si détectée dans le document)
   - Description avec contexte

### Test avec une capture d'écran

1. Faites d'abord une capture d'écran d'un message WhatsApp/SMS
2. Ouvrez l'application
3. Allez dans l'onglet **Tâches**
4. Cliquez sur **"📷 Créer depuis une photo"**
5. Choisissez **"Galerie"**
6. Sélectionnez la capture d'écran
7. La tâche est créée avec le contexte du message

### Test sur le web

Sur le web, l'image picker ouvre le sélecteur de fichiers natif du navigateur.

## Cas d'usage supportés

| Type de document | Exemple | Catégorie attendue |
|-----------------|---------|-------------------|
| Courrier CAF | Demande de justificatifs | administratif |
| Avis d'imposition | Déclaration, échéance fiscale | finances |
| Facture électricité | EDF, Engie | logement |
| Facture téléphone | Orange, SFR, Free | logement |
| Convocation médicale | RDV médecin, vaccin | santé |
| Message école | Réunion parents, sortie | enfants-école |
| WhatsApp nounou | Horaires, organisation | enfants-école |
| SMS médecin | Confirmation RDV | santé |

## Limitations connues

### Images illisibles

Si l'image est trop floue, trop sombre, ou si le texte est illisible :
- Un message d'erreur s'affiche : **"Image illisible ou non exploitable"**
- Aucune tâche n'est créée
- **Solution** : reprendre la photo avec un meilleur éclairage/focus

### Formats supportés

- ✅ JPEG / JPG
- ✅ PNG
- ❌ HEIC (converti automatiquement en JPEG par expo-image-picker)
- ❌ GIF, WebP, PDF

### Limite de taille

- Maximum **10 MB** par image
- Les photos haute résolution sont automatiquement compressées (qualité 80%)

### Temps de traitement

- Typiquement **5-15 secondes** selon la complexité de l'image
- Un indicateur "Analyse en cours..." est affiché pendant le traitement

## Structure technique

### Backend

| Fichier | Description |
|---------|-------------|
| `src/imageAI.ts` | Module GPT-4 Vision (prompt, appel API, normalisation) |
| `src/index.ts` | Endpoint `POST /tasks/from-image` |
| `src/tasks.ts` | Type étendu avec `source: 'photo'` et `imageUrl` |

### Mobile

| Fichier | Description |
|---------|-------------|
| `mobile/src/api/client.ts` | Fonction `createTaskFromImage()` |
| `mobile/src/screens/TasksScreen.tsx` | UI du bouton photo et modal de sélection |

## Variables d'environnement requises

```env
OPENAI_API_KEY=sk-...       # Clé API OpenAI (requise pour GPT-4 Vision)
SUPABASE_URL=...            # URL Supabase (optionnel, pour stockage image)
SUPABASE_ANON_KEY=...       # Clé Supabase (optionnel)
```

## Logs backend

Les logs de traitement sont préfixés par `[Image]` :

```
[Image] POST /tasks/from-image received
[Image] File received: photo_123.jpg, image/jpeg, 2048000 bytes
[Image] Uploaded to Supabase: https://...
[Image] Analyzing with GPT-4 Vision...
[Image AI] Analysis complete: "Payer facture EDF - 89,50€" (logement, confidence: 0.92)
[Image] Task created: 123456789abc
```
