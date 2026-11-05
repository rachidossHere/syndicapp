# 08 · Annonces et notifications

Statut : brouillon

## Objectif

Le syndic publie une annonce (coupure d'eau, réunion, travaux) que tous les membres reçoivent en notification. Les habitants sont prévenus quand leur signalement avance, et le syndic peut relancer les impayés d'un geste.

## Décisions

- Table `announcement` (titre, texte, catégorie : `travaux`, `assemblee`, `info`, `urgent`, auteur, date, épinglée oui/non) et `push_token` (utilisateur, jeton Expo, appareil, dernière utilisation).
- Qui publie : `syndic` et `adjoint`. Tout le monde lit.
- Notifications avec **Expo Push Notifications** (`expo-notifications`), envoyées par l'API via le SDK `expo-server-sdk`.
- Événements notifiés : nouvelle annonce (tous les membres), changement de statut de mon signalement (auteur), nouveau signalement urgent (syndic, adjoint, gardien), relance d'impayé (copropriétaires du lot), encaissement de mon paiement (copropriétaires du lot).
- Relance : déclenchée **à la main** par le syndic (un lot ou tous les impayés), au maximum une fois tous les 3 jours par lot.
- Contenu des notifications : jamais de montant ni de nom dans le texte de la notification (visible sur l'écran verrouillé). Exemple : « Un rappel de charges vous attend dans SyndicApp ».
- Envoi asynchrone : l'API enregistre la notification à envoyer et la traite après la réponse, sans bloquer la requête. Les jetons invalides renvoyés par Expo sont supprimés.
- Préférences : l'utilisateur peut couper chaque type de notification sauf les annonces urgentes.

## Hors périmètre

- SMS et e-mails.
- Relances automatiques planifiées.
- Notifications sur le web.
- Commentaires sous les annonces.

## Étapes

### 1. Jetons et préférences

Installe `expo-notifications`, demande l'autorisation après la connexion (avec un écran d'explication avant la demande système), enregistre le jeton via `POST /push-tokens`, et supprime-le à la déconnexion. Crée `push_token` et `notification_preference`, migration sur `dev`.

Terminé quand : le jeton du téléphone est enregistré et retiré à la déconnexion.

### 2. Service d'envoi

Dans `apps/api`, crée un module `notify(residenceId, audience, type, payload)` qui choisit les destinataires selon le rôle et les préférences, envoie par lots via `expo-server-sdk`, lit les reçus et supprime les jetons invalides. Ajoute un endpoint de test réservé au développement.

Terminé quand : une notification de test arrive sur le téléphone.

### 3. Annonces

Routes `POST /announcements`, `GET /announcements`, `POST /announcements/:id/pin`. Écrans : liste des annonces (épinglées en tête), création par le syndic, carte « Dernière annonce » sur l'accueil. Publier une annonce notifie tous les membres.

Terminé quand : une annonce publiée arrive en notification sur un second compte et s'ouvre sur son détail au toucher.

### 4. Branchement des autres événements

Ajoute les appels à `notify` : changement de statut d'un signalement, nouveau signalement urgent, encaissement d'un paiement, et bouton « Relancer » (un lot ou tous les impayés) sur l'écran des charges du syndic, avec la limite de 3 jours.

Terminé quand : chaque événement de la liste des Décisions envoie la bonne notification aux bons destinataires uniquement.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Aucune notification ne contient de montant, de nom ou de numéro de lot.
- Une préférence coupée empêche bien l'envoi de ce type (sauf urgent).
- Une seconde relance du même lot avant 3 jours est refusée.
- Un utilisateur d'une autre résidence ne reçoit rien.
- De bout en bout : le syndic publie « Coupure d'eau jeudi » → notification reçue par un copropriétaire et un locataire → le syndic relance les impayés → seuls les copropriétaires des lots impayés reçoivent le rappel → un signalement passe en cours → son auteur est notifié.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie API** : ajouter « Toute notification passe par le module `notify` ; jamais de montant, de nom ni de numéro de lot dans le texte d'une notification. »
- **Section 7 · Sécurité** : ajouter « Les jetons push sont supprimés à la déconnexion et quand Expo les signale invalides. »
