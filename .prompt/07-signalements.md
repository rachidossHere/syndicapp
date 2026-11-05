# 07 · Signalements

Statut : brouillon

## Objectif

Un habitant signale un problème dans la résidence (ascenseur en panne, fuite, lampe grillée) avec une photo, et suit son traitement. Le syndic et le gardien voient tous les signalements, changent leur statut et répondent.

## Décisions

- Tables : `issue` (titre, description, emplacement, photo facultative, urgent oui/non, statut, auteur) et `issue_event` (historique : changement de statut, commentaire, auteur, date).
- Statuts : `ouvert`, `en_cours`, `resolu`. Seuls `syndic`, `adjoint` et `gardien` changent le statut. L'auteur peut commenter.
- Qui peut signaler : tous les rôles, y compris `locataire`.
- Visibilité : tous les membres voient tous les signalements de la résidence (utile pour éviter les doublons), sauf le nom de l'auteur, visible seulement par le syndic, l'adjoint et le gardien.
- Photo : même mécanisme que les factures (compression, URL signée R2).
- Un signalement résolu peut être rouvert par son auteur dans les 7 jours.

## Hors périmètre

- Notifications push (plan 08) : ce plan rafraîchit simplement les listes.
- Attribution à un prestataire et suivi des coûts (lien avec les dépenses).
- Signalements privés ou anonymes.

## Étapes

### 1. Schéma et API

Crée `issue` et `issue_event`, migration sur `dev`. Routes : `POST /issues/upload-url`, `POST /issues`, `GET /issues` (filtre par statut, urgents d'abord), `GET /issues/:id` (avec l'historique), `POST /issues/:id/status`, `POST /issues/:id/comments`, `POST /issues/:id/reopen`. Chaque changement crée un `issue_event` dans la même transaction.

Terminé quand : un `coproprietaire` ne peut pas changer un statut, et le nom de l'auteur n'apparaît pas dans les réponses destinées aux copropriétaires et locataires.

### 2. Écrans habitant

Avec `@syndic/ui` : bouton « Nouveau signalement » (titre, description, emplacement, photo, urgent), liste avec `StatusBadge`, détail avec historique et commentaires, bouton « Rouvrir » si résolu depuis moins de 7 jours.

Terminé quand : un habitant crée un signalement avec photo en moins d'une minute.

### 3. Écrans syndic et gardien

Liste avec filtres (ouverts, en cours, résolus) et compteur des urgents, détail avec boutons de changement de statut et commentaire. Le gardien n'a accès qu'à ces écrans et aux annonces.

Terminé quand : le syndic passe un signalement de `ouvert` à `en_cours` puis `resolu`, et l'habitant voit chaque étape dans l'historique.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Permissions testées par rôle sur chaque route.
- Isolation entre résidences.
- Les photos sont compressées et accessibles uniquement par URL signée.
- De bout en bout : un locataire signale « Ascenseur bloqué au 3e » en urgent avec photo → il apparaît en tête chez le syndic → passage en cours avec commentaire → résolu → le locataire le rouvre → le syndic le résout de nouveau.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie API** : ajouter « Les réponses de l'API sont adaptées au rôle : un champ réservé (nom d'un auteur, montant d'un autre lot) n'est jamais envoyé puis masqué par l'appli. »
