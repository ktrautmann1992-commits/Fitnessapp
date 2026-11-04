import {
  type StoryCard,
  type StoryStat,
  STORY_CARD,
  sketchPath,
  sketchPoints,
} from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';

import { t } from '@/i18n';

import { formatDateDe } from './format';

/**
 * Aufbau des Story-Bilds (Etappe E6, EA-4: nur Linie auf Alpha5-Hintergrund, keine Kartenkacheln) in Bild-Pixeln
 * (1080 × 1920). Dieselbe Rechnung für die Vorschau/Aufnahme in der App (react-native-view-shot) und das Canvas im
 * Browser – beide zeigen genau den Inhalt der Positivliste aus packages/core. Rein.
 *
 * Gestaltung (04.11.2026): Farbverlauf mit Leuchtpunkt hinter der Strecke, Ringe oben rechts, große Hauptzahl
 * (Distanz, bei Kraft Volumen bzw. Zeit), leuchtende Strecke mit Start-/Zielpunkt und Werte-Kacheln.
 */

export const STORY_W = STORY_CARD.widthPx;
export const STORY_H = STORY_CARD.heightPx;
export const STORY_PAD = 80;

/** Farben des Bilds (aus den Marken-Farben). */
export const STORY_COLORS = {
  bgTop: brandColors.schwarz,
  bgBottom: '#0B1A4A',
  glow: brandColors.blau,
  ring: brandColors.weiss,
  lineFrom: brandColors.himmel,
  lineTo: brandColors.blau,
  start: brandColors.weiss,
  end: brandColors.signal,
  tile: brandColors.graphit,
  tileBorder: brandColors.graphitHell,
  strong: brandColors.weiss,
  muted: brandColors.grauDunkel,
  accent: brandColors.himmel,
} as const;

export type StoryTone = 'strong' | 'muted' | 'accent';

export interface StoryText {
  readonly text: string;
  readonly x: number;
  /** Grundlinie. */
  readonly y: number;
  readonly size: number;
  readonly bold: boolean;
  readonly tone: StoryTone;
  /** `right`: x ist der rechte Rand. */
  readonly align: 'left' | 'right';
  /** In Großbuchstaben zeigen (nur Darstellung, der Text bleibt unverändert). */
  readonly upper: boolean;
  /** Höchstbreite (Text wird darin gehalten). */
  readonly maxWidth: number;
}

export interface StoryBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface StoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface StoryLayout {
  readonly logo: { x: number; y: number; width: number };
  readonly texts: readonly StoryText[];
  /** SVG-Pfad der Linie in Bild-Pixeln ('' = keine). */
  readonly linePath: string;
  readonly lineBox: { x: number; y: number; width: number; height: number };
  readonly lineStart: StoryPoint | null;
  readonly lineEnd: StoryPoint | null;
  /** Leuchtpunkt hinter Strecke bzw. Übungen. */
  readonly glow: { x: number; y: number; r: number };
  /** Ringe oben rechts (Mittelpunkt + Radien). */
  readonly rings: { x: number; y: number; radii: readonly number[] };
  /** Werte-Kacheln (gleiche Reihenfolge wie die Werte). */
  readonly tiles: readonly StoryBox[];
}

/** Breite und Strichstärken der Strecke (innen nach außen: Linie, Leuchten). */
export const STORY_LINE = {
  width: 14,
  glow: [
    { width: 64, opacity: 0.12 },
    { width: 34, opacity: 0.22 },
  ],
} as const;

/** „#RRGGBB“ + Deckkraft → „rgba(…)“ (Canvas). */
export function hexAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const S = t.endurance.story;
const INNER = STORY_W - 2 * STORY_PAD;

function text(
  partial: Partial<StoryText> & Pick<StoryText, 'text' | 'x' | 'y' | 'size'>,
): StoryText {
  return {
    bold: false,
    tone: 'strong',
    align: 'left',
    upper: false,
    maxWidth: STORY_W - partial.x - 40,
    ...partial,
  };
}

/** „5,48 km“ → Zahl „5,48“ + Einheit „km“; „30:30“ bleibt ohne Einheit. */
export function splitValue(value: string): { number: string; unit: string } {
  const m = /^(.*\d)\s+([^\d\s]+)$/.exec(value);
  return m ? { number: m[1] ?? value, unit: m[2] ?? '' } : { number: value, unit: '' };
}

/** Grob geschätzte Breite fetter Zahlen der App-Schrift (Ziffern breit, Satzzeichen schmal). */
export function estimateWidth(value: string, size: number): number {
  let em = 0;
  for (const ch of value) em += /[0-9]/.test(ch) ? 0.64 : /[.,:\s]/.test(ch) ? 0.3 : 0.62;
  return em * size;
}

/** Hauptzahl: Distanz (Ausdauer) bzw. Volumen, sonst Zeit. */
function heroStat(card: StoryCard): StoryStat | undefined {
  const order = card.kind === 'endurance' ? ['distance', 'duration'] : ['volume', 'duration'];
  for (const key of order) {
    const stat = card.stats.find((s) => s.key === key);
    if (stat) return stat;
  }
  return card.stats[0];
}

