import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { MIN_TOUCH } from '@/components/ui';
import { deviceStore } from '@/data/create-backend';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import { t } from '@/i18n';
import { useMinTouch } from '@/lib/accessibility';
import { appFont } from '@/lib/fonts';
import { useThemeColors } from '@/lib/theme';

/**
 * „Fahrrad | E-Bike“ (Gründer-Wunsch 23.10.2026): Auswahl nur beim Rad – beim Aufzeichnen, Speichern, Eintragen ohne
 * GPS, Nachtragen und Bearbeiten. Standard Fahrrad; die zuletzt genutzte Wahl merkt sich DIESES Gerät je Konto (keine
 * Gesundheitsdaten, nur ein Wahrheitswert). Die Sportart bleibt „Rad“; kcal-Schätzung und Summen rechnet
 * packages/core (TRAINING_MET.eBike, enduranceTotals „davon E-Bike“).
 */

const B = t.endurance.eBike;

/** Gemerkte Wahl je Konto auf diesem Gerät: { [userId]: true = E-Bike }. */
type StoredChoice = Record<string, boolean>;

export function parseBikeChoice(raw: unknown, userId: string): boolean | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[userId];
  return typeof value === 'boolean' ? value : null;
}

/** Zuletzt gewählt (null = noch nie gewählt bzw. noch nicht geladen → Fahrrad) und Speichern der neuen Wahl. */
export function useBikeChoice(userId: string | null): {
  readonly loaded: boolean;
  readonly eBike: boolean | null;
  readonly remember: (eBike: boolean) => void;
} {
  const [state, setState] = useState<{ loaded: boolean; eBike: boolean | null }>({
    loaded: false,
    eBike: null,
  });
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    readJson<StoredChoice>(deviceStore, STORAGE_KEYS.bikeChoice)
      .catch(() => null)
      .then((stored) => {
        if (alive) setState({ loaded: true, eBike: parseBikeChoice(stored, userId) });
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  const remember = useCallback(
    (eBike: boolean) => {
      setState({ loaded: true, eBike });
      if (!userId) return;
      void readJson<StoredChoice>(deviceStore, STORAGE_KEYS.bikeChoice)
        .catch(() => null)
        .then((stored) =>
          writeJson(deviceStore, STORAGE_KEYS.bikeChoice, {
            ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}),
            [userId]: eBike,
          }),
        )
        .catch(() => undefined);
    },
    [userId],
  );
  return { loaded: state.loaded, eBike: state.eBike, remember };
}

/** Strich-Icon Fahrrad bzw. Fahrrad mit Blitz (Deko, die Bedeutung steht im Text daneben). */
function BikeIcon({ electric, color }: { electric: boolean; color: string }) {
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Circle cx={5.5} cy={17} r={3.5} {...stroke} />
        <Circle cx={18.5} cy={17} r={3.5} {...stroke} />
        <Path d="M5.5 17 9 9h6l3.5 8M9 9l3 8h-6.5M15 9l-1.5-3H11" {...stroke} />
        {electric ? <Path d="M20 2.5 17.5 6.5h3L18 10.5" {...stroke} /> : null}
      </Svg>
    </View>
  );
}

/** Segment „Fahrrad | E-Bike“ (Radiogruppe, Tippflächen ≥ 48 px, hell und dunkel). */
export function BikeTypeChoice({
  eBike,
  onChange,
  testID = 'bike-type',
}: {
  eBike: boolean;
  onChange: (eBike: boolean) => void;
  testID?: string;
}) {
  const theme = useThemeColors();
  const minTouch = useMinTouch();
  const options = [
    { value: false, label: B.bike, id: 'bike' },
    { value: true, label: B.eBike, id: 'ebike' },
  ] as const;
  return (
    <View style={styles.field} testID={testID}>
      <Text style={[styles.label, appFont('semibold'), { color: theme.text }]}>{B.label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={B.label}>
        {options.map((option) => {
          const selected = eBike === option.value;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onChange(option.value)}
              testID={`${testID}-${option.id}`}
              style={({ pressed }) => [
                styles.segment,
                minTouch > MIN_TOUCH && { minHeight: minTouch },
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? theme.primary : theme.border,
                  borderWidth: selected ? 3 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <BikeIcon electric={option.value} color={theme.text} />
              <Text
                style={[
                  styles.segmentText,
                  appFont(selected ? 'bold' : 'semibold'),
                  { color: theme.text },
                ]}
              >
                {selected ? `✓ ${option.label}` : option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, appFont('regular'), { color: theme.textMuted }]}>{B.hint}</Text>
    </View>
  );
}

/** Kleines Abzeichen „E-Bike“ (Detail, Liste). */
export function EBikeBadge({ testID = 'e-bike-badge' }: { testID?: string }) {
  const theme = useThemeColors();
  return (
    <View
      style={[styles.badge, { borderColor: theme.border, backgroundColor: theme.surface }]}
      testID={testID}
    >
      <BikeIcon electric color={theme.text} />
      <Text style={[styles.badgeText, appFont('semibold'), { color: theme.text }]}>{B.badge}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  row: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  segmentText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.sm, lineHeight: 20 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
