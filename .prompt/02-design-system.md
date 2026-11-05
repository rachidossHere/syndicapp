# 02 · Design system

Statut : brouillon

## Objectif

Tous les écrans de l'appli (habitant et syndic) partagent les mêmes couleurs, typographies, espacements et composants de base, en français comme en arabe. Un développeur construit un nouvel écran uniquement à partir des jetons et des composants du package `ui`, sans valeur codée en dur.

## Décisions

- Le design system vit dans un nouveau package `packages/ui`, utilisé par `apps/mobile` (et plus tard par le web).
- Style avec `StyleSheet` de React Native et des jetons TypeScript : pas de NativeWind ni de bibliothèque de composants tierce, pour limiter les dépendances.
- Thème clair uniquement pour le MVP ; les jetons sont nommés par rôle (`bg`, `surface`, `text`…) pour permettre un thème sombre plus tard sans toucher aux écrans.
- Ambiance : chaleureuse et rassurante. Fond sable, couleur principale bleu pétrole, accent ambre pour l'action la plus importante d'un écran.
- Police latine : **Plus Jakarta Sans** (400, 500, 600, 700, 800). Police arabe : **IBM Plex Sans Arabic** (400, 500, 600, 700). Chargées avec `expo-font` via les paquets `@expo-google-fonts`.
- Le composant `Text` choisit automatiquement la police selon la langue active (`fr` → Plus Jakarta Sans, `ar` → IBM Plex Sans Arabic).
- RTL géré avec `I18nManager` : les composants utilisent `start`/`end` (`marginStart`, `paddingEnd`…), jamais `left`/`right`.
- Icônes : **lucide-react-native** (trait de 2 px, taille 20 ou 22). Pas d'emoji dans l'interface.
- Taille minimale d'une zone tactile : **44 px**. Boutons principaux : 48 à 52 px de haut.
- Contraste du texte d'au moins **4,5:1** (3:1 pour un texte de 24 px et plus). Les états (payé, impayé…) ne reposent jamais sur la couleur seule : toujours un libellé.
- Montants affichés avec un espace comme séparateur de milliers et « MAD » en suffixe (`18 420 MAD`). Entrées en vert, sorties en terracotta, toujours avec le signe `+` ou `−`.

### Couleurs

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `primary` | `#0F5257` | Boutons principaux, onglet actif, liens |
| `primaryPressed` | `#0A3A3E` | Bouton principal appuyé |
| `primarySoft` | `#E6EFEE` | Fond d'élément sélectionné, avatars |
| `primaryDisabled` | `#8FA9AB` | Bouton principal désactivé |
| `accent` | `#F2B33D` | Une seule action clé par écran (ex. « Payer maintenant ») ; texte dessus : `text` |
| `bg` | `#F6F2EA` | Fond des écrans |
| `surface` | `#FFFFFF` | Cartes, champs, barre d'onglets |
| `surfaceMuted` | `#FBF9F4` | Fond de champ, encadrés secondaires |
| `border` | `#E9E2D4` | Bordure des cartes |
| `borderStrong` | `#CFC6B4` | Bordure des champs et boutons secondaires |
| `text` | `#1D2327` | Texte principal |
| `textMuted` | `#5C6670` | Texte secondaire, libellés |
| `iconInactive` | `#6B747C` | Onglets inactifs |
| `textInverse` | `#FFFFFF` | Texte sur `primary` |
| `successBg` / `successFg` | `#DCEFE6` / `#1F5E43` | Payé, résolu, confirmation, entrée d'argent (`successFg`) |
| `warningBg` / `warningFg` | `#FCEBD0` / `#7A4F00` | En cours, échéance proche |
| `dangerBg` / `dangerFg` | `#FBE3DA` / `#8E3512` | Impayé, ouvert, urgent |
| `infoBg` / `infoFg` | `#E3E8F4` / `#2E4A86` | Information neutre |
| `moneyOut` | `#A8461B` | Sorties d'argent |

### Typographie

| Jeton | Taille / interligne | Graisse | Usage |
| --- | --- | --- | --- |
| `display` | 34 / 40 | 800 | Montant principal d'une carte |
| `h1` | 28 / 34 | 800 | Titre d'écran web |
| `h2` | 22 / 28 | 800 | Titre d'écran mobile |
| `h3` | 17 / 24 | 700 | Titre de section, titre de carte |
| `bodyStrong` | 15 / 22 | 700 | Libellé d'élément de liste, bouton |
| `body` | 15 / 22 | 400 | Texte courant |
| `small` | 13 / 19 | 500 | Texte secondaire, dates |
| `caption` | 12 / 16 | 700 | Badges, onglets, petites étiquettes |

