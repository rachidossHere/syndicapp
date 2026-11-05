// Écran de démonstration du design system (plan 02, étape 6), réservé au développement.
// Il présente chaque jeton et chaque composant de @syndic/ui, en français et en arabe.
import {
  ActionTile,
  Amount,
  Avatar,
  Badge,
  Button,
  Card,
  colors as colorTokens,
  EmptyState,
  ListItem,
  radius as radiusTokens,
  Screen,
  spacing as spacingTokens,
  StatusBadge,
  statuses,
  statusTones,
  TabBar,
  Text,
  TextField,
  Toast,
  typography as typographyTokens,
  useTheme,
  type BusinessStatus,
  type ColorToken,
  type TypographyToken,
} from '@syndic/ui';
import Banknote from 'lucide-react-native/icons/banknote';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import House from 'lucide-react-native/icons/house';
import Inbox from 'lucide-react-native/icons/inbox';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Plus from 'lucide-react-native/icons/plus';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Save from 'lucide-react-native/icons/save';
import Wrench from 'lucide-react-native/icons/wrench';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';

import { designSystemCopy } from './design-system-copy';

/** Durée d'affichage de la confirmation de démonstration, en millisecondes. */
const TOAST_DURATION_MS = 3000;

type TabKey = 'home' | 'accounts' | 'report' | 'news';

