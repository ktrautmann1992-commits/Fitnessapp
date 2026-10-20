import { type StoryCard, STORY_CARD, sketchPath, sketchPoints } from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';

/**
 * Aufbau des Story-Bilds (Etappe E6, EA-4: nur Linie auf Alpha5-Hintergrund, keine Kartenkacheln) in Bild-Pixeln
 * (1080 × 1920). Dieselbe Rechnung für die Vorschau/Aufnahme in der App (react-native-view-shot) und das Canvas im
 * Browser – beide zeigen genau den Inhalt der Positivliste aus packages/core. Rein.
 */

export const STORY_W = STORY_CARD.widthPx;
export const STORY_H = STORY_CARD.heightPx;
export const STORY_PAD = 80;

export interface StoryText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly bold: boolean;
  readonly muted: boolean;
}

export interface StoryLayout {
  readonly logo: { x: number; y: number; width: number };
  readonly texts: readonly StoryText[];
  /** SVG-Pfad der Linie in Bild-Pixeln ('' = keine). */
  readonly linePath: string;
  readonly lineBox: { x: number; y: number; width: number; height: number };
}

const S = t.endurance.story;

export function storyLayout(card: StoryCard): StoryLayout {
  const texts: StoryText[] = [];
  const title = card.kind === 'endurance' ? t.endurance.sportNouns[card.sport] : card.title;
  texts.push({ text: title, x: STORY_PAD, y: 420, size: 76, bold: true, muted: false });
  if (card.date) {
    texts.push({
      text: formatDateDe(card.date),
      x: STORY_PAD,
      y: 500,
      size: 44,
      bold: false,
      muted: true,
    });
  }
  const lineBox = { x: STORY_PAD, y: 580, width: STORY_W - 2 * STORY_PAD, height: 680 };
  let linePath = '';
  if (card.kind === 'endurance') {
    if (card.line && card.line.length > 1) {
      const projected = sketchPoints(card.line, {
        width: lineBox.width,
        height: lineBox.height,
        padding: 24,
        maxPoints: 800,
      }).map((p) => ({ x: p.x + lineBox.x, y: p.y + lineBox.y }));
      linePath = sketchPath(projected);
    } else if (card.lineState === 'too_short') {
      texts.push({
        text: S.lineTooShort,
        x: STORY_PAD,
        y: lineBox.y + lineBox.height / 2,
        size: 40,
        bold: false,
        muted: true,
      });
    }
  } else {
    card.exerciseNames.forEach((name, i) => {
      texts.push({
        text: name,
        x: STORY_PAD,
        y: 660 + i * 92,
        size: 52,
        bold: false,
        muted: false,
      });
    });
    if (card.moreExercises > 0) {
      texts.push({
        text: S.moreExercises(card.moreExercises),
        x: STORY_PAD,
        y: 660 + card.exerciseNames.length * 92,
        size: 44,
        bold: false,
        muted: true,
      });
    }
  }
  const colW = (STORY_W - 2 * STORY_PAD) / 2;
  card.stats.forEach((stat, i) => {
    const x = STORY_PAD + (i % 2) * colW;
    const y = 1380 + Math.floor(i / 2) * 190;
    texts.push({ text: S.stats[stat.key], x, y, size: 38, bold: false, muted: true });
    texts.push({ text: stat.value, x, y: y + 84, size: 72, bold: true, muted: false });
  });
  return { logo: { x: STORY_PAD, y: 110, width: 200 }, texts, linePath, lineBox };
}
