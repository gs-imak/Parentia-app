# Parentia - AI Pipeline (Milestone 0)
Petit backend minimal pour tester le pipeline texte → IA → JSON → validation.

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Le serveur démarre sur :
`http://localhost:5000`

## Test rapide — endpoint /parse (Milestone 0)

### Via PowerShell
```powershell
curl.exe -X POST http://localhost:5000/parse ^
  -H "Content-Type: application/json" ^
  -d "{\"text\": \"Ceci est un test\"}"
```

### Via CMD
```bash
curl -X POST http://localhost:5000/parse \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Ceci est un test\"}"
```

### Réponse attendue (mock)

```json
{
  "success": true,
  "data": {
    "summary": "Mock summary of: Ceci est un test...",
    "items": ["item1", "item2", "item3"],
    "category": "general"
  }
}
```

### Exemple d’erreur

```json
{
  "success": false,
  "error": "Missing or invalid \"text\" field"
}
```

## Mode Mock / Mode Réel

- **Mock (par défaut)** : renvoie des données statiques, aucun compte OpenAI nécessaire.
- **Mode réel** :
  - dupliquez `.env.example` → `.env`
  - ajoutez `OPENAI_API_KEY=your_key`

---

# Milestone 1 — Application Unifiée React Native (Mobile + Web)

Parentia utilise désormais une **architecture React Native unifiée** avec **NativeBase** pour l'interface utilisateur, permettant de partager le même code entre mobile (iOS/Android) et web.

## Architecture

- **Backend** : Node.js/Express (racine du projet) — expose les APIs
- **Frontend** : React Native dans `mobile/` — fonctionne sur mobile ET web
- **UI Library** : NativeBase — composants cross-platform avec design moderne

## Lancer l'application

### Option 1 : Mode Production (Web via Backend)

1. Construire le web bundle :
   ```bash
   cd mobile
   npx expo export --platform web
   cd ..
   ```

2. Construire et démarrer le backend :
   ```bash
   npm run build
   npm start
   ```

3. Ouvrir le navigateur sur :
   ```
   http://localhost:5000/
   ```

### Option 2 : Mode Développement (Web)

Pour développer avec hot-reload :
```bash
cd mobile
npm run web
```

L'app s'ouvre sur `http://localhost:8081` (ou 8082 si le port est occupé).

### Option 3 : Mobile (Expo Go)

```bash
cd mobile
npm start
```

Puis scannez le QR code avec Expo Go (Android) ou l'app Caméra (iOS).

Vous verrez une navigation avec quatre onglets : **Home**, **Tâches**, **Inbox**, **Profil**.
Seul l'onglet **Home** est pleinement fonctionnel pour ce milestone.

## Contenu de l’écran Home

1. **Bloc Météo & habits**
   - Utilise l’API Open-Meteo (géocoding + météo actuelle).
   - La ville ou le code postal sont saisis dans l’onglet **Profil** et stockés localement dans le navigateur.
   - L’API backend `/weather` applique les règles d’habillage enfants :
     - `< 5°C` : manteau épais, bonnet, gants
     - `5–12°C` : manteau chaud + pull
     - `12–18°C` : manteau léger + pull
     - `18–22°C` : t-shirt + petite veste
     - `≥ 22°C` : t-shirt léger
     - Pluie : pantalon étanche + bottes + manteau imperméable
     - Neige : combinaison + bottes neige + gants imperméables
     - Vent fort (≥ 30 km/h) : ajouter coupe-vent, bonnet léger ou tour de cou

2. **Bloc Citation (matin / soir)**
   - Appelle l’endpoint `/quote`.
   - Avant 17h : citation du matin, parmi 30 citations.
   - À partir de 17h : citation du soir, parmi 30 citations.
   - Tirage aléatoire avec mémoire pour éviter les répétitions immédiates.

3. **Bloc Tâches du jour**
   - Appelle l’endpoint `/tasks/today`.
   - Retourne jusqu’à **trois tâches mockées**, triées par deadline croissante.
   - Si aucune tâche, le frontend affiche :
     > Aucune tâche pour aujourd’hui. Ajoutez votre première tâche depuis l’onglet Tâches.

4. **Bloc News du jour**
   - Appelle l’endpoint `/news`.
   - Récupère les flux RSS :
     - Le Monde (Une)
     - France Info (Titres)
   - Retourne les **trois dernières actualités** (titre, source, lien, date, et résumé si possible).
   - Si une clé `OPENAI_API_KEY` est configurée, un résumé IA court est généré pour chaque news.

