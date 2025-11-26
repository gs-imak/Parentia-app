# Parentia Mobile — React Native (Expo)

Application mobile Parentia développée avec **React Native** et **Expo**, consommant le backend Node.js du dossier parent.

## Prérequis

- Node.js installé
- Pour Android : [Android Studio](https://developer.android.com/studio) configuré avec un émulateur ou un téléphone physique connecté en mode développeur.
- Pour iOS (Mac seulement) : Xcode + simulateur configuré.

## Installation

Depuis le dossier `mobile/` :

```bash
npm install
```

## Lancer l'application en développement

### Sur émulateur/simulateur

```bash
npm start
```

Puis :
- Appuyez sur `a` pour Android.
- Appuyez sur `i` pour iOS (Mac seulement).

Ou utilisez directement :
```bash
npm run android
npm run ios
```

### Sur navigateur (web)

```bash
npm run web
```

Cela ouvre une version web de l'app, mais certaines fonctionnalités (AsyncStorage, navigation native) peuvent se comporter différemment.

## Configurer le backend

L'application utilise par défaut `http://localhost:5000` pour le backend (configuré dans `app.json` sous `extra.backendUrl`).

Pour tester avec un backend déployé ou accessible sur un autre réseau (par exemple depuis un émulateur Android ou Expo Go sur iPhone) :

1. Modifiez `app.json`, section `extra.backendUrl` :
   ```json
   "extra": {
     "backendUrl": "http://192.168.x.x:5000"
   }
   ```
   Remplacez `192.168.x.x` par l'adresse IP de votre ordinateur.
2. Relancez l'app :
   ```bash
   npm start
   ```

## Design

L'application utilise un design **Apple-like** avec :
- **Palette de couleurs** : #2C3E50 (titres), #6E7A84 (texte secondaire), #E9EEF2 (bordures), #3A82F7 (accent)
- **Typographie** : Inter (400/500/600)
- **Icônes** : Feather Icons
- **Composants** : NativeBase + style personnalisé
- Interface épurée, lumineuse, moderne

## Fonctionnalités implémentées (Milestone 1)

### Écran Home (entièrement fonctionnel)

- **Météo & habits** : Appel à `/weather?city=VILLE`, affiche température, icône, et recommandation d'habits.
- **Citation du jour** : Appel à `/quote`, affiche une citation du matin (<17h) ou du soir (≥17h).
- **Tâches du jour** : Appel à `/tasks/today`, affiche jusqu'à 3 tâches mockées.
- **News du jour** : Appel à `/news`, affiche les 3 dernières actualités (titre, source, date, résumé, lien).

### Autres écrans (placeholders)

- **Tâches** : Message indiquant qu'il sera complété dans un prochain milestone.
- **Inbox** : Réservé pour l'intégration email/OCR future.
- **Profil** : Permet de saisir et enregistrer une ville/code postal (stocké dans AsyncStorage pour les appels météo).

## Construire un APK Android (release)

### Via EAS (Expo Application Services)

1. Installez EAS CLI globalement :
   ```bash
   npm install -g eas-cli
   ```

2. Connectez-vous à votre compte Expo :
   ```bash
   eas login
   ```

3. Configurez EAS (première fois seulement) :
   ```bash
   eas build:configure
   ```
   Sélectionnez "All" pour créer les configurations iOS + Android.

4. Lancez le build Android :
   ```bash
   eas build --platform android --profile production
   ```

   L'APK sera généré dans le cloud EAS. Une fois terminé, téléchargez-le depuis le dashboard Expo : https://expo.dev/accounts/[your-account]/projects/parentia-mobile/builds

### Construire localement (sans EAS)

1. Installez Android Studio avec le SDK Android.
2. Générez le projet natif :
   ```bash
   npx expo prebuild --platform android
   ```
3. Depuis le dossier `mobile/android` :
   ```bash
   ./gradlew assembleRelease
   ```
4. L'APK se trouve dans : `android/app/build/outputs/apk/release/app-release.apk`.

## Construire pour iOS / TestFlight

### Via EAS

1. Configurez un identifiant Apple Developer et un bundle ID dans `app.json` :
   ```json
   "ios": {
     "bundleIdentifier": "com.parentia.app"
   }
   ```

2. Lancez le build iOS :
   ```bash
   eas build --platform ios --profile production
   ```

3. Une fois le build terminé, téléchargez l'IPA depuis le dashboard EAS, puis uploadez-le sur App Store Connect pour TestFlight.

### Localement (nécessite Mac + Xcode)

1. Générez le projet natif :
   ```bash
   npx expo prebuild --platform ios
   ```
2. Ouvrez le workspace dans Xcode :
   ```bash
   open ios/YourAppName.xcworkspace
   ```
3. Archivez et uploadez via Xcode → Product → Archive → Distribute.

## Structure du projet

```
mobile/
├── src/
│   ├── api/
│   │   └── client.ts        # API client pour appeler le backend
│   ├── utils/
│   │   └── storage.ts       # Gestion AsyncStorage pour le profil
│   └── screens/
│       ├── HomeScreen.tsx   # Écran Home fonctionnel
│       ├── TasksScreen.tsx  # Placeholder
│       ├── InboxScreen.tsx  # Placeholder
│       └── ProfileScreen.tsx # Gestion profil (ville)
├── App.tsx                  # Point d'entrée avec React Navigation
├── app.json                 # Config Expo (nom, slug, bundleId, package)
├── package.json
└── README.md                # Ce fichier
```

## Notes

- Les endpoints backend (`/quote`, `/weather`, `/news`, `/tasks/today`) doivent être accessibles pour que l'app fonctionne correctement.
- Assurez-vous que le serveur backend tourne (`npm run dev` depuis le dossier racine) avant de lancer l'app mobile.
- L'app est configurée pour fonctionner sur **Android**, **iOS**, et **Web** grâce à Expo.
