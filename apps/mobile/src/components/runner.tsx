import {
  ageInYears,
  type CadenceStore,
  DEFAULT_PULSE_ZONE_SETTINGS,
  darknessHint,
  durationText,
  type EnduranceActivity,
  HEART_RATE_LIMITS,
  type HeartRateSummaryRow,
  hasValidConsent,
  type LatLngLike,
  pulseZoneRows,
  pulseZonesFor,
  type PulseZoneSettings,
  pulseZoneSettingsSchema,
  zonesForSummary,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Body, Button, Card, Checkbox, Heading, Notice, TextField } from '@/components/ui';
import { ZONE_COLORS } from '@/components/wearables';
import { deviceStore } from '@/data/create-backend';
import { consentRecordsFromRows } from '@/data/mapping';
import {
  loadRatioFromRows,
  racePredictionFromActivities,
  readCadence,
  readPulseZoneSettings,
  restingBpmFromRows,
  writePulseZoneSettings,
} from '@/data/runner';
import { t } from '@/i18n';
import { appFont } from '@/lib/fonts';
import { berlinTodayIso } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { useWearables } from '@/state/use-wearables';

/**
 * Lauf-Paket 2 (docs/PLAN-LAUF-PAKET-2.md): Pulszonen mit Bereichen, Pulszonen-Einstellung, Belastungs-Ampel,
 * Zeitprognose und Dunkelheits-Hinweis. Alle Zahlen kommen aus packages/core; Puls nur mit Einwilligung health_data
 * (die Puls-Zeilen gibt es ohnehin nur mit wearable_data + health_data) und nie auf dem Story-Bild.
 */

const R = t.runner;

