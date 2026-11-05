# 09 · Bureau et passation

Statut : brouillon

## Objectif

Le syndic compose son bureau (trésorier, adjoint), gère les membres de la résidence, et transmet la gestion au nouveau syndic élu en un geste, sans rien perdre de l'historique.

## Décisions

- Mandat : ajout à `residence` de la date d'élection et de fin du mandat du syndic (informatif, rappel 30 jours avant la fin).
- Le syndic peut nommer ou retirer un `tresorier` et un `adjoint` parmi les copropriétaires, changer le lot ou le rôle d'un membre, et désactiver un membre (départ, vente) sans supprimer son historique.
- Passation : table `handover` (ancien syndic, nouveau syndic, statut `en_attente` / `acceptee` / `annulee`, dates). Le syndic choisit un copropriétaire ; celui-ci doit **accepter** dans l'appli. À l'acceptation, dans une transaction : le nouveau devient `syndic`, l'ancien redevient `coproprietaire`, le trésorier et l'adjoint sont conservés.
- Rien n'est copié ni déplacé : toutes les données appartiennent à la résidence, pas à la personne. L'ancien syndic garde la lecture des comptes comme tout copropriétaire.
- Une seule passation en attente à la fois ; annulable par l'ancien syndic tant qu'elle n'est pas acceptée ; expire après 14 jours.
- Journal d'activité : table `audit_log` (qui, quoi, quand) alimentée pour les actions sensibles (rôles, passation, annulations de paiements et dépenses), consultable par le bureau.

## Hors périmètre

- Élection ou vote en ligne du syndic (votes d'AG plus tard).
- Syndic professionnel gérant plusieurs résidences.
- Signature électronique du procès-verbal de passation.

## Étapes

### 1. Schéma et journal d'activité

Ajoute les champs de mandat, crée `handover` et `audit_log`, migration sur `dev`. Crée un helper `logAudit()` et branche-le sur les annulations de paiements et de dépenses existantes.

Terminé quand : chaque annulation apparaît dans `audit_log`.

### 2. API du bureau et des membres

Routes : `GET /members`, `PATCH /members/:id` (rôle, lot), `POST /members/:id/deactivate`, toutes réservées au syndic, avec `logAudit`. Interdire de retirer le dernier syndic ou de nommer un locataire au bureau.

Terminé quand : les règles ci-dessus sont refusées avec un message clair.

### 3. API de passation

Routes : `POST /handovers`, `GET /handovers/current`, `POST /handovers/:id/accept` (par le nouveau syndic uniquement), `POST /handovers/:id/cancel`. Notification au nouveau syndic à la création et à l'ancien à l'acceptation (module `notify`).

Terminé quand : après acceptation, les permissions changent immédiatement pour les deux personnes.

### 4. Écrans

Onglet « Bureau » du prototype : membres du bureau, durée du mandat, gestion des membres, et parcours de passation (choix du nouveau syndic, liste de ce qui est transmis : comptes, dépenses avec factures, prestataires, signalements, annonces), écran d'acceptation chez le nouveau syndic, journal d'activité.

Terminé quand : la passation complète se fait sur deux téléphones.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Après la passation : l'ancien syndic ne peut plus encaisser ni inviter ; le nouveau voit tout l'historique ; aucune donnée n'a été dupliquée.
- Deux passations simultanées sont impossibles ; une passation expirée ne peut plus être acceptée.
- Chaque action sensible apparaît dans le journal.
- De bout en bout : le syndic nomme un trésorier → le trésorier encaisse une charge → le syndic lance la passation vers Y. Alaoui → Y. Alaoui accepte → il publie une annonce et voit les comptes depuis le début → l'ancien syndic voit l'onglet copropriétaire.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie Base de données** : ajouter « Les données appartiennent à la résidence, jamais à une personne. Les changements de rôle, passations et annulations sont journalisés avec `logAudit`. »
