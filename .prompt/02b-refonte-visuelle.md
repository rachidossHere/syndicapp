# 02b · Refonte visuelle

Statut : en cours

## Objectif

Rendre l'appli plus chaleureuse et plus professionnelle, comme sur [docs/design-v2.png](../docs/design-v2.png), **sans réécrire les écrans un par un** : tout passe par `@syndic/ui`. Les nouvelles couleurs, icônes, illustrations, barre d'onglets et animations s'ajoutent au design system ; les écrans les reçoivent en changeant de composant, pas de logique.

## Décisions

- **Palette élargie** (en plus des jetons du plan 02, qui ne changent pas) :
  - `tealDeep` `#0A3A3E`, `terracotta` `#C2603A`, `saffron` `#E0A33B`, `palm` `#2F7A5F` ;
  - fonds teintés par domaine, chacun avec sa couleur d'icône : charges, dépenses, signalements, annonces, comptes, et les 3 domaines ajoutés à l'étape 1 (appartements, membres, notifications) ;
  - contraste de texte d'au moins 4,5:1 pour toute paire fond/texte réellement utilisée ; `terracotta` seule ne porte jamais de texte courant (3:1 seulement) : elle est réservée au décor et aux grands textes ;
  - aucun changement de couleur sur les écrans existants avant l'étape qui les concerne.
- **Icônes lucide en duotone** : contour plein plus remplissage léger de la même couleur, via **un seul composant `Icon`** de `@syndic/ui` (variantes `line`, `duotone`, `tile`). Une icône n'est jamais affichée autrement que par ce composant.
- **Motif zellige** en SVG (`react-native-svg`), environ 10 % d'opacité, sur les en-têtes et les états vides. Symétrique : identique en français et en arabe.
- **Illustrations en SVG** dans `@syndic/ui`.
- **Images IA** : fournies par Rachid (WebP, moins de 150 Ko, aucun visage réel), intégrées à l'appli (dossier `assets`), **jamais dans R2**. En attendant, l'emplacement est tenu par une illustration SVG.
- **Barre d'onglets selon le rôle de la résidence active** :

  | Rôle | Onglets |
  | --- | --- |
  | `manager`, `treasurer` | Accueil, Charges, Signalements, Annonces, Profil |
  | `deputy` | Accueil, Comptes, Signalements, Annonces, Profil |
  | `owner` | Accueil, Mes charges, Signaler, Annonces, Profil |
  | `tenant`, `caretaker` | Accueil, Signalements, Annonces, Profil |

- **Barre d'onglets : implémentation.** À l'étape 3, essayer d'abord `NativeTabs` d'Expo Router ; il n'est retenu que s'il accepte nos icônes, les libellés FR et AR et des onglets différents selon le rôle. Sinon, barre personnalisée avec le composant `Icon`. **Aucune animation au changement d'onglet.**
- **Profil** : notifications, langue, changer de résidence, se déconnecter.
- **Animations** : `react-native-reanimated` ; jetons de durée (`fast` 150 ms, `normal` 250 ms) et de courbe dans `@syndic/ui` ; **toujours coupées ou réduites** quand « Réduire les animations » est activé sur le téléphone ; **jamais d'animation qui bloque une action** (le toucher reste actif pendant le mouvement, aucune attente de fin d'animation).
- **Toucher** : `PressableScale` pour les cartes ; pour les lignes de liste pleine largeur, pas d'échelle mais un fond qui s'éclaircit.
- **Mouvement réduit** : opacité immédiate, sans échelle ni transition.
- **Thème clair seulement**, comme aujourd'hui.
- **RTL** : motifs et illustrations restent lisibles ; chevrons et flèches sont inversés.
- Les règles d'AGENTS.md priment : jetons uniquement dans `apps/mobile`, zones tactiles d'au moins 44 px, `start`/`end`, états jamais signalés par la couleur seule.

## Skills par étape