## Endpoints backend (Milestone 1)

- `POST /parse` — hérité du Milestone 0 (inchangé).
- `GET /quote` ou `GET /citations` — renvoie une citation du matin ou du soir, sans répétition immédiate.
- `GET /weather?city=VILLE` — renvoie météo actuelle + recommandation d’habits.
- `GET /tasks/today` — renvoie jusqu’à trois tâches du jour mockées.
- `GET /news` — renvoie les trois dernières actualités issues des flux RSS.

Ces endpoints sont pensés pour être réutilisés par une future application mobile (React Native) tout en étant déjà testables via ce prototype web.

---

# Interface Utilisateur avec NativeBase

Parentia utilise **NativeBase**, une bibliothèque de composants UI cross-platform qui fonctionne sur React Native et web.

## Avantages

- ✅ **Code partagé** : 100% du code UI fonctionne sur mobile ET web
- ✅ **Design moderne** : Composants prêts à l'emploi avec thème personnalisable
- ✅ **Performance** : Optimisé pour React Native et react-native-web
- ✅ **Accessibilité** : Composants accessibles par défaut

## Thème

Le thème est configuré dans `mobile/App.tsx` avec une palette de gris pour un design épuré :
- Background : `gray.50` (#f9fafb)
- Cards : `white` avec ombres légères
- Texte principal : `gray.900` (#111827)
- Texte secondaire : `gray.500` (#6b7280)

---

# Installation et Développement

## Prérequis

- Node.js 20+
- Pour mobile : Android Studio (Android) ou Xcode (iOS, Mac seulement)

## Installation

1. **Backend** :
   ```bash
   npm install
   ```

2. **Frontend** :
   ```bash
   cd mobile
   npm install
   cd ..
   ```

## Développement Mobile

```bash
cd mobile
npm start
```

Puis appuyez sur `a` pour Android, `i` pour iOS, ou `w` pour web.

Ou directement :
```bash
npm run android    # Lance sur émulateur Android
npm run ios        # Lance sur simulateur iOS (Mac seulement)
npm run web        # Lance sur navigateur web
```

## Construire un APK Android

### Via EAS (Expo Application Services)

1. Installer EAS CLI globalement :
   ```bash
   npm install -g eas-cli
   ```

2. Se connecter à Expo :
   ```bash
   eas login
   ```

3. Configurer EAS (première fois) :
   ```bash
   cd mobile
   eas build:configure
   ```

4. Lancer le build Android :
   ```bash
   eas build --platform android --profile production
   ```

5. Télécharger l’APK depuis le dashboard Expo une fois le build terminé :
   https://expo.dev

### Localement (nécessite Android Studio)

```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

L’APK se trouve dans : `mobile/android/app/build/outputs/apk/release/app-release.apk`.

## Construire pour iOS / TestFlight

### Via EAS

1. Configurer le bundle ID dans `mobile/app.json` :
   ```json
   "ios": {
     "bundleIdentifier": "com.parentia.app"
   }
   ```

2. Lancer le build iOS :
   ```bash
   cd mobile
   eas build --platform ios --profile production
   ```

3. Télécharger l’IPA depuis le dashboard EAS, puis l’uploader sur App Store Connect pour TestFlight.

### Localement (Mac + Xcode)

```bash
cd mobile
npx expo prebuild --platform ios
open ios/ParentiaMobile.xcworkspace
```

Archivez et uploadez via Xcode → Product → Archive → Distribute.

## Fonctionnalités mobiles (Milestone 1)

- **Navigation** : 4 onglets (Home, Tâches, Inbox, Profil) avec React Navigation.
- **Écran Home** :
  - Bloc Météo & habits : appelle `/weather?city=VILLE` avec la ville stockée dans le profil.
  - Bloc Citation : appelle `/quote`, affiche une citation du matin (<17h) ou du soir (≥17h).
  - Bloc Tâches du jour : appelle `/tasks/today`, affiche jusqu’à 3 tâches.
  - Bloc News : appelle `/news`, affiche les 3 dernières actualités.
- **Écrans Tâches / Inbox** : placeholders pour prochains milestones.
- **Écran Profil** : permet de saisir et enregistrer une ville/code postal (AsyncStorage).

Le backend Node.js doit tourner pour que l’app mobile fonctionne correctement.
