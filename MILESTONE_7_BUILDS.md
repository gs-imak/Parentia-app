# Milestone 7 — Builds pour distribution (TestFlight + APK/AAB)

Ce document décrit **comment générer** des builds installables (sans Expo / environnement de dev) et **comment les installer** côté testeurs.

## Pré-requis (côté dev)

- Accès à un compte Expo/EAS
- iOS: Compte Apple Developer + accès App Store Connect
- Android: Compte Google Play Console (pour AAB) ou partage direct APK (distribution interne)

## Générer les builds (EAS)

Depuis la racine du repo:

```bash
cd mobile
```

### iOS (TestFlight)

1. Lancer un build iOS (profil production) :

```bash
eas build --platform ios --profile production
```

2. Publier sur TestFlight:
- Option A: via EAS Submit

```bash
eas submit --platform ios --latest
```

- Option B: upload manuel sur App Store Connect (si vous récupérez l'IPA)

3. Dans App Store Connect → TestFlight:
- Créer un groupe de testeurs
- Ajouter 20–50 emails
- Activer "Public link" si nécessaire

### Android (APK / AAB)

1. Build Android (profil production — génère un AAB pour le Play Store) :

```bash
eas build --platform android --profile production
```

2. Pour générer un **APK** (distribution directe sans Play Store) :

```bash
eas build --platform android --profile preview
```

3. Choisir le format selon la distribution :
- **APK** (profil `preview`): distribution directe (lien de téléchargement)
- **AAB** (profil `production`): Play Console (internal testing / closed testing)

> Remarque: EAS fournit un lien de téléchargement du build. Partagez ce lien aux testeurs.

## Guide d’installation (côté testeurs)

### iOS (TestFlight)

1. Installer l’app **TestFlight** (App Store)
2. Ouvrir l’invitation TestFlight (email ou lien public)
3. “Installer”
4. Ouvrir HC Family → suivre l’onboarding

### Android (APK)

1. Télécharger l’APK via le lien fourni
2. Activer l’installation depuis “sources inconnues” (si demandé par Android)
3. Installer l’app
4. Ouvrir HC Family → suivre l’onboarding

## Notes importantes (Milestone 7)

- Les testeurs n’ont **pas besoin** d’Expo ni d’un environnement de dev.
- Chaque installation génère un **email unique** visible dans `Profil` (format `uid_xxx@hcfamily.app`).
- Pour les tests “email → tâche”, les testeurs doivent envoyer un email depuis leur boîte mail à **leur** adresse `uid_xxx@hcfamily.app`.