export function storyLayout(card: StoryCard): StoryLayout {
  const texts: StoryText[] = [];
  const title =
    card.kind === 'endurance'
      ? card.eBike
        ? t.endurance.eBike.noun
        : card.walkKind
          ? t.endurance.hiking.nouns[card.walkKind]
          : t.endurance.sportNouns[card.sport]
      : card.title;
  // Titel immer zuerst (Tests lesen texts[0]).
  texts.push(
    text({ text: title, x: STORY_PAD, y: 400, size: 54, bold: true, tone: 'accent', upper: true }),
  );
  if (card.date) {
    texts.push(
      text({
        text: formatDateDe(card.date),
        x: STORY_W - STORY_PAD,
        y: 190,
        size: 40,
        tone: 'muted',
        align: 'right',
        maxWidth: 400,
      }),
    );
  }

  const hero = heroStat(card);
  if (hero) {
    const { number, unit } = splitValue(hero.value);
    texts.push(
      text({ text: number, x: STORY_PAD - 8, y: 640, size: 250, bold: true, maxWidth: INNER + 8 }),
    );
    texts.push(
      text({
        text: unit ? `${unit} · ${S.stats[hero.key]}` : S.stats[hero.key],
        x: STORY_PAD,
        y: 760,
        size: 44,
        tone: 'muted',
        upper: true,
      }),
    );
  }
  const rest = card.stats.filter((s) => s !== hero);
  const rows = Math.ceil(rest.length / 2);
  const tileH = 196;
  const gap = 24;
  const tilesTop = 1780 - rows * tileH - Math.max(0, rows - 1) * gap;

  const lineBox = {
    x: STORY_PAD,
    y: 820,
    width: INNER,
    height: Math.max(360, tilesTop - 60 - 820),
  };
  let linePath = '';
  let lineStart: StoryPoint | null = null;
  let lineEnd: StoryPoint | null = null;
  if (card.kind === 'endurance') {
    if (card.line && card.line.length > 1) {
      const projected = sketchPoints(card.line, {
        width: lineBox.width,
        height: lineBox.height,
        padding: 40,
        maxPoints: 800,
      }).map((p) => ({ x: p.x + lineBox.x, y: p.y + lineBox.y }));
      linePath = sketchPath(projected);
      lineStart = projected[0] ?? null;
      lineEnd = projected[projected.length - 1] ?? null;
    } else if (card.lineState === 'too_short') {
      texts.push(
        text({
          text: S.lineTooShort,
          x: STORY_PAD,
          y: lineBox.y + lineBox.height / 2,
          size: 40,
          tone: 'muted',
        }),
      );
    }
  } else {
    card.exerciseNames.forEach((name, i) => {
      texts.push(text({ text: name, x: STORY_PAD, y: 860 + i * 84, size: 50 }));
    });
    if (card.moreExercises > 0) {
      texts.push(
        text({
          text: S.moreExercises(card.moreExercises),
          x: STORY_PAD,
          y: 860 + card.exerciseNames.length * 84,
          size: 42,
          tone: 'muted',
        }),
      );
    }
  }

  const tileW = (INNER - gap) / 2;
  const tiles: StoryBox[] = [];
  rest.forEach((stat, i) => {
    const single = rest.length % 2 === 1 && i === rest.length - 1;
    const x = STORY_PAD + (i % 2) * (tileW + gap);
    const y = tilesTop + Math.floor(i / 2) * (tileH + gap);
    const width = single ? INNER : tileW;
    tiles.push({ x, y, width, height: tileH, radius: 36 });
    const { number, unit } = splitValue(stat.value);
    const inner = width - 80;
    texts.push(
      text({
        text: S.stats[stat.key],
        x: x + 40,
        y: y + 64,
        size: 34,
        tone: 'muted',
        upper: true,
        maxWidth: inner,
      }),
    );
    texts.push(
      text({
        text: number,
        x: x + 40,
        y: y + 150,
        size: 70,
        bold: true,
        maxWidth: unit ? inner - 150 : inner,
      }),
    );
    if (unit) {
      // Einheit direkt hinter der Zahl (geschätzte Breite, eher etwas zu breit als überlappend).
      const after = Math.min(estimateWidth(number, 70), inner - 150);
      texts.push(
        text({
          text: unit,
          x: x + 40 + after + 16,
          y: y + 150,
          size: 36,
          tone: 'accent',
          bold: true,
          maxWidth: 150,
        }),
      );
    }
  });

  texts.push(
    text({
      text: S.footer,
      x: STORY_W - STORY_PAD,
      y: 1862,
      size: 30,
      tone: 'muted',
      align: 'right',
      maxWidth: 600,
    }),
  );

  return {
    logo: { x: STORY_PAD, y: 110, width: 180 },
    texts,
    linePath,
    lineBox,
    lineStart,
    lineEnd,
    glow: { x: STORY_W * 0.55, y: lineBox.y + lineBox.height / 2, r: 620 },
    rings: { x: STORY_W + 40, y: -40, radii: [260, 380, 500] },
    tiles,
  };
}
