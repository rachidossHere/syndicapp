# 06 · Dépenses et caisse

Statut : terminé

## Objectif

Le syndic enregistre une dépense en prenant la facture en photo, et tous les copropriétaires voient le solde de la caisse et le détail des dépenses avec leurs factures. C'est l'argument principal de l'appli : la transparence.

## Décisions

- Tables : `expense` (montant, libellé, catégorie, date, fournisseur facultatif, facture). Catégories : liste fixe, en anglais dans le code et la base (`maintenance`, `elevator`, `electricity`, `water`, `cleaning`, `security`, `repairs`, `other`) ; libellés traduits à l'affichage (entretien, ascenseur, électricité, eau, nettoyage, gardiennage, réparations, autre).
- Permissions : `expenses.write` (`manager`, `treasurer`) pour saisir et annuler une dépense ; `accounts.read` pour lire les comptes (tous les rôles sauf `tenant` et `caretaker`).
- Facture : photo prise avec `expo-image-picker` (appareil photo ou galerie), **compressée** avec `expo-image-manipulator` (1600 px de large max, JPEG 0,7) avant l'envoi, ou PDF. Envoi direct vers R2 avec une URL signée d'envoi (l'API ne reçoit pas le fichier).
- Facture facultative à la saisie, mais une dépense sans facture affiche le badge « Sans facture ».
- **Solde de la caisse** = solde de départ + paiements non annulés − dépenses non annulées. Calculé par l'API, jamais stocké en dur.
- **Solde de départ** : saisi par le syndic (`residence.manage`) avec une date. Toute correction est historisée (ancien montant, nouveau montant, qui, quand, motif).
- Pas de suppression : annulation tracée avec motif, visible par tous (« Annulée le … par … : motif »).
- Le journal des mouvements (entrées et sorties) est visible par les copropriétaires, sans le nom des copropriétaires qui ont payé (seulement « Charge reçue · B12 »).
- Design : la référence visuelle est `docs/depenses.png` (comptes, ajouter une dépense, dépense prête, détail, solde de départ, comptes en arabe). Les valeurs exactes viennent des jetons de `@syndic/ui`. Sur l'image, les polices sont des remplacements (Inter, DejaVu Sans).

## Hors périmètre

- Budget prévisionnel, comptabilité par exercice, export Excel ou PDF des comptes.
- Rapprochement bancaire.
- Lecture automatique des factures (OCR).
- Saisie hors ligne (plan 10).

## Étapes

### 1. Schéma et solde

Crée `expense` et la liste des catégories dans `packages/shared`, et ajoute `opening_balance` à `residence`. Crée une fonction côté API `getCashBalance(residenceId)` et une vue ou requête du journal des mouvements (paiements et dépenses fusionnés, triés par date). Génère et applique la migration.

Terminé quand : un test vérifie le solde après paiements, dépenses et annulations.

### 2. API

Routes : `POST /expenses/upload-url` (URL signée d'envoi R2, type et taille vérifiés : JPEG, PNG ou PDF, 10 Mo max), `POST /expenses`, `GET /expenses`, `POST /expenses/:id/cancel`, `GET /expenses/:id/invoice-url` (URL signée de lecture), `GET /cash` (solde, total encaissé et dépensé de la période, journal paginé).

Terminé quand : un fichier de 15 Mo ou un `.exe` est refusé, et un locataire reçoit `403` sur toutes ces routes.

### 3. Écran « Ajouter une dépense »

Avec `@syndic/ui`, reprendre le prototype : grande zone « Prendre la facture en photo », libellé, montant, catégorie, date (aujourd'hui par défaut). Compression avant envoi, barre de progression, bouton désactivé pendant l'envoi. Toast « Dépense enregistrée avec facture · visible par tous ».

Terminé quand : une dépense avec photo s'enregistre en moins de 30 secondes depuis l'accueil du syndic.

### 4. Écran « Comptes » pour tous

Solde de la caisse, encaissé et dépensé du trimestre, liste des mouvements avec `Amount` (+ en vert, − en terracotta), lien « Facture » qui ouvre la photo ou le PDF, badges « Sans facture » et « Annulée ».

Terminé quand : un copropriétaire voit la dépense et sa facture quelques secondes après sa saisie par le syndic.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Le solde affiché est identique au calcul manuel sur un jeu de 10 mouvements dont 2 annulés.
- Les photos envoyées font moins de 1 Mo en moyenne.
- Les URL de factures expirent ; aucune facture n'est accessible publiquement.
- Le journal ne contient aucun nom de copropriétaire.
- De bout en bout : le syndic photographie une facture de plombier de 600 MAD → le solde baisse de 600 MAD chez un copropriétaire → celui-ci ouvre la facture → le syndic annule la dépense avec un motif → le solde revient et l'annulation est visible.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie Mobile** : ajouter « Toute image est compressée avant envoi (1600 px, JPEG 0,7) ; les fichiers partent directement vers R2 avec une URL signée. »
- **Section 6 · Règles de code, partie Base de données** : ajouter « Le solde de la caisse est toujours calculé, jamais stocké. »