| Étape | Skills |
| --- | --- |
| 1 · Jetons, icônes, zellige, animation | `expo-design-system`, `expo-native-ui`, `expo-animation` |
| 2 · Illustrations et écrans illustrés | `expo-design-system`, `expo-native-ui` |
| 3 · Barre d'onglets, accueils, Profil | `expo-design-system`, `expo-native-ui`, `expo-animation`, `expo-router` |
| 4 · Animations et transitions | `expo-design-system`, `expo-native-ui`, `expo-animation` |
| 5 · Écrans regroupés en accordéons | `expo-design-system`, `expo-native-ui`, `expo-animation`, `expo-data-fetching`, `neon-postgres` |

## Hors périmètre

- Thème sombre.
- Nouvelles fonctionnalités.
- Modification des règles métier, de l'API ou de la base.

## Étapes

### 1. Jetons, icônes duotone, motif zellige, jetons d'animation, galerie

Ajoute dans `@syndic/ui` : les nouvelles couleurs et teintes par domaine (avec test de contraste), les jetons de mouvement (durées, courbes, échelle d'appui), le composant `Icon` à variantes `line`, `duotone` et `tile` (pastille teintée de 40 à 56 px), le composant `ZelligePattern`, le hook `useReducedMotion` et le composant `PressableScale` (léger enfoncement au toucher pour les cartes, zone tactile d'au moins 44 px, opacité immédiate sans échelle ni transition quand le mouvement est réduit). Vérifie que `react-native-reanimated` et `react-native-svg` sont installés et configurés. Ajoute une galerie de développement (`__DEV__` seulement, accessible depuis l'accueil). Les écrans existants ne changent pas.

Terminé quand : la galerie affiche sur l'iPhone, en français et en arabe, les nouvelles couleurs, les huit icônes en pastille, le motif zellige et `PressableScale`, conformes à la maquette ; `PressableScale` ne s'anime plus quand « Réduire les animations » est activé ; les écrans existants sont inchangés ; `pnpm typecheck`, `pnpm test` et `expo export` iOS passent.

### 2. Illustrations SVG, états vides, annonces illustrées, bienvenue

Crée les illustrations SVG de `@syndic/ui` (état vide « Tout va bien dans la résidence », icônes de catégories d'annonces, scène de bienvenue). Utilise-les dans `EmptyState`, les cartes d'annonces (catégorie illustrée, comme l'écran 3 de la maquette) et l'écran de bienvenue (emplacement de l'image IA tenu par une illustration). Le motif zellige orne les en-têtes et les états vides.

Terminé quand : chaque état vide existant affiche une illustration adaptée, les annonces sont illustrées par catégorie, l'écran de bienvenue correspond à l'écran 5 de la maquette, le tout lisible en RTL, et vérifié sur l'iPhone en français et en arabe.

### 3. Barre d'onglets selon le rôle, accueils, Profil

Remplace la navigation actuelle par la barre d'onglets du tableau ci-dessus (Expo Router, onglets de la résidence active ; essaie d'abord `NativeTabs`, sinon barre personnalisée avec `Icon`, voir Décisions ; aucune animation au changement d'onglet), crée l'onglet **Profil** (notifications, langue, changer de résidence, se déconnecter), et refais les accueils syndic et habitant (écrans 1 et 2 de la maquette) avec les composants de `@syndic/ui`. Aucune règle métier ni route d'API ne change.

Terminé quand : pour chacun des six rôles, la barre affiche exactement les onglets du tableau et rien d'autre, le changement de résidence recalcule les onglets, l'API refuse toujours ce que le rôle ne peut pas faire, et le tout est vérifié sur l'iPhone avec un compte par type de rôle disponible.

### 4. Animations et transitions

Branche les animations sur les écrans : transitions d'écrans (pas d'animation au changement d'onglet), toucher des cartes (`PressableScale`) et des lignes de liste pleine largeur (fond qui s'éclaircit), apparition des listes, accordéon, toast, squelettes de chargement. Durées `fast` 150 ms et `normal` 250 ms, courbes des jetons, `useReducedMotion` partout, aucune animation qui retarde une action.

Terminé quand : chaque animation a une version réduite (opacité immédiate, sans échelle ni transition) quand « Réduire les animations » est activé, aucun toucher n'est retardé ou ignoré pendant un mouvement, et le tout est vérifié sur l'iPhone avec et sans « Réduire les animations ».

### 5. Écrans regroupés en accordéons

Référence : [docs/accordeons.png](../docs/accordeons.png). Regroupe les écrans avec le composant `Accordion` de `@syndic/ui`.

Règle commune : la section la plus récente ou la plus urgente est ouverte, les autres fermées ; chaque section fermée affiche toujours son résumé exact (nombre, total, statut) ; une section ne charge ses éléments qu'à son ouverture (pagination existante, « Afficher plus ») ; l'état ouvert ou fermé est gardé en mémoire pendant la session (jamais stocké) ; animations et « Réduire les animations » comme à l'étape 4 ; chevron inversé en RTL.

Écrans :
1. **Charges** (syndic, trésorier) : par année, l'année en cours ouverte ; résumé : appels, % encaissé, « N impayés » ou « Soldé » ; chaque appel garde sa barre de progression et son échéance.
2. **Impayés d'un appel** : par bâtiment, le premier bâtiment avec des impayés ouvert ; résumé : impayés et reste à payer ; « Relancer tous les impayés » reste au-dessus.
3. **Mes charges** (copropriétaire) : la carte du mois en cours reste au-dessus ; historique par année ; « N payés sur M » et total payé ; reçu sur chaque ligne payée.
4. **Comptes** : carte du solde au-dessus ; mouvements par mois, le mois en cours ouvert ; « +encaissé · −dépensé » ; jamais de nom.
5. **Signalements** (`issues.manage`) : bandeau des urgents au-dessus ; sections Ouverts, En cours, Résolus (nombres de `/api/issues/counts`) ; les puces de filtre disparaissent de cette vue ; l'habitant garde la liste actuelle.
6. **Annonces** : les épinglées restent au-dessus, hors accordéon ; les autres par mois ; les puces de catégorie restent au-dessus et s'appliquent aux sections.
7. **Appartements** : déjà par bâtiment ; en-têtes alignés sur la maquette.
8. **Profil** : pas d'accordéon ; une carte (résidence, notifications, langue), « Se déconnecter », la version.

API (résumés exacts sans charger les éléments ; mêmes droits et mêmes champs que les listes qu'ils résument, `residence_id` partout, aucun nom) : `GET /api/charge-calls/summary?groupBy=year`, `GET /api/charge-calls/:id/summary?groupBy=building`, `GET /api/me/dues/summary?groupBy=year`, `GET /api/cash/movements/summary?groupBy=month`, `GET /api/announcements/summary?groupBy=month` ; filtres de période sur les listes existantes (`?year=`, `?building=&unpaid=true`, `?pinned=&month=&category=` ; la caisse avait déjà `?from=&to=`). Aucune migration : seules des lectures.

Terminé quand : les huit écrans correspondent à la maquette (les différences sont listées), les résumés des sections fermées sont exacts, une section ne charge ses éléments qu'à son ouverture, `pnpm typecheck` et `expo export` iOS passent, et le tout est vérifié sur l'iPhone en français et en arabe (syndic et copropriétaire).

## Vérification

- `pnpm typecheck`, `pnpm test` et `expo export` iOS passent ; `pnpm lint` si le Visual C++ x64 est installé. Pas de tests automatiques depuis l'étape 3 : seuls `pnpm typecheck` et `expo export` iOS sont lancés.
- Aucune couleur, taille, durée ou courbe codée en dur dans `apps/mobile` ; aucune icône hors du composant `Icon`.
- Contraste d'au moins 4,5:1 pour chaque paire de texte utilisée.
- Sur l'iPhone, en français puis en arabe, avec et sans « Réduire les animations » : aucun texte coupé, motifs et illustrations lisibles, chevrons inversés, toucher immédiat.
- Les écrans d'étapes précédentes (charges, dépenses, signalements, annonces) fonctionnent comme avant.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

Appliquées à l'étape 1, sur validation de Rachid :

- **Section 7 · Mobile** : « Toute animation utilise les jetons de mouvement de `@syndic/ui` (durées, courbes) et `useReducedMotion` : elle est coupée ou réduite quand « Réduire les animations » est activé, et ne retarde jamais une action. »
- **Section 7 · Mobile** : « Les icônes ne s'affichent que par le composant `Icon` de `@syndic/ui` (variantes `line`, `duotone`, `tile`). »
