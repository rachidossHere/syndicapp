# 07 · Signalements

Statut : brouillon

## Objectif

Un habitant signale un problème dans la résidence (ascenseur en panne, fuite, lampe grillée) avec une photo, et suit son traitement. Le syndic et le gardien voient tous les signalements, changent leur statut et répondent.

## Décisions

- Tables : `issue` (titre, description, emplacement, photo facultative, urgent oui/non, statut, auteur) et `issue_event` (historique : changement de statut, commentaire, auteur, date).
- Statuts : `open`, `in_progress`, `resolved` (codes en anglais ; libellés « Ouvert », « En cours », « Résolu » via les traductions). Seuls `manager`, `deputy` et `caretaker` changent le statut (permission `issues.manage`). L'auteur peut commenter.
- Emplacements : `elevator`, `stairs`, `parking`, `hall`, `roof`, `other` (codes en anglais ; libellés traduits : Ascenseur, Escalier, Parking, Hall, Toiture, Autre).
- Permissions : `issues.write` pour créer un signalement (tous les rôles, gardien compris) ; `issues.manage` pour changer un statut (`manager`, `deputy`, `caretaker`).
- Qui peut signaler : tous les rôles, y compris `tenant` (locataire) et `caretaker` (gardien).
- Visibilité : tous les membres voient tous les signalements de la résidence (utile pour éviter les doublons), sauf le nom et l'appartement de l'auteur, visibles seulement par les rôles avec `issues.manage` (syndic, adjoint, gardien).
- Photo : même mécanisme que les factures (compression, URL signée R2).
- Un signalement résolu peut être rouvert par son auteur dans les 7 jours.
- Design : la référence visuelle est `docs/signalements.png` (liste et signalement pour l'habitant, détail, liste et traitement pour le syndic et le gardien, liste en arabe). Les valeurs exactes viennent des jetons de `@syndic/ui`. Sur l'image, les polices sont des remplacements (Inter, DejaVu Sans).

## Hors périmètre

- Notifications push (plan 08) : ce plan rafraîchit simplement les listes.
- Attribution à un prestataire et suivi des coûts (lien avec les dépenses).
- Signalements privés ou anonymes.

## Étapes

### 1. Schéma et API

Crée `issue` et `issue_event`, migration sur `dev`. Routes : `POST /issues/upload-url`, `POST /issues`, `GET /issues` (filtre par statut, urgents d'abord), `GET /issues/:id` (avec l'historique), `POST /issues/:id/status`, `POST /issues/:id/comments`, `POST /issues/:id/reopen`. Chaque changement crée un `issue_event` dans la même transaction.

Terminé quand : un `owner` (copropriétaire) ne peut pas changer un statut, et le nom de l'auteur n'apparaît pas dans les réponses destinées aux copropriétaires et locataires.

### 2. Écrans habitant

Avec `@syndic/ui` : bouton « Nouveau signalement » (titre, description, emplacement, photo, urgent), liste avec `StatusBadge`, détail avec historique et commentaires, bouton « Rouvrir » si résolu depuis moins de 7 jours.

Terminé quand : un habitant crée un signalement avec photo en moins d'une minute.

### 3. Écrans syndic et gardien

Liste avec filtres (ouverts, en cours, résolus) et compteur des urgents, détail avec boutons de changement de statut et commentaire. Le gardien n'a accès qu'à ces écrans et aux annonces.

Terminé quand : le syndic passe un signalement de `open` à `in_progress` puis `resolved`, et l'habitant voit chaque étape dans l'historique.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Permissions testées par rôle sur chaque route.
- Isolation entre résidences.
- Les photos sont compressées et accessibles uniquement par URL signée.
- De bout en bout : un locataire signale « Ascenseur bloqué au 3e » en urgent avec photo → il apparaît en tête chez le syndic → passage en cours avec commentaire → résolu → le locataire le rouvre → le syndic le résout de nouveau.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie API** : ajouter « Les réponses de l'API sont adaptées au rôle : un champ réservé (nom d'un auteur, montant d'un autre lot) n'est jamais envoyé puis masqué par l'appli. »
