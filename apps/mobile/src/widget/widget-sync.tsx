import { buildWidgetSnapshot, stepWeek, type WidgetSnapshot } from '@fitnessapp/core';
import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { displayedSessionNames } from '@/data/competition';
import { activePlan } from '@/data/training-plan';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { useAppLayout } from '@/state/use-app-layout';
import { useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';
import { useWearables, wearableConsentsValid } from '@/state/use-wearables';

import { refreshHomeWidgets, WIDGET_SUPPORTED } from './widget-bridge';
import { useWidgetPrefs } from './widget-prefs';
import { widgetSnapshotStore } from './widget-store';

/**
 * Schreibt den Stand für das Widget auf dem Startbildschirm (docs/PLAN-WIDGET.md 2.2): beim Öffnen der App, bei jeder
 * Änderung der Daten (z. B. nach dem Smartwatch-Abgleich oder einem Tagebuch-Eintrag), beim Zurückkehren in die App
 * und beim Wechsel in den Hintergrund. Rechnet nichts selbst (packages/core `buildWidgetSnapshot`); die Freigaben sind
 * dieselben wie bei den Kacheln der Übersicht: Schritte nur mit verbundener Uhr und gültigen Einwilligungen, kcal nur
 * mit „Kalorienzahlen anzeigen“ (nicht in Schwangerschaft/Stillzeit, `showNumbers`) und Einwilligung Gesundheitsdaten.
 * Ist das Widget aus (Standard), wird nichts gelesen und ein alter Stand gelöscht. Liegt im Layout der Reiter, damit
 * es läuft, solange die App mit Menüleiste offen ist.
 */
export function WidgetSync() {
  const prefs = useWidgetPrefs();
  useEffect(() => {
    if (!WIDGET_SUPPORTED || !prefs.loaded || prefs.enabled) return;
    // Aus: Stand (samt Schlüssel) löschen und das Widget auf „Widget aus“ stellen.
    void widgetSnapshotStore
      .clear()
      .catch(() => undefined)
      .then(() => refreshHomeWidgets())
      .catch(() => undefined);
  }, [prefs.loaded, prefs.enabled]);
  if (!WIDGET_SUPPORTED || !prefs.loaded || !prefs.enabled) return null;
  return <WidgetSyncActive />;
}

type SnapshotContent = Omit<WidgetSnapshot, 'savedAt'>;

async function writeSnapshot(content: SnapshotContent): Promise<void> {
  const snapshot: WidgetSnapshot = { ...content, savedAt: Date.now() };
  await widgetSnapshotStore.write(JSON.stringify(snapshot));
  await refreshHomeWidgets();
}

function WidgetSyncActive() {
  const app = useApp();
  const today = useToday();
  const rows = app.rows;
  const { stepGoal } = useAppLayout();
  const { state: wearables } = useWearables();
  const nutrition = useNutritionWeek();
  const foodLog = useFoodLogDay(today, nutrition.showNumbers);

  const active = rows ? activePlan(rows) : null;
  const names = useMemo(
    () => (rows ? displayedSessionNames(rows, active, app.safetyRules) : new Map<string, string>()),
    [rows, active, app.safetyRules],
  );
  const metrics = wearables.kind === 'ready' ? wearables.result.rows.dailyMetrics : null;
  const connected = wearables.kind === 'ready' && wearables.result.rows.connection !== null;
  const stepsToday = useMemo(
    () => (metrics ? stepWeek(metrics, today, stepGoal).today : null),
    [metrics, today, stepGoal],
  );
  const week = nutrition.week;
  const targets = week?.kind === 'ready' ? week.targets.days.find((d) => d.date === today) : null;
  const intake =
    foodLog.consentValid && foodLog.intake.kind === 'numbers' ? foodLog.intake.kcal : null;

  const content = useMemo((): SnapshotContent | null => {
    if (!rows) return null;
    const snapshot = buildWidgetSnapshot({
      enabled: true,
      nowMs: 0,
      today,
      sessions: active?.sessions ?? null,
      displayNames: names,
      steps: {
        allowed: connected && wearableConsentsValid(app),
        today: stepsToday,
        goal: stepGoal,
      },
      kcal: {
        showNumbers: nutrition.showNumbers && app.backend.supportsNutrition,
        consentValid: foodLog.consentValid,
        targetKcal: targets?.targetKcal ?? null,
        eatenKcal: intake,
      },
    });
    if (!snapshot) return null;
    // Ohne Zeitstempel: geschrieben wird nur, wenn sich der INHALT ändert.
    const { v, date, days, steps, kcal } = snapshot;
    return { v, date, days, steps, kcal };
  }, [
    rows,
    today,
    active,
    names,
    connected,
    app,
    stepsToday,
    stepGoal,
    nutrition.showNumbers,
    foodLog.consentValid,
    targets,
    intake,
  ]);

  // Bei jeder inhaltlichen Änderung schreiben (nicht bei jedem Neuzeichnen): gleicher Inhalt = gleicher Text.
  const key = content ? JSON.stringify(content) : null;
  const stable = useMemo(() => (key === null ? null : (JSON.parse(key) as SnapshotContent)), [key]);
  const latest = useRef<SnapshotContent | null>(null);
  useEffect(() => {
    latest.current = stable;
    if (stable !== null) void writeSnapshot(stable).catch(() => undefined);
  }, [stable]);

  // Zurück in die App und Wechsel in den Hintergrund: Zeitstempel erneuern (das Widget zeigt sonst nach 24 h
  // „App öffnen zum Aktualisieren“).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if ((state === 'active' || state === 'background') && latest.current) {
        void writeSnapshot(latest.current).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}
