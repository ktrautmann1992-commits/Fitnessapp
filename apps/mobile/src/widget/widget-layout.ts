import type { WidgetView } from '@fitnessapp/core';
import { areaColors, brandColors, colors, heroColors } from '@fitnessapp/ui';

import { deWidget as T } from '@/i18n/de-widget';

/**
 * Aussehen des Widgets (docs/PLAN-WIDGET.md 4) als reines Datenmodell – unabhängig von der Widget-Bibliothek, damit
 * es ohne Handy prüfbar ist (Tests, Vorschau-Bild). `today-widget.android.tsx` setzt es mit react-native-android-widget
 * um. Farben NUR aus packages/ui: Training = Bereich „training“ (Blau, Verlauf wie die Hero-Karte), Schritte = Bereich
 * „ausdauer“ (Orange, wie die Kachel „Schritte“), kcal = Bereich „ernaehrung“ (Grün, wie die Kachel „Ernährung“).
 * Rechnet nichts: Werte kommen fertig aus packages/core (`widgetView`).
 */

/** Deep Link beim Antippen: „Heute“ (Reiter Training) bzw. die Einstellungen, solange das Widget aus ist. */
export const WIDGET_URI_TODAY = 'fitnessapp://today';
export const WIDGET_URI_SETTINGS = 'fitnessapp://settings';

/** Ab dieser Breite (dp) die mittlere Größe (4 × 2) mit eigenen Kacheln für Schritte und kcal. */
export const WIDGET_MEDIUM_MIN_WIDTH_DP = 250;

export type WidgetScheme = 'light' | 'dark';
export type WidgetSize = 'small' | 'medium';

/** Farbe als „#RRGGBB“ (so verlangt es die Widget-Bibliothek). */
export type HexColor = `#${string}`;

export interface WidgetPalette {
  background: HexColor;
  text: HexColor;
  muted: HexColor;
  trainingFrom: HexColor;
  trainingTo: HexColor;
  trainingText: HexColor;
  trainingMuted: HexColor;
  stepsSurface: HexColor;
  stepsStrong: HexColor;
  stepsTrack: HexColor;
  stepsText: HexColor;
  success: HexColor;
  kcalSurface: HexColor;
  kcalText: HexColor;
  over: HexColor;
}

export function widgetPalette(scheme: WidgetScheme): WidgetPalette {
  const base = colors[scheme];
  const area = areaColors[scheme];
  return {
    background: base.surface,
    text: base.text,
    muted: base.textMuted,
    trainingFrom: scheme === 'light' ? brandColors.blau : area.training.strong,
    trainingTo: brandColors.blauDunkel,
    trainingText: heroColors[scheme].text,
    trainingMuted: brandColors.eisblau,
    stepsSurface: area.ausdauer.surface,
    stepsStrong: area.ausdauer.strong,
    stepsTrack: area.ausdauer.soft,
    stepsText: area.ausdauer.icon,
    success: base.success,
    kcalSurface: area.ernaehrung.surface,
    kcalText: area.ernaehrung.icon,
    over: base.danger,
  };
}

export interface WidgetLayout {
  readonly size: WidgetSize;
  readonly palette: WidgetPalette;
  readonly uri: string;
  readonly a11y: string;
  readonly eyebrow: string;
  /** Großer Text im blauen Feld (Trainingsname, „Ruhetag“, „App öffnen …“). */
  readonly title: string;
  /** Kleine Zeile darunter (z. B. „Erledigt ✓“, „Antippen zum Starten“); null = keine. */
  readonly subtitle: string | null;
  readonly steps: {
    readonly value: string;
    readonly caption: string;
    readonly fraction: number;
    readonly reached: boolean;
  } | null;
  readonly kcal: {
    readonly value: string;
    readonly caption: string;
    readonly over: boolean;
  } | null;
  /** Hinweis unten (z. B. „App öffnen zum Aktualisieren“ nach Mitternacht); null = keiner. */
  readonly note: string | null;
}

export function widgetSize(widthDp: number): WidgetSize {
  return widthDp >= WIDGET_MEDIUM_MIN_WIDTH_DP ? 'medium' : 'small';
}

export function widgetLayout(
  view: WidgetView,
  size: WidgetSize,
  scheme: WidgetScheme,
): WidgetLayout {
  const palette = widgetPalette(scheme);
  const common = { size, palette, eyebrow: T.eyebrow, steps: null, kcal: null, note: null };
  if (view.kind === 'off') {
    return {
      ...common,
      uri: WIDGET_URI_SETTINGS,
      a11y: `${T.off}. ${T.offHint}`,
      title: T.off,
      subtitle: T.offHint,
    };
  }
  if (view.kind === 'refresh') {
    return {
      ...common,
      uri: WIDGET_URI_TODAY,
      a11y: T.refresh,
      title: T.refresh,
      subtitle: null,
    };
  }

  const training = view.training;
  const title =
    training.kind === 'session' ? training.name : training.kind === 'rest' ? T.rest : T.noPlan;
  // Klein (2 × 2) ist wenig Platz: nur „Erledigt ✓“, keine Hinweise wie „Antippen zum Starten“.
  const small = size === 'small';
  const subtitle =
    training.kind === 'session'
      ? training.done
        ? T.done
        : small
          ? null
          : T.open
      : training.kind === 'rest' && !small
        ? T.restHint
        : null;
  const steps = view.steps
    ? {
        value: T.stepsValue(view.steps.steps),
        caption: view.steps.reached ? T.stepsReached : T.stepsOf(view.steps.goal),
        fraction: view.steps.fraction,
        reached: view.steps.reached,
      }
    : null;
  const kcal = view.kcal
    ? {
        value: T.kcalValue(view.kcal.value),
        caption: view.kcal.state === 'over' ? T.kcalOver : T.kcalLeft,
        over: view.kcal.state === 'over',
      }
    : null;
  const parts = [
    training.kind === 'session' ? `${title}${training.done ? `, ${T.done}` : ''}` : title,
    ...(view.steps ? [T.a11ySteps(view.steps.steps, view.steps.goal)] : []),
    ...(view.kcal ? [T.a11yKcal(view.kcal.value, view.kcal.state === 'over')] : []),
    ...(view.metricsOutdated ? [T.refresh] : []),
  ];
  return {
    ...common,
    uri: WIDGET_URI_TODAY,
    a11y: T.a11y(parts),
    title,
    subtitle,
    steps,
    kcal,
    note: view.metricsOutdated ? T.refresh : null,
  };
}

/**
 * Ring als SVG (Schritte): Spur + Bogen ab 12 Uhr im Uhrzeigersinn. Ziel erreicht → voller Ring in Erfolgsfarbe.
 */
export function ringSvg(input: {
  readonly fraction: number;
  readonly color: string;
  readonly track: string;
  readonly size: number;
  readonly stroke: number;
}): string {
  const { size, stroke } = input;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = Math.min(1, Math.max(0, Number.isFinite(input.fraction) ? input.fraction : 0));
  const dash = (circumference * fraction).toFixed(2);
  const gap = (circumference - circumference * fraction + 0.01).toFixed(2);
  const arc =
    fraction <= 0
      ? ''
      : `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${input.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash} ${gap}" transform="rotate(-90 ${c} ${c})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${input.track}" stroke-width="${stroke}"/>${arc}</svg>`;
}
