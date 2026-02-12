# Milestone 7 — Checklist de test (20–50 testeurs)

## Avant de commencer

- [ ] L’app s’ouvre sur l’onboarding (premier lancement)
- [ ] L’onboarding affiche une adresse `uid_xxx@hcfamily.app`
- [ ] Dans `Profil`, on retrouve la même adresse (boutons **Copier** + **Email test**)

---

## 1) Email → tâche

### Test nominal

- [ ] Depuis une boîte mail externe, envoyer un email à `uid_xxx@hcfamily.app`
  - Sujet: “Test inscription école”
  - Corps: texte libre + infos utiles
- [ ] Dans l’app → `Inbox`
  - [ ] L’entrée apparaît en **success**
- [ ] Dans `Tâches`
  - [ ] Une tâche a été créée
  - [ ] La deadline est plausible (pas 2099 / pas incohérente)

### Test “newsletter/promo” (doit être ignoré)

- [ ] Envoyer un email type promo (“-50%”, “newsletter”)
- [ ] L’entrée apparaît dans `Inbox` avec statut ignorable

### Test erreur IA (fallback “À vérifier manuellement”)

- [ ] Envoyer un email volontairement illisible / non structuré
- [ ] Vérifier qu’une tâche “À vérifier manuellement” est créée (pas de crash)

---

## 2) Photo → tâche

### Test nominal

- [ ] `Tâches` → “Ajouter une image”
- [ ] Sélectionner une photo de document (facture / courrier / capture)
- [ ] Une tâche est créée
- [ ] La pièce jointe est consultable

### Test image non interprétable (fallback)

- [ ] Importer une photo floue / illisible
- [ ] Résultat attendu: création d’une tâche “À vérifier manuellement” (pas d’erreur bloquante)

### Test anti-doublon

- [ ] Importer 2 fois la même image rapidement
- [ ] Résultat attendu: pas de doublons intempestifs (ou une seule tâche créée)

---

## 3) Aide à la rédaction généralisée (toutes les tâches)

Sur une tâche (avec ou sans contact détecté):

- [ ] Ouvrir la tâche → `Actions` → boutons visibles:
  - [ ] **Email**
  - [ ] **Message**
  - [ ] **WhatsApp**
- [ ] Sans contact détecté:
  - [ ] Le modal demande le destinataire (email/téléphone)
  - [ ] Le champ “Points clés (facultatif)” est présent
- [ ] Remplir “Points clés”:
  - “absence imprévue”
  - “rdv pediatre deja pris”
  - “merci de confirmer reception”
- [ ] Activer / désactiver “Ton moins formel (tutoiement)”
- [ ] Appuyer sur **Générer**
  - [ ] Message en français correct
  - [ ] N’ajoute pas de faits non fournis
  - [ ] N’invente pas de dates
- [ ] Appuyer sur “Ouvrir Mail / Messages / WhatsApp”

---

## 4) Message → PDF (optionnel)

- [ ] Ouvrir une tâche → section modèles PDF → choisir un modèle
- [ ] “Générer” → écran “Options PDF”
- [ ] Option date:
  - [ ] Saisir `JJ/MM/AAAA` puis générer
  - [ ] Vérifier cohérence dans le PDF (objet/corps si applicable)
- [ ] Option “Insérer le message”:
  - [ ] Générer un message via “Points clés”
  - [ ] Activer “Insérer le message dans le PDF” si disponible
  - [ ] Générer et vérifier présence du contenu

---

## 5) Notifications

- [ ] Autoriser les notifications (si demandé)
- [ ] Créer une tâche avec deadline proche (ex: demain)
- [ ] Vérifier réception d’une notification (selon réglages)
- [ ] Tester les actions (si disponibles) et vérifier la mise à jour de l’état

