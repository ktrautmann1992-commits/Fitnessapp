import {
  cycleDayAssessment,
  cycleModuleState,
  cycleNutritionHints,
  cycleWarnings,
  dayOfCycle,
  defaultCycleSettings,
  derivePeriods,
  hasAnyValue,
  longGapQuestionDays,
  type CycleDayAssessment,
  type CycleDismissibleCode,
  type CycleEntry,
  type CycleEntryPayload,
  type CycleModuleState,
  type CycleNutritionHint,
  type CycleSettings,
  type CycleWarningCode,
  type DerivedPeriods,
} from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CycleError,
  cycleBackendFor,
  hasActiveCycleConsent,
  onCycleDeviceCleared,
  validCycleConsentGrantedAt,
  type CycleAccess,
  type CycleBackend,
  type CycleSaveResult,
  type CycleSnapshot,
} from '@/data/cycle-backend';
import { cycleContext, type CycleContext } from '@/data/cycle-context';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';

/**
 * Zyklus-Modul in der App (Plan ZY3/ZY4): lädt Zugang, Einstellungen und Einträge über die Zyklus-Schnittstelle und
 * rechnet alles Weitere mit packages/core (Zustand, Warnungen, Angebot, Hinweise). Der zuletzt geladene Stand bleibt
 * nur im Arbeitsspeicher dieses Kontos (nie im unverschlüsselten Gerätespeicher) und wird bei Kontowechsel, Widerruf
 * und Beenden verworfen. Nie console.* mit Zyklus-Objekten (Strukturtest).
 */
export type CycleLoad =
  | { kind: 'loading' }
  | { kind: 'ready'; access: CycleAccess; snapshot: CycleSnapshot }
  | { kind: 'error' };

let memory: { userId: string; load: Extract<CycleLoad, { kind: 'ready' }> } | null = null;
const listeners = new Set<() => void>();

// Widerruf, Abmelden, Konto löschen, fehlende Einwilligung beim Laden: auch den Arbeitsspeicher-Stand verwerfen.
onCycleDeviceCleared(() => {
  memory = null;
});

/** Zuletzt geladene Einstellungen dieses Kontos (nur Arbeitsspeicher) – z. B. für die Karte auf „Heute“. */
export function peekCycleSettings(userId: string | null): CycleSettings | null | undefined {
  return memory && memory.userId === userId ? memory.load.snapshot.settings : undefined;
}

/** Stand verwerfen und alle offenen Ansichten neu laden (nach Speichern, Widerruf, Abmelden). */
export function forgetCycle(): void {
  memory = null;
  for (const listener of listeners) listener();
}

export interface CycleView {
  readonly cycle: CycleBackend | null;
  readonly load: CycleLoad;
  readonly today: string;
  readonly state: CycleModuleState;
  readonly settings: CycleSettings | null;
  readonly entries: readonly CycleEntry[];
  readonly todayEntry: CycleEntry | null;
  readonly consentGrantedAt: string | null;
  readonly context: CycleContext | null;
  readonly derived: DerivedPeriods | null;
  readonly warnings: readonly CycleWarningCode[];
  readonly assessment: CycleDayAssessment;
  readonly nutritionHints: readonly CycleNutritionHint[];
  readonly longGapDays: number | null;
  readonly dayOfCycle: number | null;
  reload(): Promise<void>;
  /** Speichert den VOLLSTÄNDIGEN Eintrag eines Tages (ohne Angabe → Eintrag löschen). */
  saveEntry(date: string, payload: CycleEntryPayload): Promise<CycleSaveResult | 'empty'>;
  saveSettings(patch: Partial<CycleSettings>): Promise<void>;
  dismiss(code: CycleDismissibleCode): Promise<void>;
}

