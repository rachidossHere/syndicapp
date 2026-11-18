# 02b · Refonte visuelle

Statut : brouillon

## Objectif

Rendre l'appli plus chaleureuse et plus professionnelle, comme sur [docs/design-v2.png](../docs/design-v2.png), **sans réécrire les écrans un par un** : tout passe par `@syndic/ui`. Les nouvelles couleurs, icônes, illustrations, barre d'onglets et animations s'ajoutent au design system ; les écrans les reçoivent en changeant de composant, pas de logique.

## Décisions

- **Palette élargie** (en plus des jetons du plan 02, qui ne changent pas) :
  - `tealDeep` `#0A3A3E`, `terracotta` `#C2603A`, `saffron` `#E0A33B`, `palm` `#2F7A5F` ;
  - fonds teintés par domaine (charges, dépenses, signalements, annonces, comptes), chacun avec sa couleur d'icône ; les autres icônes de la maquette (appartements, membres, notifications) reçoivent leur teinte propre ;
  - contraste de texte d'au moins 4,5:1 pour toute paire fond/texte réellement utilisée ; `terracotta` seule ne porte jamais de texte courant (3:1 seulement : décor, grands textes, icônes) ;
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

- **Profil** : notifications, langue, changer de résidence, se déconnecter.
- **Animations** : `react-native-reanimated` ; jetons de durée (`fast` 150 ms, `normal` 250 ms) et de courbe dans `@syndic/ui` ; **toujours coupées ou réduites** quand « Réduire les animations » est activé sur le téléphone ; **jamais d'animation qui bloque une action** (le toucher reste actif pendant le mouvement, aucune attente de fin d'animation).
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

## Hors périmètre

- Thème sombre.
- Nouvelles fonctionnalités.
- Modification des règles métier, de l'API ou de la base.

## Étapes

### 1. Jetons, icônes duotone, motif zellige, jetons d'animation, galerie

Ajoute dans `@syndic/ui` : les nouvelles couleurs et teintes par domaine (avec test de contraste), les jetons de mouvement (durées, courbes, échelle d'appui), le composant `Icon` à variantes `line`, `duotone` et `tile` (pastille teintée de 40 à 56 px), le composant `ZelligePattern`, le hook `useReducedMotion` et le composant `PressableScale` (léger enfoncement au toucher, zone tactile d'au moins 44 px, sans animation quand le mouvement est réduit). Vérifie que `react-native-reanimated` et `react-native-svg` sont installés et configurés. Ajoute une galerie de développement (`__DEV__` seulement, accessible depuis l'accueil). Les écrans existants ne changent pas.

Terminé quand : la galerie affiche sur l'iPhone, en français et en arabe, les nouvelles couleurs, les huit icônes en pastille, le motif zellige et `PressableScale`, conformes à la maquette ; `PressableScale` ne s'anime plus quand « Réduire les animations » est activé ; les écrans existants sont inchangés ; `pnpm typecheck`, `pnpm test` et `expo export` iOS passent.

### 2. Illustrations SVG, états vides, annonces illustrées, bienvenue

Crée les illustrations SVG de `@syndic/ui` (état vide « Tout va bien dans la résidence », icônes de catégories d'annonces, scène de bienvenue). Utilise-les dans `EmptyState`, les cartes d'annonces (catégorie illustrée, comme l'écran 3 de la maquette) et l'écran de bienvenue (emplacement de l'image IA tenu par une illustration). Le motif zellige orne les en-têtes et les états vides.

Terminé quand : chaque état vide existant affiche une illustration adaptée, les annonces sont illustrées par catégorie, l'écran de bienvenue correspond à l'écran 5 de la maquette, le tout lisible en RTL, et vérifié sur l'iPhone en français et en arabe.

### 3. Barre d'onglets selon le rôle, accueils, Profil

Remplace la navigation actuelle par la barre d'onglets du tableau ci-dessus (Expo Router, onglets de la résidence active), crée l'onglet **Profil** (notifications, langue, changer de résidence, se déconnecter), et refais les accueils syndic et habitant (écrans 1 et 2 de la maquette) avec les composants de `@syndic/ui`. Aucune règle métier ni route d'API ne change.

Terminé quand : pour chacun des six rôles, la barre affiche exactement les onglets du tableau et rien d'autre, le changement de résidence recalcule les onglets, l'API refuse toujours ce que le rôle ne peut pas faire, et le tout est vérifié sur l'iPhone avec un compte par type de rôle disponible.

### 4. Animations et transitions

Branche les animations sur les écrans : transitions d'écrans, onglets, toucher des boutons et cartes (`PressableScale`), apparition des listes, accordéon, toast, squelettes de chargement. Durées `fast` 150 ms et `normal` 250 ms, courbes des jetons, `useReducedMotion` partout, aucune animation qui retarde une action.

Terminé quand : chaque animation a une version réduite (fondu ou rien) quand « Réduire les animations » est activé, aucun toucher n'est retardé ou ignoré pendant un mouvement, et le tout est vérifié sur l'iPhone avec et sans « Réduire les animations ».

## Vérification

- `pnpm typecheck`, `pnpm test` et `expo export` iOS passent ; `pnpm lint` si le Visual C++ x64 est installé.
- Aucune couleur, taille, durée ou courbe codée en dur dans `apps/mobile` ; aucune icône hors du composant `Icon`.
- Contraste d'au moins 4,5:1 pour chaque paire de texte utilisée.
- Sur l'iPhone, en français puis en arabe, avec et sans « Réduire les animations » : aucun texte coupé, motifs et illustrations lisibles, chevrons inversés, toucher immédiat.
- Les écrans d'étapes précédentes (charges, dépenses, signalements, annonces) fonctionnent comme avant.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

À proposer à la fin du plan, sans les appliquer sans validation :

- **Section 7 · Mobile** : « Toute animation utilise les jetons de mouvement de `@syndic/ui` (durées, courbes) et `useReducedMotion` : elle est coupée ou réduite quand « Réduire les animations » est activé, et ne retarde jamais une action. »
- **Section 7 · Mobile** : « Les icônes ne s'affichent que par le composant `Icon` de `@syndic/ui` (variantes `line`, `duotone`, `tile`). »
