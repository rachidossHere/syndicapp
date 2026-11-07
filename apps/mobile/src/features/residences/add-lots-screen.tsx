// Écran 2 de docs/residences.png : ajouter les appartements (génération rapide ou un par un).
import { bulkLotsSchema, generateBulkLots, MAX_BULK_LOTS, type BulkLotsShape } from '@syndic/shared';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Screen,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { useCreateBulkLots, useCreateLot } from '@/hooks/use-lots';
import { useActiveResidence } from '@/hooks/use-residences';
import type { TranslationKey } from '@/i18n/translate';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { previewReferences } from '@/lib/invite-code';

type Mode = 'bulk' | 'single';
type BuildingChoice = { name: string; included: boolean };
type BulkIssue = 'lots.errors.noBuilding' | 'lots.errors.floors' | 'lots.errors.tooMany' | 'lots.errors.invalid';

const BUILDING_PATTERN = /^[A-Za-z0-9]{1,4}$/;
const FLOOR_PATTERN = /^\d{1,3}$/;
/** Appartements par étage proposés au maximum par le compteur. */
const MAX_PER_FLOOR = 20;
/** Durée d'affichage du toast, en millisecondes. */
const TOAST_MS = 3000;
/** Nombre maximal de références en conflit citées dans le message. */
const MAX_CITED_CONFLICTS = 10;

type BulkDraft = { buildings: string[]; floorFrom: string; floorTo: string; perFloor: number };

/** Clé d'erreur d'un réglage de génération invalide, ou `undefined` s'il est valide. */
function bulkIssue(draft: BulkDraft): BulkIssue | undefined {
  if (draft.buildings.length === 0) return 'lots.errors.noBuilding';
  if (!FLOOR_PATTERN.test(draft.floorFrom) || !FLOOR_PATTERN.test(draft.floorTo)) return 'lots.errors.floors';
  const floorFrom = Number(draft.floorFrom);
  const floorTo = Number(draft.floorTo);
  if (floorFrom > floorTo) return 'lots.errors.floors';
  const count = draft.buildings.length * (floorTo - floorFrom + 1) * draft.perFloor;
  if (count > MAX_BULK_LOTS) return 'lots.errors.tooMany';
  const parsed = bulkLotsSchema.safeParse({ buildings: draft.buildings, floorFrom, floorTo, perFloor: draft.perFloor });
  return parsed.success ? undefined : 'lots.errors.invalid';
}

function conflictText(references: readonly string[]): string {
  const cited = references.slice(0, MAX_CITED_CONFLICTS).join(', ');
  return references.length > MAX_CITED_CONFLICTS ? `${cited}…` : cited;
}