En arabe, l'interligne est augmenté d'environ 15 % (le composant `Text` s'en charge).

### Espacements et rayons

- Espacements (base 4) : `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32.
- Marge latérale des écrans mobiles : 20. Espace entre cartes d'une liste : 12 (`md`) ; entre sections : 16 (`lg`).
- Rayons : `sm` 10, `md` 12, `lg` 16, `xl` 20, `pill` 999.

### Correspondance des statuts

| Domaine | Valeur | Ton | Libellé FR |
| --- | --- | --- | --- |
| Paiement | `paid` | success | Payé |
| Paiement | `unpaid` | danger | Impayé |
| Signalement | `open` | danger | Ouvert |
| Signalement | `in_progress` | warning | En cours |
| Signalement | `resolved` | success | Résolu |

### Composants de base

`Text`, `Screen`, `Button` (variantes `primary`, `accent`, `secondary`, `ghost` ; états appuyé, désactivé, chargement), `Card`, `TextField` (libellé, aide, erreur), `Badge` (tons success, warning, danger, info), `StatusBadge` (à partir d'un statut métier), `Amount`, `ListItem`, `ActionTile` (grande tuile d'action de l'accueil syndic), `Avatar` (initiales), `Toast` (confirmation), `EmptyState`, `TabBar`.

## Hors périmètre

- Thème sombre.
- Version web du design system (le package est prévu pour, mais rien n'est construit côté web ici).
- Illustrations, animations et logo définitif.
- Écrans métier : ce plan livre les briques, pas les écrans (charges, dépenses, signalements…).
- Traduction complète de l'appli : seulement le mécanisme de choix de police et de sens d'écriture.

## Étapes

### 1. Créer le package `ui` et les jetons

Crée `packages/ui` dans le monorepo pnpm (nom `@syndic/ui`, TypeScript strict, exporté depuis `src/index.ts`). Ajoute `src/tokens/colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts` avec exactement les valeurs des tableaux de la section Décisions, exportées en objets `as const` avec leurs types. Ajoute `src/tokens/status.ts` avec la correspondance des statuts (ton + clé de traduction). Ajoute `@syndic/ui` aux dépendances de `apps/mobile`.

Terminé quand : `pnpm typecheck` passe à la racine, `apps/mobile` peut importer `colors.primary` depuis `@syndic/ui`, et l'appli démarre comme avant.

### 2. Polices, langue et sens d'écriture

Dans `apps/mobile`, installe `expo-font`, `@expo-google-fonts/plus-jakarta-sans` et `@expo-google-fonts/ibm-plex-sans-arabic`. Charge les graisses listées dans les Décisions au démarrage et garde l'écran de démarrage tant qu'elles ne sont pas prêtes. Dans `packages/ui`, crée un `ThemeProvider` qui expose les jetons et la langue active (`fr` ou `ar`), et une fonction utilitaire qui renvoie la bonne famille de police selon la graisse et la langue. Branche `I18nManager.forceRTL` sur la langue (avec rechargement de l'appli quand elle change).

Terminé quand : l'appli démarre avec Plus Jakarta Sans en français, passe en arabe avec IBM Plex Sans Arabic et une mise en page de droite à gauche, et revient en français sans erreur.

### 3. Composants de texte et de mise en page

Dans `packages/ui/src/components`, crée `Text` (prop `variant` correspondant aux jetons de typographie, prop `tone` : `default`, `muted`, `inverse`, `success`, `danger`…), `Screen` (fond `bg`, marge latérale 20, zone sûre, défilement optionnel), `Card` (fond `surface`, bordure `border`, rayon `lg`, padding 16) et `Avatar` (initiales sur `primarySoft`). Aucun style codé en dur : uniquement les jetons. Utilise `start`/`end` pour tous les espacements horizontaux.

Terminé quand : ces composants sont exportés par `@syndic/ui`, typés, et s'affichent correctement en français et en arabe.

### 4. Boutons, champs et retours

Crée `Button` (variantes `primary`, `accent`, `secondary`, `ghost` ; hauteur 48 par défaut, 52 en taille `lg` ; états appuyé, désactivé, chargement avec indicateur ; icône optionnelle au début), `TextField` (libellé obligatoire, aide, message d'erreur en `dangerFg`, hauteur 48, bordure `borderStrong`, bordure `primary` au focus, compatible avec React Hook Form via `forwardRef`), `Toast` (fond `successBg`, texte `successFg`, icône de validation, annoncé aux lecteurs d'écran) et `EmptyState`. Installe `lucide-react-native` (et `react-native-svg` si absent) pour les icônes.

Terminé quand : chaque bouton a une zone tactile d'au moins 44 px, un `accessibilityRole` et un libellé accessible, et chaque champ annonce son libellé et son erreur.

### 5. Composants métier génériques

Crée `Badge` (tons success, warning, danger, info ; forme `pill`, texte `caption`), `StatusBadge` (prend un statut métier comme `unpaid` ou `in_progress` et affiche le bon ton et le bon libellé via `status.ts`), `Amount` (prend un montant en centimes et un sens `in`/`out`/`neutral`, formate `18 420 MAD`, ajoute `+`/`−` et la couleur), `ListItem` (titre, sous-titre, élément à la fin), `ActionTile` (icône dans un carré coloré, libellé, hauteur minimale 112) et `TabBar` (4 onglets maximum, icône 22 + libellé `caption`, couleur `primary` actif et `iconInactive` sinon).

Terminé quand : `Amount` affiche correctement 0, 450, 18 420 et 1 250 000 MAD dans les deux langues, et `StatusBadge` couvre tous les statuts du tableau.

### 6. Écran de démonstration

Ajoute dans `apps/mobile` un écran `/dev/design-system`, accessible uniquement en mode développement, qui affiche toutes les couleurs, toutes les variantes de texte, tous les boutons et leurs états, les champs (vide, rempli, erreur), les badges, des montants, une liste, des tuiles d'action et la barre d'onglets. Ajoute un bouton pour basculer entre français et arabe.

Terminé quand : l'écran présente chaque composant et chaque jeton, et sert de référence visuelle pour les fonctionnalités suivantes.

## Vérification

- `pnpm typecheck` et le linter passent sur tout le monorepo.
- Recherche dans `apps/mobile` : aucune couleur hexadécimale, taille de police ou rayon codé en dur en dehors de `packages/ui`.
- Sur l'écran de démonstration, en français puis en arabe : polices correctes, alignements et icônes de direction inversés en arabe, aucun texte coupé.
- Contraste : vérifier `textMuted` sur `bg`, `textInverse` sur `primary`, `successFg` sur `successBg`, `warningFg` sur `warningBg`, `dangerFg` sur `dangerBg` ; tous au moins 4,5:1.
- Accessibilité : avec TalkBack (Android) ou VoiceOver (iOS), chaque bouton, champ et badge est annoncé avec un libellé compréhensible ; aucune zone tactile sous 44 px.
- Grandes polices système : avec la taille de texte du téléphone au maximum, les écrans restent utilisables (le texte passe à la ligne au lieu d'être coupé).
- Bout en bout : reconstruire sur l'écran de démonstration la carte « Charges du trimestre » (montant `display`, échéance `small`, bouton `accent` « Payer maintenant ») et une ligne de signalement avec `StatusBadge`, uniquement avec les composants de `@syndic/ui`, en français et en arabe.

## Mises à jour d'[AGENTS.md](../AGENTS.md)

- **Section 4 · Stack technique** : ajouter `lucide-react-native` pour les icônes, `expo-font` avec Plus Jakarta Sans et IBM Plex Sans Arabic pour les polices, et préciser « style avec `StyleSheet` et les jetons de `@syndic/ui`, sans NativeWind ni bibliothèque de composants tierce ».
- **Section 5 · Structure du dépôt** : ajouter `packages/ui/ → design system : jetons, thème, composants de base (@syndic/ui)`.
- **Section 6 · Règles de code, partie Mobile** : ajouter « Aucune couleur, taille de police, espacement ou rayon codé en dur dans `apps/mobile` : utiliser les jetons et les composants de `@syndic/ui`. Un besoin non couvert se traite en ajoutant un jeton ou un composant au package, pas dans l'écran. » et « Les statuts métier s'affichent toujours avec `StatusBadge`, les montants toujours avec `Amount`. »
- **Section 6 · Règles de code, partie Mobile** : la règle existante « Boutons et zones tactiles d'au moins 44 px, contrastes lisibles, prise en charge du RTL » est remplacée par « Zones tactiles d'au moins 44 px, contraste du texte d'au moins 4,5:1, espacements en `start`/`end` (jamais `left`/`right`), états jamais signalés par la couleur seule. »
