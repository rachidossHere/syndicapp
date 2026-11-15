// Vérification du plan 07 côté mobile : contrôles de code qui ne dépendent d'aucun écran ni réseau.
// Placé dans apps/api (qui dispose des types Node) pour ne pas ajouter @types/node à l'appli mobile :
// le code de apps/mobile/src est lu comme du texte, jamais exécuté.
// Un test `it.fails` décrit le comportement attendu d'un constat ouvert de la vérification : il passe
// tant que le constat existe et échouera quand il sera corrigé (le retirer alors).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';


const SRC = resolve(import.meta.dirname, '../../mobile/src');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

/** Tous les fichiers .ts/.tsx de l'appli, sauf les tests. */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const scan = (pattern: RegExp) =>
  sourceFiles().flatMap((file) =>
    read(relative(SRC, file))
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${relative(SRC, file)}:${index + 1}: ${line.trim()}`] : [])),
  );

describe('vérification 07 · aiguillage selon le rôle', () => {
  it('la vue de traitement dépend uniquement de issues.manage, et les deux écrans d’entrée s’en servent', () => {
    expect(read('lib/issues.ts')).toContain("can(role, 'issues.manage') ? 'manage' : 'resident'");
    for (const file of ['issues-screen.tsx', 'issue-detail-screen.tsx']) {
      const source = read(`features/issues/${file}`);
      expect(source, file).toContain('issuesViewFor(active?.role)');
      expect(source, file).toContain('ManageIssue');
      expect(source, file).toContain('ResidentIssue');
    }
  });
});

describe('vérification 07 · cache TanStack Query', () => {
  it('toutes les clés de requête des signalements contiennent la résidence', () => {
    // Le hook importe React Native : on lit sa source plutôt que de l'exécuter.
    expect(read('hooks/use-issues.ts')).toContain("issuesQueryKey = (residenceId: string) => ['issues', residenceId]");
    const source = read('hooks/use-issues.ts');
    const keys = [...source.matchAll(/queryKey:\s*([^\n]+)/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    for (const key of keys) expect(key).toContain('issuesQueryKey(');
    // Les mutations n'invalident que la résidence concernée.
    for (const m of source.matchAll(/invalidateQueries\(\{\s*queryKey:\s*([^}]+)\}/g)) expect(m[1]).toContain('issuesQueryKey(');
  });

  it('aucun cache persisté, aucun AsyncStorage : le cache ne contient donc jamais de jeton', () => {
    expect(scan(/persistQueryClient|PersistQueryClientProvider|createSyncStoragePersister|createAsyncStoragePersister|AsyncStorage\./)).toEqual([]);
  });

  it('la déconnexion vide le cache et la résidence active', () => {
    const source = read('hooks/use-session.ts');
    expect(source).toContain('queryClient.clear()');
    expect(source).toContain('setActiveResidenceId(null)');
  });

  // Correctif V07-03 : `apiFetch` lisait X-Residence-Id dans un état global à l'envoi (après un await),
  // alors que la clé de cache est figée au rendu : un changement de résidence entre les deux rangeait
  // la réponse d'une résidence sous la clé de l'autre. Chaque appel d'un hook à clé par résidence
  // fixe donc l'en-tête avec inResidence(residenceId). Exceptions (aucune clé de cache par résidence) :
  // actions ponctuelles sans résidence en paramètre, listées ici pour que tout nouvel appel soit vu.
  it('les hooks à clé de cache par résidence envoient la résidence de leur clé (en-tête explicite)', () => {
    const exceptions: Record<string, number> = {
      'hooks/use-issues.ts': 0,
      'hooks/use-lots.ts': 0,
      'hooks/use-cash.ts': 1, // useCancelExpense
      'hooks/use-charges.ts': 2, // useOpenReceipt, fetchReceiptUrl
      'hooks/use-invitations.ts': 2, // aperçu et acceptation d'un code (avant toute résidence)
    };
    for (const [file, allowed] of Object.entries(exceptions)) {
      const source = read(file);
      const calls = (source.match(/apiFetch</g) ?? []).length;
      const explicit = (source.match(/inResidence\(/g) ?? []).length;
      expect({ file, explicit }).toEqual({ file, explicit: calls - allowed });
    }
  });
});

describe('vérification 07 · règles de style de l’appli', () => {
  it('aucune couleur codée en dur dans apps/mobile', () => {
    expect(scan(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/)).toEqual([]);
  });

  it('aucune taille, espacement ou rayon numérique codé en dur dans apps/mobile (opacity: 0 du champ invisible exclu)', () => {
    const numeric =
      /\b(fontSize|lineHeight|borderRadius|borderWidth|padding\w*|margin\w*|gap|rowGap|columnGap|width|height|minHeight|minWidth|maxHeight|maxWidth|top|bottom|start|end|letterSpacing)\s*:\s*-?[0-9]/;
    expect(scan(numeric)).toEqual([]);
    expect(scan(/\b(size|strokeWidth|hitSlop)=\{\s*[0-9]/)).toEqual([]);
  });

  it('start/end partout : jamais left/right, ni row-reverse, ni alignement de texte physique', () => {
    expect(
      scan(/\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor)\s*:|textAlign:\s*['"](left|right)['"]|row-reverse/),
    ).toEqual([]);
  });

  it('icônes lucide importées une par une (jamais de valeur depuis l’index du paquet)', () => {
    expect(scan(/^import\s+(?!type\b)[^;]*from\s+['"]lucide-react-native['"]/)).toEqual([]);
  });

  it('les écrans des signalements affichent les statuts avec StatusBadge et les compteurs sans couleur seule', () => {
    for (const file of ['issue-row.tsx', 'resident-issue-detail-screen.tsx', 'manage-issue-screen.tsx']) {
      expect(read(`features/issues/${file}`), file).toContain('StatusBadge');
    }
    // « Urgent » est toujours un libellé (Badge avec label), jamais une couleur seule.
    expect(read('features/issues/issue-row.tsx')).toMatch(/<Badge[^>]*label=\{t\('issues\.urgent'\)\}/);
  });

  it('les références d’appartement sont isolées de gauche à droite dans les textes arabes (LRI/PDI)', () => {
    const source = read('lib/issues.ts');
    expect(source).toContain('⁦');
    expect(source).toContain('⁩');
  });
});
