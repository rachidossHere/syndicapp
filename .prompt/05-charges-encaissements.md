# 05 · Charges et encaissements

Statut : brouillon

## Objectif

Le syndic lance un appel de charges pour une période, encaisse les paiements reçus en espèces ou par virement en un ou deux gestes, et voit qui n'a pas payé. Chaque copropriétaire voit ce qu'il doit, ce qu'il a payé, et télécharge ses reçus.

## Décisions

- Tables : `charge_call` (appel de charges : période, montant par lot, échéance), `charge_due` (ce que doit chaque lot pour un appel), `payment` (encaissement), `receipt` (reçu PDF).
- Montant **égal pour tous les lots** dans le MVP, saisi par le syndic. Montants en centimes.
- Périodes : mensuelle ou trimestrielle, choisie à la création de la résidence (réglable plus tard).
- Créer un appel de charges génère une ligne `charge_due` par lot actif, dans une transaction.
- Encaissement : lot + mode (`cash`, `transfer`) + montant (pré-rempli avec le dû). Paiement partiel autorisé ; le statut du dû devient `paid`, `partial` ou `unpaid`. Valeurs en anglais dans le code et la base ; les libellés affichés restent traduits (payé, partiel, impayé ; espèces, virement).
- Qui encaisse : permission `payments.write` (`manager` et `treasurer`). Qui lance un appel de charges : `charges.write` (`manager`).
- Design : la référence visuelle est `docs/charges.png` (appels de charges, nouvel appel, détail d'un appel, encaisser, mes charges, reçu PDF, mes charges en arabe). Les valeurs exactes viennent des jetons de `@syndic/ui`. Sur l'image, les polices sont des remplacements (Inter, DejaVu Sans).
- **Pas de suppression** d'un paiement : annulation tracée (qui, quand, motif obligatoire), qui recalcule le statut du dû.
- Reçu : PDF généré **côté API** avec `pdf-lib`, numéroté par résidence (`2026-0001`), stocké dans Cloudflare R2, accessible par URL signée de courte durée. Le reçu d'un paiement annulé est marqué « Annulé ».
- Le copropriétaire voit uniquement les dus et reçus de son lot. Le locataire ne voit rien de tout ça.
- Mise en place de **R2** dans ce plan (client S3 dans `apps/api`, URL signées), réutilisé aux plans 06 et 07.

## Hors périmètre

- Paiement en ligne (CMI, portefeuille mobile).
- Tantièmes, montants différents par lot, pénalités de retard.
- Relances automatiques par notification (plan 08).
- Encaissement hors ligne (plan 10).
- Exports comptables.

## Étapes

### 1. Schéma

Crée `charge_call`, `charge_due`, `payment` (lot, montant, mode, date, encaissé par, annulé le, annulé par, motif) et `receipt` (numéro, clé R2, paiement). Contraintes : un seul `charge_due` par lot et par appel, montants positifs, numéro de reçu unique par résidence. Génère et applique la migration.

Terminé quand : la migration passe sur `dev`.

### 2. API des charges et encaissements

Routes : `POST /charge-calls` (crée l'appel et les dus), `GET /charge-calls`, `GET /charge-calls/:id` (dus par lot avec statut), `POST /payments` (encaissement, transaction qui met à jour le statut du dû), `POST /payments/:id/cancel`, `GET /me/dues` (dus et paiements de mon lot). Permissions via `requirePermission`. Toute requête filtre sur `residence_id`.

Terminé quand : encaisser 450 MAD sur un dû de 450 MAD le passe à `paye` ; 200 MAD le passe à `partiel` ; annuler le paiement le remet à `impaye`.

### 3. Reçus PDF et stockage R2

Configure R2 (variables dans `.env.example`, client S3, fonction `getSignedUrl` de 5 minutes). Après chaque encaissement, génère le reçu PDF (nom de la résidence, numéro, lot, montant en chiffres, mode, date, nom de l'encaisseur, mention « Reçu généré par SyndicApp »), en français et en arabe selon la langue du copropriétaire. Route `GET /receipts/:id/url` : accessible au syndic, au trésorier et aux copropriétaires du lot uniquement.

Terminé quand : le PDF s'ouvre sur le téléphone, et l'URL ne fonctionne plus après 5 minutes.

### 4. Écrans du syndic

Avec `@syndic/ui` : création d'un appel de charges, liste des appels avec le total encaissé et le nombre d'impayés, détail d'un appel (lots avec `StatusBadge`), et l'écran « Encaisser » du prototype : grille des lots impayés, choix espèces ou virement, montant pré-rempli, confirmation, toast « 450 MAD reçus de A07 · reçu envoyé ». Annulation d'un paiement avec motif obligatoire.

Terminé quand : un encaissement se fait en 3 gestes depuis l'accueil (Encaisser → lot → Confirmer).

### 5. Écrans du copropriétaire

Carte « Charges du trimestre » sur l'accueil (montant, échéance, statut), historique de ses dus et paiements, ouverture des reçus PDF.

Terminé quand : après un encaissement par le syndic, le copropriétaire voit « Payé » et son reçu en rafraîchissant.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Montants : aucun nombre à virgule ; affichage `18 420 MAD` via `Amount`.
- Isolation : un copropriétaire ne peut lire ni les dus ni les reçus d'un autre lot ou d'une autre résidence (tester les routes directement).
- Un `adjoint` ou un `locataire` ne peut pas encaisser.
- Deux encaissements simultanés sur le même dû ne corrompent pas son statut.
- Numérotation des reçus continue et unique par résidence.
- De bout en bout : appel de charges T4 de 450 MAD sur 12 lots → encaissement en espèces de B12 → reçu PDF ouvert par le copropriétaire de B12 → paiement partiel de A07 → annulation avec motif → statuts et totaux corrects partout.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 4 · Stack technique** : ajouter `pdf-lib` (reçus côté API) et préciser l'usage de R2 avec URL signées de 5 minutes.
- **Section 6 · Règles de code, partie Base de données** : ajouter « Tout statut calculé (dû payé, partiel, impayé) est mis à jour dans la même transaction que le paiement qui le change. »
