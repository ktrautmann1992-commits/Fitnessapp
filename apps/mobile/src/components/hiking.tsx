import {
  activePainEpisodes,
  type AppLocale,
  emergencyNumbersFor,
  HIKING_SAFETY_DE,
  hikingSafetyNotices,
  type HikingSafetyInput,
  WALK_KINDS,
  type WalkKind,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';

import { Body, ChoiceList, Notice } from '@/components/ui';
import { healthScreeningForPlan } from '@/data/training-plan';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { useTrainingModes } from '@/state/use-training-modes';

/**
 * Wandern/Bergwandern (Sportarten Stufe 1 · Etappe W, docs/PLAN-SPORTARTEN-STUFE-1.md 2.2): Auswahl „Gehen | Wandern |
 * Bergwandern“ (wie „Fahrrad | E-Bike“), SAC-Stufe (T1–T3 wählbar, T4+ nur Hinweis) und die Hinweis-Karte. Welche
 * Hinweise gelten, entscheidet packages/core (hikingSafetyNotices); Texte HIKING_SAFETY_DE. Nie blockierend.
 */

const H = t.endurance.hiking;
const S = HIKING_SAFETY_DE;

/** „Gehen | Wandern | Bergwandern“. */
export function WalkKindChoice({
  walkKind,
  onChange,
}: {
  walkKind: WalkKind;
  onChange: (kind: WalkKind) => void;
}) {
  return (
    <ChoiceList<WalkKind>
      label={H.kindLabel}
      options={WALK_KINDS.map((value) => ({ value, label: H.kinds[value] }))}
      value={walkKind}
      onChange={onChange}
      horizontal
    />
  );
}

/** Gewählte SAC-Stufe: 1–3 oder 4 (= „T4 oder schwerer“, wird nicht gespeichert); null = keine Angabe. */
export type SacPick = 1 | 2 | 3 | 4 | null;

export function parseSacParam(raw: unknown): SacPick {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/** SAC-Wanderskala, optional (nur Wandern/Bergwandern). T4+ zeigt sofort den Hinweis, nie eine Sperre. */
export function SacGradeChoice({
  value,
  onChange,
  testID = 'sac-grade',
}: {
  value: SacPick;
  onChange: (value: SacPick) => void;
  testID?: string;
}) {
  type Option = 'none' | '1' | '2' | '3' | '4';
  return (
    <View style={styles.block} testID={testID}>
      <ChoiceList<Option>
        label={S.sac.label}
        options={[
          { value: 'none', label: S.sac.none },
          { value: '1', label: S.sac.grades[1] },
          { value: '2', label: S.sac.grades[2] },
          { value: '3', label: S.sac.grades[3] },
          { value: '4', label: S.sac.outside },
        ]}
        value={value === null ? 'none' : (String(value) as Option)}
        onChange={(v) => onChange(v === 'none' ? null : (Number(v) as SacPick))}
      />
      {value === 4 ? (
        <Notice tone="warning" testID={`${testID}-outside`}>
          {S.notices.sac_outside}
        </Notice>
      ) : null}
    </View>
  );
}

/** Eingaben aus dem Konto: Schon-Modus (aktive Regionen), Gesundheits-Check, Sprache für die Notrufnummern. */
function useHikingContext(): Pick<
  HikingSafetyInput,
  'painRegions' | 'medicalClearance' | 'pregnancy'
> & { locale: AppLocale | null } {
  const app = useApp();
  const modes = useTrainingModes();
  const rows = app.rows;
  const flags = rows ? (healthScreeningForPlan(rows, app.versions)?.flags ?? []) : [];
  const pain = modes.state?.pain ?? [];
  return {
    painRegions: activePainEpisodes(pain, modes.today).map((e) => e.region),
    medicalClearance: flags.includes('medical_clearance_recommended'),
    pregnancy: flags.includes('pregnancy'),
    locale: rows?.profile?.locale ?? null,
  };
}

/** Hinweis-Karte vor dem Start bzw. in der Auswertung; nichts, wenn keine Hinweise gelten. */
export function HikingSafetyCard({
  phase,
  walkKind,
  maxAltitudeM = null,
  elevationLossM = null,
  sacGrade = null,
  testID = 'hiking-safety',
}: {
  phase: 'before' | 'after';
  walkKind: WalkKind | null;
  maxAltitudeM?: number | null;
  elevationLossM?: number | null;
  sacGrade?: number | null;
  testID?: string;
}) {
  const context = useHikingContext();
  const ids = hikingSafetyNotices({
    phase,
    walkKind,
    maxAltitudeM,
    elevationLossM,
    sacGrade,
    painRegions: context.painRegions,
    medicalClearance: context.medicalClearance,
    pregnancy: context.pregnancy,
  });
  if (ids.length === 0) return null;
  return (
    <Notice tone="info" title={S.title[phase]} silent testID={testID}>
      <View style={styles.list}>
        {phase === 'before' ? <Body muted>{S.intro}</Body> : null}
        {ids.map((id) => (
          <View key={id} style={styles.item} testID={`${testID}-${id}`}>
            <Body>{`• ${S.notices[id]}`}</Body>
            {id === 'emergency' ? <EmergencyNumbers locale={context.locale} /> : null}
          </View>
        ))}
      </View>
    </Notice>
  );
}

function EmergencyNumbers({ locale }: { locale: AppLocale | null }) {
  return (
    <View style={styles.numbers} testID="hiking-emergency-numbers">
      {emergencyNumbersFor(locale).map(({ country, numbers }) => (
        <Body key={country}>
          {`${S.emergencyCountries[country]}: ${numbers
            .map((n) => `${n.number} (${S.emergencyKinds[n.kind]})`)
            .join(', ')}`}
        </Body>
      ))}
      <Body muted>{S.emergencyNote}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  list: { gap: spacing.sm },
  item: { gap: spacing.xs },
  numbers: { gap: 2, paddingLeft: spacing.md },
});
