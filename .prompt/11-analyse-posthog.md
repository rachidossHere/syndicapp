# 11 · Analyse produit (PostHog)

Statut : brouillon

## Objectif

On sait comment l'appli est utilisée (combien de résidences actives, quelles actions servent, où les gens abandonnent) sans jamais envoyer de donnée personnelle ou financière, et on peut activer une fonctionnalité pour quelques résidences seulement.

## Décisions

- **PostHog**, hébergement **UE**, avec le SDK `posthog-react-native` côté appli. Pas de PostHog côté API dans le MVP.
- Identifiants : l'utilisateur est identifié par un **hachage** de son identifiant (pas son e-mail ni son nom). La résidence est un « groupe » PostHog identifié par un hachage de son identifiant.
- Propriétés autorisées : rôle, langue, plateforme, version de l'appli, nombre de lots arrondi (tranche : `<10`, `10-50`, `>50`).
- **Interdit** dans tout événement : nom, e-mail, téléphone, numéro de lot, montant, texte libre (libellés, signalements, annonces), nom de résidence, adresse.
- Liste fermée d'événements, définie dans `packages/shared/src/analytics.ts` : `residence_created`, `invitation_created`, `invitation_accepted`, `charge_call_created`, `payment_recorded`, `payment_cancelled`, `expense_created` (avec `has_invoice`), `issue_created` (avec `urgent`), `issue_status_changed`, `announcement_published`, `handover_completed`, `offline_action_synced`.
- Un helper `track(event, props)` typé n'accepte que ces événements et ces propriétés.
- Capture automatique des écrans : activée ; capture automatique des clics et enregistrement de session : **désactivés**.
- Consentement : écran au premier lancement avec choix clair ; si refus, PostHog n'est pas initialisé.
- Feature flags PostHog pour activer une fonctionnalité sur les résidences pilotes.

## Hors périmètre

- Enregistrement de session (replay).
- Analyse côté serveur, data warehouse.
- Publicité ou partage de données avec des tiers.

## Étapes

### 1. Liste des événements et helper

Crée `analytics.ts` dans `packages/shared` (événements, propriétés autorisées, types), et dans `apps/mobile` un module qui initialise PostHog (clé et hôte UE via variables d'environnement) seulement après consentement, avec `identify` et `group` hachés, et le helper `track`.

Terminé quand : passer un champ non prévu à `track` provoque une erreur de typage.

### 2. Consentement

Écran de consentement au premier lancement (FR et AR), choix modifiable dans les réglages.

Terminé quand : avec un refus, aucune requête ne part vers PostHog (vérifié dans les journaux réseau).

### 3. Branchement des événements et feature flags

Ajoute les appels `track` aux endroits correspondants. Crée un hook `useFeatureFlag(name)` et un premier flag de test.

Terminé quand : chaque événement de la liste apparaît dans PostHog avec uniquement les propriétés autorisées.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Revue des événements reçus dans PostHog : aucun nom, e-mail, lot, montant ni texte libre.
- Refus du consentement → zéro requête PostHog.
- Le flag de test s'active pour une résidence et pas pour une autre.
- De bout en bout : un parcours complet (création de résidence, invitation, appel de charges, encaissement, dépense, signalement, annonce) produit les événements attendus dans un entonnoir PostHog, sans aucune donnée personnelle.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 7 · Sécurité** : remplacer la règle sur PostHog par « Seuls les événements et propriétés de `packages/shared/src/analytics.ts` sont envoyés, avec des identifiants hachés, après consentement. Aucun replay ni autocapture des clics. »
