# 04 · Résidences, lots et rôles

Statut : brouillon

## Objectif

Un utilisateur connecté peut créer sa résidence et ses lots, devenir son syndic, et inviter ses voisins par lien ou par code. Chaque personne voit uniquement la ou les résidences dont elle est membre, avec les droits de son rôle.

## Décisions

- Tables : `residence`, `lot` (appartement, local), `membership` (utilisateur, résidence, rôle, lot éventuel), `invitation`.
- `membership.user_id` est l'identifiant Neon Auth (`text`). Pas de clé étrangère vers le schéma `neon_auth`.
- Rôles : `syndic`, `tresorier`, `adjoint`, `coproprietaire`, `locataire`, `gardien`, définis une seule fois dans `packages/shared`, avec une table des permissions (qui peut faire quoi).
- Une résidence a **exactement un** `syndic` actif à tout moment.
- Une personne peut avoir un rôle différent dans chaque résidence. Un lot peut avoir plusieurs copropriétaires et un locataire.
- Invitation : le syndic choisit le lot et le rôle, l'API génère un **code à 6 caractères** et un lien profond `syndicapp://invite/<code>`. Validité 7 jours, usage unique, annulable.
- Résidence active : choisie dans l'appli, mémorisée localement, envoyée à l'API dans l'en-tête `X-Residence-Id`.
- Middleware `requireMembership` : vérifie que l'utilisateur est membre de la résidence de l'en-tête, place `residenceId` et `role` dans le contexte. Helper `requirePermission("charges.write")` pour chaque route.
- Création des lots : saisie un par un, ou génération rapide (« bâtiment A, étages 1 à 4, 3 appartements par étage »).

## Hors périmètre

- Charges, paiements, dépenses, signalements, annonces.
- Envoi automatique de l'invitation par SMS ou e-mail : le syndic partage le lien lui-même (WhatsApp, etc.) via la feuille de partage du téléphone.
- Passation du rôle de syndic (plan 09).
- Tantièmes et quotes-parts : toutes les charges seront égales par lot au plan 05.

## Étapes

### 1. Schéma et permissions

Dans `packages/db/src/schema/`, crée `residence` (nom, ville, adresse, date de création), `lot` (`residence_id`, référence comme « B12 », bâtiment, étage, type), `membership` (`residence_id`, `user_id`, `role`, `lot_id` facultatif, `active`, dates) et `invitation` (`residence_id`, `lot_id`, `role`, `code` unique, `expires_at`, `used_at`, `used_by`, `revoked_at`, `created_by`). Ajoute les index et la contrainte « un seul syndic actif par résidence ». Dans `packages/shared`, crée `roles.ts` avec les rôles et la table des permissions. Génère et applique la migration sur `dev`.

Terminé quand : la migration passe, et un test unitaire vérifie la table des permissions (par exemple : `locataire` n'a pas `accounts.read`).

### 2. Middlewares et API des résidences

Crée `requireMembership` et `requirePermission`. Ajoute les routes : `POST /residences` (crée la résidence et le `membership` syndic de l'utilisateur, dans une transaction), `GET /residences` (mes résidences et mon rôle dans chacune), `GET /residences/current`, `POST /lots`, `POST /lots/bulk` (génération rapide), `GET /lots`. Toute requête métier filtre sur `residence_id`.

Terminé quand : un utilisateur qui n'est pas membre reçoit `403` sur une résidence existante, et `404` n'est jamais renvoyé à sa place pour révéler qu'elle existe ou non (choisir un comportement et le documenter).

### 3. Invitations

Ajoute `POST /invitations` (syndic uniquement), `GET /invitations` (en attente), `DELETE /invitations/:id` (annulation), `GET /invitations/:code` (aperçu : nom de la résidence, lot, rôle, sans données personnelles) et `POST /invitations/:code/accept` (crée le `membership` dans une transaction et marque l'invitation utilisée). Limite les tentatives sur les codes pour empêcher de les deviner.

Terminé quand : un code expiré, utilisé ou annulé est refusé, et deux acceptations simultanées du même code ne créent qu'un seul membre.

### 4. Écrans mobiles

Avec les composants de `@syndic/ui` : après la connexion, si l'utilisateur n'a aucune résidence, afficher deux choix, « Créer ma résidence » et « J'ai un code d'invitation ». Écrans : création de la résidence, ajout des lots (un par un et génération rapide), liste des lots, création d'une invitation avec partage du lien (`Share` de React Native), saisie du code, ouverture par lien profond `syndicapp://invite/<code>` (même si l'utilisateur doit d'abord se connecter), et sélecteur de résidence active quand il y en a plusieurs. Les onglets affichés dépendent du rôle.

Terminé quand : le parcours complet fonctionne sur deux téléphones (ou deux comptes) : le syndic crée la résidence et invite, le voisin ouvre le lien, accepte et voit la résidence avec son rôle.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Test d'isolation : avec deux résidences et deux syndics, aucun appel ne permet à l'un de lire ou modifier les lots, membres ou invitations de l'autre (tester chaque route en changeant `X-Residence-Id`).
- Un `locataire` ne peut ni créer de lot ni inviter.
- Impossible d'avoir deux syndics actifs dans la même résidence.
- Invitation : code expiré, utilisé, annulé, inconnu → refus clair et traduit.
- De bout en bout : création de la résidence avec 12 lots en génération rapide → invitation pour B12 → partage du lien → acceptation par un second compte → ce compte voit « Résidence … · Apt B12 » et uniquement les onglets de son rôle.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 2 · Utilisateurs et rôles** : renvoyer vers `packages/shared/src/roles.ts` comme source unique des rôles et permissions.
- **Section 6 · Règles de code, partie API** : ajouter « Toute route métier utilise `requireMembership` puis `requirePermission` ; la résidence active arrive par l'en-tête `X-Residence-Id`. »
- **Section 6 · Règles de code, partie Base de données** : ajouter « Les rôles et permissions ne sont jamais vérifiés côté appli seulement : l'appli masque, l'API refuse. »