export function AddLotsScreen() {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const { active } = useActiveResidence();
  const createBulk = useCreateBulkLots(active?.id);
  const createLot = useCreateLot(active?.id);

  const [mode, setMode] = useState<Mode>('bulk');
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  // Génération rapide
  const [buildings, setBuildings] = useState<BuildingChoice[]>([{ name: 'A', included: true }]);
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [newBuilding, setNewBuilding] = useState('');
  const [floorFrom, setFloorFrom] = useState('1');
  const [floorTo, setFloorTo] = useState('4');
  const [perFloor, setPerFloor] = useState(3);

  // Un par un
  const [reference, setReference] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [referenceError, setReferenceError] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const included = useMemo(() => buildings.filter((b) => b.included).map((b) => b.name), [buildings]);
  const issue = bulkIssue({ buildings: included, floorFrom, floorTo, perFloor });
  const generated = useMemo(() => {
    if (issue !== undefined) return [];
    const shape: BulkLotsShape = {
      buildings: included,
      floorFrom: Number(floorFrom),
      floorTo: Number(floorTo),
      perFloor,
    };
    return generateBulkLots(shape).map((lot) => lot.reference);
  }, [issue, included, floorFrom, floorTo, perFloor]);
  const preview = previewReferences(generated);

  const busy = createBulk.isPending || createLot.isPending;

  const goBack = () => {
    if (isOnboarding) router.replace('/home');
    else if (router.canGoBack()) router.back();
    else router.replace('/home');
  };
  const finish = () => router.replace('/lots');

  const addBuilding = () => {
    const name = newBuilding.trim().toUpperCase();
    if (!BUILDING_PATTERN.test(name)) return;
    setBuildings((current) =>
      current.some((b) => b.name === name)
        ? current.map((b) => (b.name === name ? { ...b, included: true } : b))
        : [...current, { name, included: true }],
    );
    setNewBuilding('');
    setAddingBuilding(false);
  };

  const errorMessage = (caught: unknown, fallbackReferences: string[] = []): string => {
    if (caught instanceof ApiError && caught.status === 409) {
      const references = caught.references.length > 0 ? caught.references : fallbackReferences;
      if (references.length > 0) return t('lots.errors.conflict', { references: conflictText(references) });
    }
    return t(apiErrorKey(caught));
  };

  const onCreateBulk = async () => {
    if (busy || issue !== undefined) return;
    setError(undefined);
    try {
      await createBulk.mutateAsync({
        buildings: included,
        floorFrom: Number(floorFrom),
        floorTo: Number(floorTo),
        perFloor,
      });
      finish();
    } catch (caught) {
      // Tout ou rien : rien n'a été créé, les réglages restent affichés pour être corrigés.
      setError(errorMessage(caught));
    }
  };

  const onCreateSingle = async () => {
    if (busy) return;
    const trimmed = reference.trim();
    if (trimmed.length === 0 || trimmed.length > 20) {
      setReferenceError(t('lots.errors.referenceInvalid'));
      return;
    }
    const floorValue = floor.trim();
    if (floorValue !== '' && !FLOOR_PATTERN.test(floorValue)) {
      setError(t('auth.errors.invalidInput'));
      return;
    }
    setError(undefined);
    setReferenceError(undefined);
    try {
      await createLot.mutateAsync({
        reference: trimmed,
        building: building.trim() === '' ? undefined : building.trim().toUpperCase(),
        floor: floorValue === '' ? undefined : Number(floorValue),
      });
      setToast(t('lots.single.added', { reference: trimmed }));
      // Le brouillon n'est vidé qu'après le succès : la référence est libérée pour la suivante.
      setReference('');
    } catch (caught) {
      setError(errorMessage(caught, [trimmed]));
    }
  };

  const bulkLabel =
    generated.length === 1 ? t('lots.createBulkOne') : t('lots.createBulk', { count: generated.length });
  const issueKey: TranslationKey | undefined = issue;

  return (
    <Screen
      scroll
      footer={
        mode === 'bulk' ? (
          <Button
            label={issue === undefined ? bulkLabel : t('lots.createBulk', { count: 0 })}
            disabled={issue !== undefined}
            loading={createBulk.isPending}
            onPress={() => void onCreateBulk()}
          />
        ) : (
          <>
            <Button
              label={t('lots.single.submit')}
              loading={createLot.isPending}
              onPress={() => void onCreateSingle()}
            />
            <Button variant="ghost" label={t('lots.single.done')} onPress={finish} />
          </>
        )
      }>
      <AuthHeader onBack={goBack} />

      <View style={{ gap: spacing.xs }}>
        {isOnboarding && (
          <Text variant="caption" tone="primary">
            {t('common.step', { current: 2, total: 2 })}
          </Text>
        )}
        <Text variant="h2">{t('lots.title')}</Text>
      </View>

      {toast !== undefined && <Toast message={toast} />}
      {error !== undefined && <Banner message={error} />}

      <SegmentedControl
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(undefined);
        }}
        options={[
          { value: 'bulk', label: t('lots.mode.bulk') },
          { value: 'single', label: t('lots.mode.single') },
        ]}
      />

      {mode === 'bulk' ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong">{t('lots.buildings')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {buildings.map((b) => (
                <Chip
                  key={b.name}
                  label={b.name}
                  selected={b.included}
                  onPress={() =>
                    setBuildings((current) =>
                      current.map((item) => (item.name === b.name ? { ...item, included: !item.included } : item)),
                    )
                  }
                />
              ))}
              <Chip label={`+ ${t('lots.addBuilding')}`} onPress={() => setAddingBuilding((open) => !open)} />
            </View>
            {addingBuilding && (
              <TextField
                label={t('lots.newBuilding')}
                helper={t('lots.newBuildingHelper')}
                value={newBuilding}
                onChangeText={setNewBuilding}
                onSubmitEditing={addBuilding}
                maxLength={4}
                ltr
                autoFocus
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TextField
              containerStyle={{ flex: 1 }}
              label={t('lots.floorFrom')}
              value={floorFrom}
              onChangeText={setFloorFrom}
              keyboardType="number-pad"
              maxLength={3}
              ltr
            />
            <TextField
              containerStyle={{ flex: 1 }}
              label={t('lots.floorTo')}
              value={floorTo}
              onChangeText={setFloorTo}
              keyboardType="number-pad"
              maxLength={3}
              ltr
            />
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong">{t('lots.perFloor')}</Text>
            <Stepper
              label={t('lots.perFloor')}
              decreaseLabel={t('lots.decrease')}
              increaseLabel={t('lots.increase')}
              value={perFloor}
              onChange={setPerFloor}
              min={1}
              max={MAX_PER_FLOOR}
            />
          </View>

          {issueKey !== undefined ? (
            <Banner message={t(issueKey)} />
          ) : (
            <Card>
              <View style={{ gap: spacing.md }}>
                <Text variant="bodyStrong">
                  {generated.length === 1
                    ? t('lots.preview.countOne')
                    : t('lots.preview.count', { count: generated.length })}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {preview.shown.map((ref, index) => (
                    <View key={ref} style={{ flexDirection: 'row', gap: spacing.xs }}>
                      {preview.hasGap && index === 5 && <Badge label="…" />}
                      <Badge label={ref} />
                    </View>
                  ))}
                </View>
                <Text variant="small" tone="muted">
                  {t('lots.preview.hint')}
                </Text>
              </View>
            </Card>
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <TextField
            label={t('lots.single.reference')}
            placeholder={t('lots.single.referencePlaceholder')}
            value={reference}
            onChangeText={setReference}
            error={referenceError}
            editable={!busy}
            maxLength={20}
            ltr
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextField
            label={t('lots.single.building')}
            value={building}
            onChangeText={setBuilding}
            editable={!busy}
            maxLength={20}
            ltr
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextField
            label={t('lots.single.floor')}
            value={floor}
            onChangeText={setFloor}
            editable={!busy}
            keyboardType="number-pad"
            maxLength={3}
            ltr
          />
        </View>
      )}
    </Screen>
  );
}
