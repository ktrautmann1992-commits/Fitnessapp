import type { IntakeBar, IntakeTone, IntakeZoneResult, SessionAchievement } from '@fitnessapp/core';

import { t } from '../i18n';
import { kmText } from './history-format';
import { formatKcal } from './nutrition-format';

/**
 * Formulierung der Tagesauswertung (Etappe A2): Texte, Bedienhilfen und Balken-Anteile aus den Ergebnissen von
 * `intakeZone()`/`sessionAchievement()` (packages/core). Keine Grenzen, keine Regeln – nur Anzeige. Rein, getestet.
 */

export interface BarSegment {
  readonly tone: IntakeTone;
  /** Anteil der Breite in Prozent (0–100). */
  readonly widthPct: number;
}

export interface IntakeBarView {
  readonly headline: string;
  readonly zoneText: string;
  readonly symbol: string;
  readonly detail: string | null;
  readonly a11y: string;
  readonly tone: IntakeTone;
  readonly segments: readonly BarSegment[];
  /** Füllstand (Ist) in Prozent der Skala. */
  readonly fillPct: number;
  /** Lage der Zielmarke in Prozent der Skala. */
  readonly targetPct: number;
}

const pct = (value: number, max: number) =>
  max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

export function intakeBarView(bar: IntakeBar): IntakeBarView {
  const max = bar.scale.maxKcal;
  const eaten = formatKcal(Math.round(bar.eatenKcal));
  const target = formatKcal(bar.targetKcal);
  const zoneText = t.day.zones[bar.zone];
  const detail = t.day.zoneDetails[bar.zone];
  return {
    headline: t.day.intakeLine(eaten, target),
    zoneText,
    symbol: t.day.zoneSymbols[bar.zone],
    detail: detail === '' ? null : detail,
    a11y: t.day.barA11y(eaten, target, zoneText.charAt(0).toLowerCase() + zoneText.slice(1)),
    tone: bar.tone,
    segments: bar.scale.zones.map((z) => ({
      tone: z.tone,
      widthPct: pct(z.toKcal - z.fromKcal, max),
    })),
    fillPct: pct(bar.eatenKcal, max),
    targetPct: pct(bar.targetKcal, max),
  };
}

/** Zeile ohne Balken (Vorschau, nichts eingetragen, kein Ziel); null bei `hidden` und `bar`. */
export function intakeTextLine(intake: IntakeZoneResult, entryCount: number): string | null {
  switch (intake.kind) {
    case 'future':
      return t.day.targetLine(formatKcal(intake.targetKcal));
    case 'no_entries':
      return entryCount > 0
        ? t.day.noValues
        : `${t.day.noEntries} ${t.day.targetLine(formatKcal(intake.targetKcal))}`;
    case 'no_target':
      return t.day.noTarget;
    default:
      return null;
  }
}

export interface AchievementView {
  readonly levelText: string;
  readonly symbol: string;
  readonly percentText: string | null;
  readonly a11y: string;
  readonly lines: readonly string[];
  readonly hints: readonly string[];
}

/** Erfüllungsgrad einer Einheit („Größtenteils gemacht · 66 %“) und je Übung „3/3 Sätze“. */
export function achievementView(
  name: string,
  achievement: SessionAchievement,
  exerciseNames: readonly string[],
): AchievementView {
  const levelText = t.day.levels[achievement.level];
  const percentText = achievement.percent === null ? null : t.day.percent(achievement.percent);
  const lines: string[] = [];
  if (achievement.endurance) {
    const { minutes, plannedMinutes, distanceM } = achievement.endurance;
    const time = t.day.minutes(minutes, plannedMinutes);
    lines.push(distanceM !== null && distanceM > 0 ? `${time} · ${kmText(distanceM)} km` : time);
  }
  achievement.exercises.forEach((e, index) => {
    const exerciseName = exerciseNames[index] ?? '';
    const value =
      e.status === 'skipped'
        ? t.day.skipped
        : e.targetSets === null
          ? t.day.setsDone(e.doneSets)
          : t.day.sets(e.fulfilledSets, e.targetSets);
    lines.push(exerciseName ? `${exerciseName}: ${value}` : value);
  });
  return {
    levelText,
    symbol: t.day.levelSymbols[achievement.level],
    percentText,
    a11y: t.day.achievementA11y(name, levelText, percentText),
    lines,
    hints: [
      ...(achievement.easyWeek ? [t.day.easyWeek[achievement.easyWeek]] : []),
      ...achievement.hints.map((hint) => t.day.hints[hint]),
    ],
  };
}
