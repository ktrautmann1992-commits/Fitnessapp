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
 * Gestaltung (04.11.2026): drei wählbare Designs (Neon, Topo, Energie) mit Farbverlauf, Leuchtpunkten, Schmuck-
 * Linien, großer Hauptzahl (Distanz, bei Kraft Volumen bzw. Zeit), Strecke mit Start-/Zielpunkt und Werte-Kacheln.
 */

export const STORY_W = STORY_CARD.widthPx;
export const STORY_H = STORY_CARD.heightPx;
export const STORY_PAD = 80;

/** Wählbare Designs des Bilds (04.11.2026): gleicher Inhalt, andere Gestaltung. */
export const STORY_THEMES = ['neon', 'topo', 'energie'] as const;
export type StoryTheme = (typeof STORY_THEMES)[number];

export interface StoryGlow {
  /** Mittelpunkt relativ zur Bildgröße (0–1). */
  readonly fx: number;
  readonly fy: number;
  readonly r: number;
  readonly color: string;
  readonly opacity: number;
}

/** Farben und Schmuck eines Designs (Text-Farben dürfen rgba sein, alles andere #RRGGBB + Deckkraft). */
export interface StoryPalette {
  readonly bg: readonly [string, string];
  readonly glows: readonly StoryGlow[];
  readonly strong: string;
  readonly muted: string;
  readonly accent: string;
  readonly ghost: string;
  readonly lineFrom: string;
  readonly lineTo: string;
  readonly lineGlow: string;
  readonly start: string;
  readonly startRing: string;
  readonly end: string;
  readonly tile: string;
  readonly tileOpacity: number;
  readonly tileBorder: string;
  readonly tileBorderOpacity: number;
  readonly decor: string;
  readonly decorOpacity: number;
  readonly decorWidth: number;
}

export const STORY_PALETTES: Readonly<Record<StoryTheme, StoryPalette>> = {
  // Neon-Nachtlauf: dunkel, leuchtende blaue Strecke, riesige Zahl im Hintergrund, Ringe oben rechts.
  neon: {
    bg: [brandColors.schwarz, '#0B1A4A'],
    glows: [{ fx: 0.55, fy: 0.57, r: 640, color: brandColors.blau, opacity: 0.4 }],
    strong: brandColors.weiss,
    muted: brandColors.grauDunkel,
    accent: brandColors.himmel,
    ghost: 'rgba(141, 176, 255, 0.10)',
    lineFrom: brandColors.himmel,
    lineTo: brandColors.blau,
    lineGlow: brandColors.blau,
    start: brandColors.weiss,
    startRing: brandColors.blau,
    end: brandColors.signal,
    tile: brandColors.graphit,
    tileOpacity: 0.72,
    tileBorder: brandColors.himmel,
    tileBorderOpacity: 0.22,
    decor: brandColors.weiss,
    decorOpacity: 0.07,
    decorWidth: 3,
  },
  // Topografie: Höhenlinien als Muster (keine Karte, kein Ort), weiße Strecke, ruhig und edel.
  topo: {
    bg: ['#0B1A4A', brandColors.schwarz],
    glows: [{ fx: 0.5, fy: 0.55, r: 560, color: brandColors.himmel, opacity: 0.12 }],
    strong: brandColors.weiss,
    muted: 'rgba(227, 235, 255, 0.72)',
    accent: brandColors.himmel,
    ghost: 'rgba(0, 0, 0, 0)',
    lineFrom: brandColors.weiss,
    lineTo: brandColors.eisblau,
    lineGlow: brandColors.himmel,
    start: brandColors.weiss,
    startRing: brandColors.himmel,
    end: brandColors.signal,
    tile: brandColors.schwarz,
    tileOpacity: 0.35,
    tileBorder: brandColors.himmel,
    tileBorderOpacity: 0.35,
    decor: brandColors.himmel,
    decorOpacity: 0.16,
    decorWidth: 2,
  },
  // Energie: kräftiger Verlauf Blau → Violett mit orangem Licht, alles in Weiß.
  energie: {
    bg: [brandColors.blau, '#5B21B6'],
    glows: [
      { fx: 0.95, fy: 0.85, r: 900, color: brandColors.signal, opacity: 0.6 },
      { fx: 0.05, fy: 0.1, r: 700, color: brandColors.himmel, opacity: 0.45 },
    ],
    strong: brandColors.weiss,
    muted: 'rgba(255, 255, 255, 0.8)',
    accent: brandColors.weiss,
    ghost: 'rgba(255, 255, 255, 0.10)',
    lineFrom: brandColors.weiss,
    lineTo: brandColors.weiss,
    lineGlow: brandColors.schwarz,
    start: brandColors.blau,
    startRing: brandColors.weiss,
    end: brandColors.signal,
    tile: brandColors.weiss,
    tileOpacity: 0.16,
    tileBorder: brandColors.weiss,
    tileBorderOpacity: 0.4,
    decor: brandColors.weiss,
    decorOpacity: 0,
    decorWidth: 0,
  },
};

