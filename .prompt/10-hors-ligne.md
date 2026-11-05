# 10 · Mode hors ligne

Statut : brouillon

## Objectif

Le syndic peut encaisser une charge ou ajouter une dépense sans réseau (dans le hall, au parking). L'action est enregistrée sur le téléphone et envoyée automatiquement dès que la connexion revient, sans doublon.

## Décisions

- Périmètre hors ligne : **encaissement** et **dépense** uniquement (avec la photo de la facture). Le reste de l'appli affiche les dernières données en cache avec un bandeau « Hors ligne ».
- Cache de lecture : persistance du cache TanStack Query avec `@tanstack/query-async-storage-persister` (données non sensibles uniquement : pas de jeton).
- File d'attente des actions : `useMutation` avec mutations persistées de TanStack Query (`resumePausedMutations` au retour du réseau), ou une file maison dans SQLite (`expo-sqlite`) si la persistance des mutations ne convient pas. Choisir après un test et noter le choix.
- Détection du réseau : `@react-native-community/netinfo` branché sur `onlineManager` de TanStack Query.
- **Idempotence** : chaque action reçoit un identifiant unique (`client_id`, UUID) créé sur le téléphone. L'API l'enregistre (contrainte unique) et renvoie le résultat existant si la même action arrive deux fois.
- Photos hors ligne : gardées dans le stockage de l'appli (`expo-file-system`), envoyées avant l'enregistrement de la dépense au retour du réseau, puis supprimées.
- Conflits : si un dû a été payé entre-temps par quelqu'un d'autre, l'API refuse l'encaissement et l'appli affiche l'action en échec avec une explication, sans la réessayer en boucle.
- Indicateur : badge « En attente d'envoi (2) » sur l'accueil du syndic, avec la liste des actions et leur état.

## Hors périmètre

- Modification hors ligne des signalements, annonces, membres.
- Synchronisation complète de la base sur le téléphone.

## Étapes

### 1. Idempotence côté API

Ajoute `client_id` (unique par résidence) à `payment` et `expense`, migration sur `dev`. Les routes de création renvoient le résultat existant si le `client_id` existe déjà.

Terminé quand : envoyer deux fois la même requête ne crée qu'un paiement et renvoie deux fois la même réponse.

### 2. Cache et détection du réseau

Branche NetInfo sur `onlineManager`, persiste le cache de lecture, affiche le bandeau « Hors ligne » et les dernières données.

Terminé quand : en mode avion, l'appli s'ouvre et affiche les dernières données connues.

### 3. File d'attente des actions

Teste la persistance des mutations de TanStack Query ; si elle ne survit pas à la fermeture de l'appli de façon fiable, implémente la file dans `expo-sqlite`. Branche l'encaissement et la dépense (photo incluse) sur cette file. Ajoute l'écran « En attente d'envoi » avec réessai et suppression manuelle d'une action en échec.

Terminé quand : une action faite en mode avion part seule au retour du réseau, même après fermeture de l'appli entre-temps.

## Vérification

- `pnpm typecheck` et `pnpm lint` passent.
- Mode avion : 3 encaissements et 1 dépense avec photo → fermeture de l'appli → réseau rétabli → réouverture → les 4 actions sont envoyées une seule fois, dans l'ordre.
- Réseau coupé au milieu d'un envoi → aucun doublon.
- Conflit : un dû payé par le trésorier pendant que le syndic était hors ligne → l'action du syndic est refusée et expliquée.
- Aucun jeton ni donnée d'un autre lot dans le cache persisté.
- Le solde et les statuts sont corrects après la synchronisation.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 6 · Règles de code, partie API** : ajouter « Toute création qui peut être faite hors ligne accepte un `client_id` et est idempotente. »
- **Section 6 · Règles de code, partie Mobile** : la règle « Les actions du syndic doivent fonctionner hors ligne » est précisée par « Encaissements et dépenses passent par la file d'attente hors ligne ; le cache persisté ne contient jamais de jeton. »