/** Pulszonen-Einstellung dieses Kontos auf dem Gerät (lädt asynchron; bis dahin Standard). */
export function usePulseZoneSettings(): {
  settings: PulseZoneSettings;
  save: (next: PulseZoneSettings) => Promise<void>;
} {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const [settings, setSettings] = useState<PulseZoneSettings>(DEFAULT_PULSE_ZONE_SETTINGS);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void readPulseZoneSettings(deviceStore, userId)
      .then((value) => {
        if (alive) setSettings(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId]);
  const save = useCallback(
    async (next: PulseZoneSettings) => {
      if (!userId) return;
      await writePulseZoneSettings(deviceStore, userId, next);
      setSettings(next);
    },
    [userId],
  );
  return { settings, save };
}

/** Kadenz je Uhr-Einheit (nur dieses Gerät). */
export function useRunCadence(): CadenceStore {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const [cadence, setCadence] = useState<CadenceStore>({});
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void readCadence(deviceStore, userId)
      .then((value) => {
        if (alive) setCadence(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId]);
  return cadence;
}

/** Gültige Einwilligung health_data (Pulszonen-Einstellung). */
function useHealthConsent(): boolean {
  const app = useApp();
  if (!app.rows) return false;
  return hasValidConsent(
    consentRecordsFromRows(app.rows.consents),
    'health_data',
    app.versions.health_data,
  );
}

/** Ruhepuls für die Zonen (Uhr vor Körperdaten). */
function useRestingBpm(): number | null {
  const app = useApp();
  const wearables = useWearables();
  const rows = app.rows;
  const wearableRows = wearables.state.kind === 'ready' ? wearables.state.result.rows : null;
  return useMemo(
    () => (rows ? restingBpmFromRows(rows, wearableRows, berlinTodayIso()) : null),
    [rows, wearableRows],
  );
}

// ---------------------------------------------------------------------------------------------------------
// Pulszonen einer Einheit
// ---------------------------------------------------------------------------------------------------------

/**
 * Pulszonen eines Laufs: gestapelter Balken (Farbe + Text), Tabelle „Zone · Bereich · Zeit“, Herkunft der Grenzen
 * (Herzfrequenz-Reserve bzw. % HFmax) und Link zu den Einstellungen. testIDs `hr-zone-bar`/`hr-zone-text` wie vorher.
 */
export function PulseZonesDetail({ summary }: { summary: HeartRateSummaryRow }) {
  const theme = useThemeColors();
  const router = useRouter();
  const { settings } = usePulseZoneSettings();
  const resting = useRestingBpm();
  const zones = zonesForSummary({ hfMaxUsed: summary.hf_max_used, settings, restingBpm: resting });
  const rows = pulseZoneRows(zones, summary.zone_s);
  if (rows.every((r) => r.share === 0)) return null;
  const minutes = (s: number) => Math.round(s / 60);
  const parts = rows
    .filter((r) => minutes(r.seconds) > 0)
    .map((r) => t.wearables.route.zonePart(r.zone, minutes(r.seconds)))
    .join(' · ');
  return (
    <View style={styles.section} testID="hr-zone-bar">
      <Heading level={2}>{R.zones.title}</Heading>
      <View
        style={[styles.stack, { backgroundColor: theme.background }]}
        accessible
        accessibilityLabel={t.wearables.route.zonesA11y(parts)}
      >
        {rows.map((r, i) =>
          r.share > 0 ? (
            <View
              key={r.zone}
              style={{ flexGrow: r.share, flexBasis: 0, backgroundColor: ZONE_COLORS[i] }}
            />
          ) : null,
        )}
      </View>
      <Body muted testID="hr-zone-text">
        {parts}
      </Body>
      <View style={styles.table} testID="pulse-zone-table">
        {[...rows].reverse().map((r) => {
          const range = R.zones.range(r.fromBpm, r.toBpm, r.zone === 5);
          const name = R.zones.names[r.zone - 1] ?? '';
          return (
            <View
              key={r.zone}
              style={[styles.zoneRow, { borderColor: theme.border }]}
              accessible
              accessibilityLabel={R.zones.rowA11y(r.zone, name, range, minutes(r.seconds))}
              testID={`pulse-zone-${r.zone}`}
            >
              <View style={[styles.dot, { backgroundColor: ZONE_COLORS[r.zone - 1] }]} />
              <View style={styles.zoneName}>
                <Text style={[styles.zoneTitle, appFont('bold'), { color: theme.text }]}>
                  {R.zones.zone(r.zone)}
                </Text>
                <Text style={[styles.zoneMeta, appFont('regular'), { color: theme.textMuted }]}>
                  {`${name} · ${range}`}
                </Text>
              </View>
              <Text style={[styles.zoneValue, appFont('bold'), { color: theme.text }]}>
                {R.zones.minutes(minutes(r.seconds))}
              </Text>
            </View>
          );
        })}
      </View>
      <Body muted testID="pulse-zone-note">
        {zones.method === 'reserve' && zones.restingBpm !== null
          ? R.zones.noteReserve(zones.restingBpm, zones.hfMax, zones.hfMaxOwn)
          : R.zones.noteMax(zones.hfMax, zones.hfMaxOwn)}
      </Body>
      <Body muted>{R.zones.caution}</Body>
      <Button
        label={R.zones.adjust}
        variant="link"
        onPress={() => router.push('/smartwatch' as Href)}
        testID="pulse-zone-adjust"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Einstellung (Smartwatch-Seite)
// ---------------------------------------------------------------------------------------------------------

export function PulseZoneSettingsCard() {
  const app = useApp();
  const theme = useThemeColors();
  const consent = useHealthConsent();
  const { settings, save } = usePulseZoneSettings();
  const resting = useRestingBpm();
  const [ownText, setOwnText] = useState<string | null>(null);
  const [useResting, setUseResting] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const birthDate = app.rows?.profile?.birth_date ?? null;
  if (!consent) {
    return (
      <Card>
        <View style={styles.section} testID="pulse-zone-settings">
          <Heading level={2}>{R.zones.settingsTitle}</Heading>
          <Body muted>{R.zones.needsConsent}</Body>
        </View>
      </Card>
    );
  }
  const own = ownText ?? (settings.hfMaxOverride !== null ? String(settings.hfMaxOverride) : '');
  const restingOn = useResting ?? settings.useRestingHr;
  const trimmed = own.trim();
  const parsedOwn = trimmed === '' ? null : Number(trimmed);
  const draft = pulseZoneSettingsSchema.safeParse({
    hfMaxOverride: parsedOwn,
    useRestingHr: restingOn,
  });
  const preview =
    draft.success && birthDate
      ? pulseZonesFor({
          age: ageInYears(birthDate, berlinTodayIso()),
          settings: draft.data,
          restingBpm: resting,
        })
      : null;
  const { min, max } = HEART_RATE_LIMITS.maxOverrideBpm;

  async function submit() {
    setMessage(null);
    if (!draft.success) {
      setError(R.zones.ownMaxInvalid(min, max));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await save(draft.data);
      setOwnText(null);
      setUseResting(null);
      setMessage(R.zones.saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.section} testID="pulse-zone-settings">
        <Heading level={2}>{R.zones.settingsTitle}</Heading>
        <Body muted>{R.zones.settingsIntro}</Body>
        <TextField
          label={R.zones.ownMax}
          hint={R.zones.ownMaxHint}
          value={own}
          onChangeText={(text) => {
            setOwnText(text.replace(/[^0-9]/g, ''));
            setMessage(null);
          }}
          keyboardType="number-pad"
          maxLength={3}
          error={error}
          testID="pulse-zone-own-max"
        />
        <Checkbox
          label={R.zones.useResting}
          checked={restingOn}
          onChange={(value) => {
            setUseResting(value);
            setMessage(null);
          }}
          testID="pulse-zone-use-resting"
        />
        <Body muted testID="pulse-zone-resting">
          {resting !== null ? R.zones.restingKnown(resting) : R.zones.restingUnknown}
        </Body>
        {preview ? (
          <View style={styles.section} testID="pulse-zone-preview">
            <Body muted>{R.zones.preview}</Body>
            {[...pulseZoneRows(preview, [0, 0, 0, 0, 0])].reverse().map((r) => (
              <View key={r.zone} style={styles.previewRow}>
                <View style={[styles.dot, { backgroundColor: ZONE_COLORS[r.zone - 1] }]} />
                <Text style={[styles.zoneMeta, appFont('regular'), { color: theme.text }]}>
                  {`${R.zones.zone(r.zone)} · ${R.zones.names[r.zone - 1] ?? ''} · ${R.zones.range(r.fromBpm, r.toBpm, r.zone === 5)}`}
                </Text>
              </View>
            ))}
            <Body muted>
              {preview.method === 'reserve' && preview.restingBpm !== null
                ? R.zones.noteReserve(preview.restingBpm, preview.hfMax, preview.hfMaxOwn)
                : R.zones.noteMax(preview.hfMax, preview.hfMaxOwn)}
            </Body>
          </View>
        ) : null}
        {message ? (
          <Notice tone="success" testID="pulse-zone-saved">
            {message}
          </Notice>
        ) : null}
        <Button
          label={R.zones.save}
          variant="secondary"
          loading={busy}
          onPress={() => void submit()}
          testID="pulse-zone-save"
        />
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Belastungs-Ampel
// ---------------------------------------------------------------------------------------------------------

export function LoadAmpelCard({ activities }: { activities: readonly EnduranceActivity[] }) {
  const app = useApp();
  const theme = useThemeColors();
  const rows = app.rows;
  const result = useMemo(
    () => (rows ? loadRatioFromRows(rows, activities, berlinTodayIso()) : null),
    [rows, activities],
  );
  if (!result) return null;
  if (result.kind === 'insufficient') {
    return (
      <Card>
        <View style={styles.section} testID="load-ampel">
          <Heading level={2}>{R.load.title}</Heading>
          <Body muted testID="load-ampel-insufficient">
            {R.load.insufficient[result.reason]}
          </Body>
        </View>
      </Card>
    );
  }
  const level = R.load.levels[result.level];
  const color =
    result.level === 'green'
      ? theme.success
      : result.level === 'yellow'
        ? theme.warning
        : theme.danger;
  const text =
    result.level === 'green'
      ? result.low
        ? R.load.text.low
        : R.load.text.green
      : R.load.text[result.level];
  const volume =
    result.volume?.aboveRule === true
      ? R.load.volume(
          Math.round(result.volume.increase * 100),
          result.volume.currentKm.toLocaleString('de-DE'),
          result.volume.previousKm.toLocaleString('de-DE'),
        )
      : null;
  return (
    <Card>
      <View
        style={styles.section}
        testID="load-ampel"
        accessible
        accessibilityLabel={R.load.a11y(level.label, [text, volume].filter(Boolean).join(' '))}
      >
        <Heading level={2}>{R.load.title}</Heading>
        <View style={styles.ampelRow}>
          <View style={[styles.ampelChip, { borderColor: color }]}>
            <Text style={[styles.ampelSymbol, { color }]}>{level.symbol}</Text>
            <Text
              style={[styles.ampelLabel, appFont('bold'), { color }]}
              testID={`load-ampel-${result.level}`}
            >
              {level.label}
            </Text>
          </View>
        </View>
        <Body>{text}</Body>
        {volume ? <Body testID="load-ampel-volume">{volume}</Body> : null}
        <Body muted>
          {R.load.ratio(result.ratio.toLocaleString('de-DE', { minimumFractionDigits: 2 }))}
        </Body>
        <Body muted>{R.load.disclaimer}</Body>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Zeitprognose
// ---------------------------------------------------------------------------------------------------------

export function RacePredictionCard({ activities }: { activities: readonly EnduranceActivity[] }) {
  const theme = useThemeColors();
  const result = useMemo(
    () => racePredictionFromActivities(activities, berlinTodayIso()),
    [activities],
  );
  // Ohne einen einzigen Lauf ab 3 km gar keine Karte (Rad-/Geh-Nutzer sehen nichts Leeres).
  if (result.kind === 'insufficient' && result.efforts === 0) return null;
  return (
    <Card>
      <View style={styles.section} testID="race-prediction">
        <Heading level={2}>{R.race.title}</Heading>
        {result.kind === 'insufficient' ? (
          <Body muted testID="race-prediction-insufficient">
            {R.race.insufficient(result.efforts)}
          </Body>
        ) : (
          <>
            <View style={styles.raceGrid}>
              {result.targets.map((target) => {
                const id = target.kind === 'ok' ? target.prediction.target : target.target;
                const name = R.race.targets[id];
                if (target.kind !== 'ok') {
                  return (
                    <View key={id} style={styles.raceCell} testID={`race-${id}`}>
                      <Text style={[styles.raceName, appFont('bold'), { color: theme.textMuted }]}>
                        {name}
                      </Text>
                      <Text
                        style={[styles.raceRange, appFont('regular'), { color: theme.textMuted }]}
                      >
                        {R.race.tooShort((target.minEffortM / 1000).toLocaleString('de-DE'))}
                      </Text>
                    </View>
                  );
                }
                const p = target.prediction;
                const time = durationText(p.seconds);
                const low = durationText(p.lowS);
                const high = durationText(p.highS);
                return (
                  <View
                    key={id}
                    style={styles.raceCell}
                    accessible
                    accessibilityLabel={R.race.a11y(name, time, low, high)}
                    testID={`race-${id}`}
                  >
                    <Text style={[styles.raceName, appFont('bold'), { color: theme.textMuted }]}>
                      {name}
                    </Text>
                    <Text style={[styles.raceTime, appFont('bold'), { color: theme.text }]}>
                      {R.race.value(time)}
                    </Text>
                    <Text
                      style={[styles.raceRange, appFont('regular'), { color: theme.textMuted }]}
                    >
                      {R.race.range(low, high)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Body muted>{R.race.basedOn(result.efforts)}</Body>
          </>
        )}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Dunkelheit
// ---------------------------------------------------------------------------------------------------------

const timeDe = (ms: number) =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

/**
 * Hinweis „Es wird dunkel“ vor bzw. beim Start einer Einheit draußen. Position grob (in core auf 0,1° gerundet), nie
 * gespeichert oder gesendet. Ohne Position oder bei Helligkeit: nichts.
 */
export function DarknessNotice({
  position,
  basis,
  testID = 'darkness-hint',
}: {
  position: LatLngLike | null;
  /** `current` = Position der laufenden Aufzeichnung, `last` = Start des letzten Laufs. */
  basis: 'current' | 'last';
  testID?: string;
}) {
  // Einmal je Minute neu rechnen (Sonnenuntergang rückt näher).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const hint = darknessHint({ now, position });
  if (!hint) return null;
  const text =
    hint.kind === 'sunset_soon'
      ? R.dark.sunsetSoon(timeDe(hint.sunset), hint.minutes)
      : hint.kind === 'dusk'
        ? R.dark.dusk(timeDe(hint.dusk))
        : hint.kind === 'dawn'
          ? R.dark.dawn(timeDe(hint.sunrise))
          : R.dark.dark(hint.sunrise !== null ? timeDe(hint.sunrise) : null);
  return (
    <Notice
      tone="info"
      icon="moon"
      title={hint.kind === 'dark' ? R.dark.titleDark : R.dark.title}
      testID={testID}
    >
      <Body>{text}</Body>
      <Body>{R.dark.tips}</Body>
      <Body muted>{basis === 'last' ? R.dark.basisLast : R.dark.basis}</Body>
    </Notice>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  stack: { flexDirection: 'row', height: 16, borderRadius: radius.pill, overflow: 'hidden' },
  table: { gap: 0 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 24 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  zoneName: { flex: 1, minWidth: 0 },
  zoneTitle: { fontSize: fontSize.md },
  zoneMeta: { fontSize: fontSize.sm, flexShrink: 1 },
  zoneValue: { fontSize: fontSize.md, fontVariant: ['tabular-nums'] },
  ampelRow: { flexDirection: 'row' },
  ampelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ampelSymbol: { fontSize: fontSize.md },
  ampelLabel: { fontSize: fontSize.md },
  raceGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  raceCell: { width: '50%', paddingRight: spacing.sm, gap: 2 },
  raceName: { fontSize: fontSize.sm },
  raceTime: { fontSize: fontSize.lg, fontVariant: ['tabular-nums'] },
  raceRange: { fontSize: fontSize.sm, fontVariant: ['tabular-nums'] },
});