export function useCycle(): CycleView {
  const app = useApp();
  const today = useToday();
  const userId = app.session?.userId ?? null;
  const cycle = useMemo(() => cycleBackendFor(app.backend), [app.backend]);
  const [load, setLoad] = useState<CycleLoad>(() =>
    memory && memory.userId === userId ? memory.load : { kind: 'loading' },
  );

  const reload = useCallback(async () => {
    if (!cycle || !userId) return;
    try {
      const [access, snapshot] = await Promise.all([cycle.access(), cycle.load(today)]);
      const ready = { kind: 'ready' as const, access, snapshot };
      memory = { userId, load: ready };
      setLoad(ready);
    } catch {
      setLoad((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [cycle, today, userId]);

  useEffect(() => {
    const listener = () => void reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const rows = app.rows;
  const consents = rows?.consents ?? [];
  const consentGrantedAt = validCycleConsentGrantedAt(consents, app.versions.cycle_data);
  const snapshot = load.kind === 'ready' ? load.snapshot : null;
  const settings = snapshot?.settings ?? null;
  const entries = useMemo(() => snapshot?.entries ?? [], [snapshot]);
  const context = useMemo(
    () =>
      rows
        ? cycleContext(
            rows,
            app.answers,
            today,
            app.drafts.map((d) => d.key),
          )
        : null,
    [rows, app.answers, app.drafts, today],
  );
  const state = cycleModuleState({
    sex: app.answers.sex ?? null,
    consentValid: consentGrantedAt !== null,
    consentActive: hasActiveCycleConsent(consents),
    hasData: settings !== null || entries.length > 0,
    settings,
    pregnancyFlag: context?.pregnancyFlag ?? false,
    accessOpen: load.kind === 'ready' ? load.access.open : cycle?.mode === 'local',
  });
  const todayEntry = entries.find((e) => e.date === today) ?? null;
  const derived = useMemo(
    () =>
      derivePeriods(
        entries,
        { noBleedingConfirmedUntil: settings?.noBleedingConfirmedUntil ?? null },
        today,
      ),
    [entries, settings?.noBleedingConfirmedUntil, today],
  );
  const active = state === 'active';
  const warnings =
    active && settings && context
      ? cycleWarnings({
          today,
          status: settings.status,
          ageYears: context.ageYears,
          entries,
          settings,
          fatLossGoal: context.fatLossGoal,
          sessionsPerWeek: context.sessionsPerWeek,
          warningsEnabled: load.kind === 'ready' && load.access.warnings,
        })
      : [];
  const assessment = cycleDayAssessment(todayEntry, entries, {
    planned: context?.planned ?? 'none',
    raceDay: context?.raceDay ?? false,
    moduleActive: active,
  });
  const nutritionHints = active
    ? cycleNutritionHints(todayEntry, entries, app.answers.nutrition?.dietType ?? null, {
        ironDismissedOn: settings?.dismissed.iron,
        heavyBleedingWarning: warnings.includes('W4') || warnings.includes('W4_hormonal'),
      })
    : [];
  const longGapDays =
    active && settings?.status === 'natural'
      ? longGapQuestionDays({
          lastBleedingDay: derived.lastBleedingDay,
          enabledOn: settings.enabledOn,
          noBleedingConfirmedUntil: settings.noBleedingConfirmedUntil,
          today,
        })
      : null;

  const saveEntry = useCallback(
    async (date: string, input: CycleEntryPayload) => {
      if (!cycle) throw new CycleError('unknown');
      if (!consentGrantedAt) throw new CycleError('cycle_consent_missing');
      const payload: CycleEntryPayload = { ...input };
      if (payload.symptoms && Object.keys(payload.symptoms).length === 0) delete payload.symptoms;
      if (!hasAnyValue(payload)) {
        await cycle.deleteEntry(date);
        forgetCycle();
        return 'empty' as const;
      }
      const result = await cycle.saveEntry({ date, payload }, consentGrantedAt, today);
      forgetCycle();
      return result;
    },
    [consentGrantedAt, cycle, today],
  );

  const saveSettings = useCallback(
    async (patch: Partial<CycleSettings>) => {
      if (!cycle) throw new CycleError('unknown');
      if (!consentGrantedAt) throw new CycleError('cycle_consent_missing');
      await cycle.saveSettings(
        { ...(settings ?? defaultCycleSettings()), ...patch },
        consentGrantedAt,
      );
      forgetCycle();
    },
    [consentGrantedAt, cycle, settings],
  );

  const dismiss = useCallback(
    (code: CycleDismissibleCode) =>
      saveSettings({ dismissed: { ...(settings?.dismissed ?? {}), [code]: today } }),
    [saveSettings, settings?.dismissed, today],
  );

  return {
    cycle,
    load,
    today,
    state,
    settings,
    entries,
    todayEntry,
    consentGrantedAt,
    context,
    derived,
    warnings,
    assessment,
    nutritionHints,
    longGapDays,
    dayOfCycle: active ? dayOfCycle(derived.lastPeriodStart, today) : null,
    reload,
    saveEntry,
    saveSettings,
    dismiss,
  };
}
