// Écran 2 de docs/residences.png : ajouter les appartements (génération rapide ou un par un).
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  IconButton,
  Screen,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
  Toast,
  useTheme,
} from '@syndic/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import X from 'lucide-react-native/icons/x';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ErrorNotice } from '@/components/network-error';
import { AuthHeader } from '@/features/auth/auth-header';
import { useCreateBulkLots, useCreateLot, useLots } from '@/hooks/use-lots';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/api-errors';
import { setFlashMessage } from '@/lib/flash-message';
import {
  addBuilding,
  buildingChips,
  createButton,
  existingBuildings,
  generationSummary,
  initialBuildingState,
  planGeneration,
  previewCreated,
  removeAddedBuilding,
  toggleBuilding,
  type BuildingState,
} from '@/lib/lot-generation';

type Mode = 'bulk' | 'single';

const FLOOR_PATTERN = /^\d{1,3}$/;
/** Appartements par étage proposés au maximum par le compteur. */
const MAX_PER_FLOOR = 20;
/** Durée d'affichage du toast, en millisecondes. */
const TOAST_MS = 3000;
/** Nombre maximal de références en conflit citées dans le message. */
const MAX_CITED_CONFLICTS = 10;

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
  const lots = useLots(active?.id);
  const createBulk = useCreateBulkLots(active?.id);
  const createLot = useCreateLot(active?.id);

  const [mode, setMode] = useState<Mode>('bulk');
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  // Génération rapide
  const [choice, setChoice] = useState<BuildingState | undefined>();
  const [addingBuilding, setAddingBuilding] = useState(false);
  const [newBuilding, setNewBuilding] = useState('');
  const [newBuildingError, setNewBuildingError] = useState<string | undefined>();
  const [floorFrom, setFloorFrom] = useState('1');
  const [floorTo, setFloorTo] = useState('4');
  const [perFloor, setPerFloor] = useState(3);

  // Un par un
  const [reference, setReference] = useState('');
  // Bâtiment choisi parmi ceux qui existent déjà, ou aucun.
  const [building, setBuilding] = useState<string | undefined>();
  const [floor, setFloor] = useState('');
  const [referenceError, setReferenceError] = useState<string | undefined>();

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Les bâtiments et références déjà créés viennent des appartements de la résidence.
  const existing = useMemo(() => existingBuildings(lots.data ?? []), [lots.data]);
  const existingReferences = useMemo(() => (lots.data ?? []).map((lot) => lot.reference), [lots.data]);
  // Tant que l'utilisateur n'a rien touché, l'état de départ suit les appartements chargés :
  // les bâtiments existants ne sont pas cochés, une résidence vide propose « A ».
  const state = choice ?? initialBuildingState(existing);
  const chips = useMemo(() => buildingChips(existing, state), [existing, state]);
  const selectedBuildings = chips.filter((chip) => chip.selected).map((chip) => chip.name);

  const plan = planGeneration({ buildings: selectedBuildings, floorFrom, floorTo, perFloor }, existingReferences);
  const toCreate = plan.issue === undefined ? plan.toCreate : [];
  const skipped = plan.issue === undefined ? plan.skipped : 0;
  const button = createButton(toCreate.length);
  const summary = generationSummary(toCreate.length, skipped);
  const preview = previewCreated(toCreate);

  const busy = createBulk.isPending || createLot.isPending;

  const goBack = () => {
    // Accueil = onglet : `navigate` revient sur les onglets déjà ouverts au lieu d'en empiler un second.
    if (isOnboarding) router.navigate('/home');
    else if (router.canGoBack()) router.back();
    else router.navigate('/home');
  };
  const finish = () => router.replace('/lots');

  const onAddBuilding = () => {
    const result = addBuilding(existing, state, newBuilding);
    if (result.name === undefined) {
      setNewBuildingError(t('lots.building.invalid'));
      return;
    }
    setChoice(result.state);
    setNewBuilding('');
    setNewBuildingError(undefined);
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
    if (busy || plan.issue !== undefined || button.disabled) return;
    setError(undefined);
    try {
      await createBulk.mutateAsync(plan.shape);
      // Retour à la liste : le toast s'y affiche, les compteurs sont déjà rechargés.
      setFlashMessage('lots.toast.created');
      finish();
    } catch (caught) {
      // Tout se fait dans une transaction : rien n'a été créé, les réglages restent affichés.
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
        building,
        floor: floorValue === '' ? undefined : Number(floorValue),
      });
      setToast(t('lots.single.added', { reference: trimmed }));
      // Le brouillon n'est vidé qu'après le succès : la référence est libérée pour la suivante.
      setReference('');
    } catch (caught) {
      setError(errorMessage(caught, [trimmed]));
    }
  };

  const bulkReady = lots.data !== undefined;

  return (
    <Screen
      scroll
      footer={
        mode === 'bulk' ? (
          <Button
            label={t(button.key, button.params)}
            disabled={!bulkReady || plan.issue !== undefined || button.disabled}
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
        !bulkReady ? (
          lots.error ? (
            <ErrorNotice
              errorKey={apiErrorKey(lots.error)}
              onRetry={() => void lots.refetch()}
              retrying={lots.isFetching}
            />
          ) : (
            <Text tone="muted">{t('common.loading')}</Text>
          )
        ) : (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('lots.buildings')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {chips.map((chip) => (
                  <View key={chip.name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Chip
                      label={chip.existing ? `${chip.name} · ${t('lots.building.existing')}` : chip.name}
                      selected={chip.selected}
                      onPress={() => setChoice(toggleBuilding(state, chip.name))}
                    />
                    {chip.removable && (
                      <IconButton
                        icon={X}
                        accessibilityLabel={t('lots.building.remove', { name: chip.name })}
                        onPress={() => setChoice(removeAddedBuilding(existing, state, chip.name))}
                      />
                    )}
                  </View>
                ))}
                <Chip
                  label={`+ ${t('lots.addBuilding')}`}
                  selected={addingBuilding}
                  onPress={() => {
                    setAddingBuilding((open) => !open);
                    setNewBuildingError(undefined);
                  }}
                />
              </View>
              {addingBuilding && (
                <View style={{ gap: spacing.sm }}>
                  <TextField
                    label={t('lots.newBuilding')}
                    helper={t('lots.newBuildingHelper')}
                    value={newBuilding}
                    onChangeText={(text) => {
                      setNewBuilding(text.toUpperCase());
                      setNewBuildingError(undefined);
                    }}
                    onSubmitEditing={onAddBuilding}
                    error={newBuildingError}
                    maxLength={4}
                    ltr
                    autoFocus
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <Button
                    variant="secondary"
                    label={t('lots.building.add')}
                    disabled={newBuilding.trim() === ''}
                    onPress={onAddBuilding}
                  />
                </View>
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

            {plan.issue !== undefined ? (
              <Banner message={t(plan.issue)} />
            ) : (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Text variant="bodyStrong">{t(summary.key, summary.params)}</Text>
                  {preview.shown.length > 0 && (
                    // Les références se lisent toujours de gauche à droite, même en arabe.
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, direction: 'ltr' }}>
                      {preview.shown.map((ref) => (
                        <Badge key={ref} label={ref} />
                      ))}
                      {preview.more > 0 && <Text variant="small" tone="muted">{t('lots.preview.more', { count: preview.more })}</Text>}
                    </View>
                  )}
                  <Text variant="small" tone="muted">
                    {t('lots.preview.hint')}
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )
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
          {existing.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyStrong">{t('lots.single.building')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Chip label={t('lots.single.noBuilding')} selected={building === undefined} onPress={() => setBuilding(undefined)} />
                {existing.map((name) => (
                  <Chip key={name} label={name} selected={building === name} onPress={() => setBuilding(name)} />
                ))}
              </View>
            </View>
          )}
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
