# Tests notifications (iOS/Android Expo EAS)

## Builds
- `eas build -p ios --profile preview`
- `eas build -p android --profile preview`
- Installer les builds internes sur appareil réel (app fermée incluse).

## Permissions
- Ouvrir Profil → Notifications → tap “Autoriser les notifications”.
- Vérifier le statut passe à “Notifications autorisées”.

## Déclencheurs (Debug)
- Activer __DEV__ et long-press sur “H&C Family” (header) → écran “Debug Notifications”.
- Boutons disponibles :
  - `rescheduleAllNotifications` : recalcule toutes les notifications planifiées.
  - `Tâche urgente immédiate` : envoie une notif urgente sur la première tâche.
  - `Document prêt immédiat` : envoie la notif “Document prêt” sur une tâche non terminée.

## Contenus attendus
- Matin 07:30 : météo (température arrondie, tenue), jusqu’à 3 tâches du jour ou “Vous n’avez aucune tâche prioritaire aujourd’hui.”, salutation “Bonjour <Prénom>,” sinon “Bonjour,”, clôture “Bonne journée.”
- J-1 18:00 : “Vous avez N tâche(s) à faire demain.” (seulement si N>=1). Tap → onglet Tâches filtré sur demain.
- Soir 19:00 : phrase du stock (aucune donnée perso, pas de liste).
- Retards 09:00 : “N tâche(s) en retard.” avec actions.
  - Action “Décaler la deadline” : deadline = demain 09:00 (date-only).
  - Action “Supprimer la tâche” : supprime la tâche.
- Urgente (immédiat) : déclenchée à la création email/photo si `isUrgentTask` (deadline ≤ J+2). Tap → détail tâche.
- Pluie + enfants 07:45 : envoyé uniquement si `isRainy(weather)` ET `hasSchoolAgeChild(profile)` ET si la notif Matin n’est pas envoyée le même jour. Tap → onglet Tâches (filtre jour).
- Document prêt (immédiat) : déclenchée seulement sur événement `PDF_GENERATED` réussi. Tap → détail tâche.
- Weekend samedi 09:30 : liste de ≤3 tâches “simples” selon règles ci-dessous. Tap → onglet Tâches avec ces IDs.

## Anti-spam
- Pluie+enfants saute si la notif Matin est activée et prévue pour le jour même.
- Aucune notif si les règles ne matchent pas.
- Identifiants de notifications uniques par type+date pour éviter doublons.

## Règles tâches simples (week-end)
- Inclusif seulement si TOUT est vrai :
  - Pas de deadline aujourd’hui.
  - Pas de deadline passée.
  - Pas de deadline dans 48h.
  - Deadline > J+3 OU aucune deadline.
  - ET (mot d’action court présent OU PDF déjà prêt et tâche non terminée OU tâche non “longue”).
- Exclusions immédiates :
  - Tâche urgente (source email/photo + deadline ≤ J+2).
  - Mots : impôts, CAF, dossier, inscription, renouvellement, déclaration, rendez-vous, rdv, validation.
- Limite : max 3 tâches.
- Priorité : 1) PDF prêt non terminé, 2) sans deadline, 3) plus anciennes (createdAt).

## Deep links
- J-1 → onglet Tâches filtré “demain”.
- Retards → onglet Tâches filtre “retard”.
- Urgent / Document prêt → détail de la tâche.
- Weekend → onglet Tâches avec IDs en paramètre.

## Cas “pas de notification”
- Matin : si météo indisponible (aucun fetch), rien.
- J-1 : si 0 tâche demain.
- Retards : si 0 en retard.
- Soir : si aucune phrase disponible.
- Weekend : si aucune tâche éligible.
- Document prêt : jamais sans événement `PDF_GENERATED`.