export type StoryTone = 'strong' | 'muted' | 'accent' | 'ghost';

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
  /** `back`: hinter Strecke und Kacheln (riesige Zahl im Hintergrund). */
  readonly layer: 'back' | 'front';
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
  /** Logo „α5“ (immer Markenblau, nie umgefärbt) auf einer dunklen Plakette wie das App-Icon. */
  readonly logo: { x: number; y: number; width: number };
  readonly badge: StoryBox;
  readonly texts: readonly StoryText[];
  /** SVG-Pfad der Linie in Bild-Pixeln ('' = keine). */
  readonly linePath: string;
  readonly lineBox: { x: number; y: number; width: number; height: number };
  readonly lineStart: StoryPoint | null;
  readonly lineEnd: StoryPoint | null;
  readonly theme: StoryTheme;
  readonly palette: StoryPalette;
  /** Leuchtpunkte (Bild-Pixel). */
  readonly glows: readonly { x: number; y: number; r: number; color: string; opacity: number }[];
  /** Schmuck-Linien (Ringe bzw. Höhenlinien) als SVG-Pfade. */
  readonly decor: readonly string[];
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

/** Plakette mit Logo oben links (wie das App-Icon: dunkel mit blauem Schein, Logo in Markenblau). */
const BADGE: StoryBox = { x: STORY_PAD, y: 92, width: 196, height: 196, radius: 44 };
const LOGO_W = 150;
/** Farben der Plakette (Verlauf innen → außen) und des Logos – in allen Designs gleich (docs/DESIGN.md „Logo“). */
export const STORY_BADGE = {
  inner: '#13245C',
  outer: brandColors.schwarz,
  logo: brandColors.blau,
} as const;
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
    layer: 'front',
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

/** Kreis als SVG-Pfad. */
function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

/**
 * Höhenlinien als reines Muster (deterministisch, kein Bezug zur echten Strecke oder zum Ort): gewellte, ineinander
 * liegende Ringe um zwei feste Mittelpunkte.
 */
export function contourPaths(): string[] {
  const out: string[] = [];
  const centers = [
    { x: 260, y: 520, phase: 0.7 },
    { x: 880, y: 1500, phase: 2.1 },
  ];
  for (const c of centers) {
    for (let r = 70; r <= 1100; r += 64) {
      const pts: string[] = [];
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        const k = 1 + 0.09 * Math.sin(3 * a + c.phase + r / 300) + 0.05 * Math.sin(5 * a - r / 170);
        pts.push(
          `${Math.round(c.x + Math.cos(a) * r * k)} ${Math.round(c.y + Math.sin(a) * r * k * 0.82)}`,
        );
      }
      out.push(`M${pts.join('L')}Z`);
    }
  }
  return out;
}

const CONTOURS = contourPaths();

export function storyLayout(card: StoryCard, theme: StoryTheme = 'neon'): StoryLayout {
  const palette = STORY_PALETTES[theme];
  const texts: StoryText[] = [];
  const title =
    card.kind === 'endurance'
      ? card.eBike
        ? t.endurance.eBike.noun
        : card.walkKind
          ? t.endurance.hiking.nouns[card.walkKind]
          : t.endurance.sportNouns[card.sport]
      : card.title;
  // Titel immer zuerst (Tests lesen texts[0]); mit Namen „Karstens Lauf“.
  texts.push(
    text({
      text: card.ownerName ? S.ownerTitle(card.ownerName, title) : title,
      x: STORY_PAD,
      y: 400,
      size: 54,
      bold: true,
      tone: 'accent',
      upper: true,
      maxWidth: INNER,
    }),
  );
  if (card.date) {
    texts.push(
      text({
        text: card.time ? S.dateTime(formatDateDe(card.date), card.time) : formatDateDe(card.date),
        x: STORY_W - STORY_PAD,
        y: 205,
        size: 40,
        tone: 'muted',
        align: 'right',
        maxWidth: 560,
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

  // Riesige Zahl im Hintergrund (Neon/Energie), angepasst an die Bildbreite.
  if (hero && theme !== 'topo') {
    const { number } = splitValue(hero.value);
    const size = Math.min(460, Math.floor(1000 / (estimateWidth(number, 1) || 1)));
    texts.push(
      text({
        text: number,
        x: 40,
        y: lineBox.y + lineBox.height / 2 + size * 0.36,
        size,
        bold: true,
        tone: 'ghost',
        maxWidth: STORY_W - 40,
        layer: 'back',
      }),
    );
  }

  const decor =
    theme === 'neon'
      ? [260, 380, 500].map((r) => circlePath(STORY_W + 40, -40, r))
      : theme === 'topo'
        ? CONTOURS
        : [];
  return {
    logo: {
      x: BADGE.x + (BADGE.width - LOGO_W) / 2,
      y: BADGE.y + (BADGE.height - LOGO_W * (697 / 1133)) / 2,
      width: LOGO_W,
    },
    badge: BADGE,
    texts,
    linePath,
    lineBox,
    lineStart,
    lineEnd,
    theme,
    palette,
    glows: palette.glows.map((g) => ({
      x: g.fx * STORY_W,
      y: g.fy * STORY_H,
      r: g.r,
      color: g.color,
      opacity: g.opacity,
    })),
    decor,
    tiles,
  };
}
