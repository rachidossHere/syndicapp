// Écran 6 de docs/charges.png : détail d'un reçu (numéro, résidence, appartement, période, montant,
// mode, date, encaisseur désigné par son rôle), « Ouvrir le PDF » et « Partager ».
// Un reçu annulé affiche « Annulé » (badge et bandeau). Accès : copropriétaire du lot, syndic,
// trésorier (l'API vérifie ; les autres rôles sont renvoyés à l'accueil sans requête).
import { can, type Role } from '@syndic/shared';
import { Amount, Banner, Button, Card, Screen, StatusBadge, Text, useTheme } from '@syndic/ui';
import { Redirect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Download from 'lucide-react-native/icons/download';
import Share2 from 'lucide-react-native/icons/share-2';
import { useState, type ReactNode } from 'react';
import { Share, View } from 'react-native';

import { AuthHeader } from '@/features/auth/auth-header';
import { fetchReceiptUrl, useReceipt } from '@/hooks/use-charges';
import { useRefreshOnFocus } from '@/hooks/use-refresh-on-focus';
import { useActiveResidence } from '@/hooks/use-residences';
import { useT } from '@/i18n/use-t';
import { apiErrorKey } from '@/lib/api-errors';

import { QueryFallback } from './query-fallback';
import { useChargeFormat } from './use-charge-format';

const RECORDED_BY = {
  manager: 'receipt.byManager',
  treasurer: 'receipt.byTreasurer',
} as const;

const canSeeReceipts = (role: Role) => role === 'owner' || can(role, 'payments.write');

function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  const { colors, spacing, borderWidth } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingVertical: spacing.md,
        },
        !last && { borderBottomWidth: borderWidth.thin, borderBottomColor: colors.border },
      ]}>
      <Text tone="muted">{label}</Text>
      {children}
    </View>
  );
}

export function ReceiptScreen({ receiptId }: { receiptId: string }) {
  const { spacing } = useTheme();
  const t = useT();
  const router = useRouter();
  const format = useChargeFormat();
  const { active, query: residencesQuery } = useActiveResidence();
  const allowed = active !== null && canSeeReceipts(active.role);
  const receipt = useReceipt(allowed ? active.id : undefined, receiptId);
  useRefreshOnFocus(receipt.refetch);
  const [busy, setBusy] = useState<'open' | 'share' | undefined>();
  const [error, setError] = useState<string | undefined>();

  if (residencesQuery.data !== undefined && !allowed) return <Redirect href="/home" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  // L'URL signée (5 minutes) est redemandée à chaque action : jamais conservée.
  const withUrl = async (action: 'open' | 'share', use: (url: string) => Promise<unknown>) => {
    if (busy !== undefined) return;
    setBusy(action);
    setError(undefined);
    try {
      await use(await fetchReceiptUrl(receiptId));
    } catch (caught) {
      setError(t(apiErrorKey(caught)));
    } finally {
      setBusy(undefined);
    }
  };

  const data = receipt.data;
  const recordedBy = (role: Role | null) =>
    t(role === 'manager' || role === 'treasurer' ? RECORDED_BY[role] : 'receipt.byOther');

  let body;
  if (data === undefined) {
    body = <QueryFallback query={receipt} message={t('receipt.loadError')} />;
  } else {
    const cancelled = data.cancelledAt !== null;
    body = (
      <>
        {cancelled && (
          <Banner message={t('receipt.cancelledBanner', { date: format.instant(data.cancelledAt ?? '', 'long') })} />
        )}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <Text variant="h3">{t('welcome.appName')}</Text>
            <StatusBadge status={cancelled ? 'cancelled' : 'paid'} />
          </View>
          <Row label={t('receipt.residence')}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
              {data.residenceName}
            </Text>
          </Row>
          <Row label={t('receipt.lot')}>
            {/* Référence d'appartement toujours de gauche à droite, même en arabe. */}
            <Text variant="bodyStrong" style={{ writingDirection: 'ltr' }}>
              {data.lotReference}
            </Text>
          </Row>
          <Row label={t('receipt.period')}>
            <Text variant="bodyStrong">{format.period(data.periodLabel)}</Text>
          </Row>
          <Row label={t('receipt.amount')}>
            <Amount centimes={data.amount} />
          </Row>
          <Row label={t('receipt.method')}>
            <Text variant="bodyStrong">{format.method(data.method)}</Text>
          </Row>
          <Row label={t('receipt.date')}>
            <Text variant="bodyStrong">{format.instant(data.paidAt, 'long')}</Text>
          </Row>
          <Row label={t('receipt.recordedBy')} last>
            <Text variant="bodyStrong">{recordedBy(data.recordedByRole)}</Text>
          </Row>
        </Card>
        <Text variant="small" tone="muted" style={{ textAlign: 'center' }}>
          {t('receipt.footer')}
        </Text>
        {receipt.error && <Banner message={t('receipt.loadError')} />}
        {error !== undefined && <Banner message={error} />}
      </>
    );
  }

  return (
    <Screen
      scroll
      onRefresh={() => void receipt.refetch()}
      refreshing={receipt.isRefetching}
      footer={
        data !== undefined ? (
          <>
            <Button
              icon={Download}
              label={t('receipt.open')}
              loading={busy === 'open'}
              onPress={() => void withUrl('open', (url) => WebBrowser.openBrowserAsync(url))}
            />
            <Button
              variant="secondary"
              icon={Share2}
              label={t('receipt.share')}
              loading={busy === 'share'}
              onPress={() =>
                void withUrl('share', (url) =>
                  Share.share({ message: t('receipt.shareMessage', { number: data.number, url }) }),
                )
              }
            />
          </>
        ) : undefined
      }>
      <AuthHeader onBack={goBack} />
      <Text variant="h2" selectable>
        {data !== undefined ? t('receipt.title', { number: data.number }) : t('common.loading')}
      </Text>
      {body}
    </Screen>
  );
}