export function DesignSystemScreen() {
  const { language, spacing } = useTheme();
  const t = designSystemCopy[language];
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [toastVisible, setToastVisible] = useState(false);
  const [filledValue, setFilledValue] = useState<string>(t.filled);

  useEffect(() => {
    setFilledValue(t.filled);
  }, [t.filled]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  return (
    <Screen scroll>
      <LanguageToggle />

      <Section title={t.colors}>
        <View style={{ gap: spacing.sm }}>
          {(Object.keys(colorTokens) as ColorToken[]).map((token) => (
            <ColorSwatch key={token} token={token} />
          ))}
        </View>
      </Section>

      <Section title={t.typography}>
        {(Object.keys(typographyTokens) as TypographyToken[]).map((variant) => (
          <View key={variant} style={{ gap: spacing.xs }}>
            <Text variant="caption" tone="muted">
              {`${variant} · ${typographyTokens[variant].fontSize}/${typographyTokens[variant].lineHeight} · ${typographyTokens[variant].fontWeight}`}
            </Text>
            <Text variant={variant}>{t.typeSample}</Text>
          </View>
        ))}
      </Section>

      <Section title={t.spacingRadius}>
        {(Object.keys(spacingTokens) as (keyof typeof spacingTokens)[]).map((token) => (
          <View key={token} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="small" tone="muted" style={{ minWidth: spacing.xxxl }}>
              {token}
            </Text>
            <TokenBar width={spacingTokens[token]} />
            <Text variant="small">{`${spacingTokens[token]} px`}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {(Object.keys(radiusTokens) as (keyof typeof radiusTokens)[]).map((token) => (
            <RadiusSample key={token} token={token} />
          ))}
        </View>
      </Section>

      <Section title={t.buttons}>
        <Button variant="accent" size="lg" label={t.payNow} onPress={() => setToastVisible(true)} />
        <Button label={t.save} icon={Save} onPress={() => setToastVisible(true)} />
        <Button variant="secondary" label={t.cancel} onPress={() => undefined} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button variant="ghost" label={t.details} onPress={() => undefined} style={{ flex: 1 }} />
          <Button label={t.disabled} disabled style={{ flex: 1 }} />
        </View>
        <Button label={t.sending} loading />
      </Section>

      <Section title={t.fields}>
        <TextField label={t.whatFor} placeholder={t.whatForPlaceholder} helper={t.whatForHelper} />
        <TextField label={t.whatFor} value={filledValue} onChangeText={setFilledValue} />
        <TextField
          label={t.howMuch}
          placeholder={t.howMuchPlaceholder}
          keyboardType="number-pad"
          error={t.howMuchError}
        />
      </Section>

      <Section title={t.badges}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(Object.keys(statuses) as BusinessStatus[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          {statusTones.map((tone) => (
            <Badge key={tone} tone={tone} label={tone === 'info' ? t.info : tone} />
          ))}
        </View>
      </Section>

      <Section title={t.amounts}>
        {[0, 45000, 1842000, 125000000].map((centimes) => (
          <View key={centimes} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
            <Amount centimes={centimes} />
            <Amount centimes={centimes} direction="in" />
            <Amount centimes={centimes} direction="out" />
          </View>
        ))}
      </Section>

      <Section title={t.endToEnd}>
        <Card>
          <Text variant="small" tone="muted">
            {t.quarterCharges}
          </Text>
          <Amount centimes={45000} variant="display" />
          <Text variant="small" tone="muted">
            {t.dueBefore}
          </Text>
          <Button variant="accent" label={t.payNow} onPress={() => setToastVisible(true)} />
        </Card>
        <ListItem
          title={t.reportTitle}
          subtitle={t.reportDate}
          trailing={<StatusBadge status="in_progress" />}
          onPress={() => undefined}
        />
      </Section>

      <Section title={t.list}>
        <ListItem
          title={t.person}
          subtitle={t.personRole}
          leading={<Avatar name={t.person} />}
          trailing={<StatusBadge status="paid" />}
        />
        <ListItem
          title={t.expense}
          subtitle={t.expenseDate}
          trailing={<Amount centimes={60000} direction="out" />}
          onPress={() => undefined}
        />
      </Section>

      <Section title={t.tiles}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <ActionTile label={t.collect} icon={Banknote} onPress={() => setToastVisible(true)} style={{ flex: 1 }} />
          <ActionTile
            label={t.addExpense}
            icon={ReceiptText}
            tone="danger"
            onPress={() => setToastVisible(true)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title={t.feedback}>
        <Button variant="secondary" label={t.showToast} onPress={() => setToastVisible(true)} />
        {toastVisible && <Toast message={t.toast} />}
        <Card>
          <EmptyState
            icon={Inbox}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={<Button variant="secondary" icon={Plus} label={t.emptyAction} onPress={() => undefined} />}
          />
        </Card>
      </Section>

      <Section title={t.tabBar}>
        <TabBar<TabKey>
          safeAreaBottom={false}
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'home', label: t.tabHome, icon: House },
            { key: 'accounts', label: t.tabAccounts, icon: ChartColumn },
            { key: 'report', label: t.tabReport, icon: Wrench },
            { key: 'news', label: t.tabNews, icon: Megaphone },
          ]}
        />
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { layout } = useTheme();
  return (
    <View style={{ gap: layout.listGap }}>
      <Text variant="h3">{title}</Text>
      {children}
    </View>
  );
}

function ColorSwatch({ token }: { token: ColorToken }) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View
        style={{
          width: sizes.iconBox,
          height: sizes.iconBox,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          borderWidth: borderWidth.thin,
          borderColor: colors.border,
          backgroundColor: colors[token],
        }}
      />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {token}
      </Text>
      <Text variant="small" tone="muted" selectable>
        {colors[token]}
      </Text>
    </View>
  );
}

function TokenBar({ width }: { width: number }) {
  const { colors, spacing, radius } = useTheme();
  return <View style={{ width, height: spacing.md, borderRadius: radius.sm, backgroundColor: colors.primary }} />;
}

function RadiusSample({ token }: { token: keyof typeof radiusTokens }) {
  const { colors, radius, spacing, sizes, borderWidth } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          width: sizes.iconBox,
          height: sizes.iconBox,
          borderRadius: radius[token],
          borderCurve: token === 'pill' ? undefined : 'continuous',
          borderWidth: borderWidth.thin,
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
        }}
      />
      <Text variant="caption" tone="muted">{`${token} ${radius[token]}`}</Text>
    </View>
  );
}
