import { describe, expect, it } from 'vitest';

import * as texts from './texts-de';
import { CYCLE_WARNING_CODES } from './warnings';
import { CYCLE_STATUSES, CYCLE_SYMPTOMS, CYCLE_BLEEDING_LEVELS } from './schemas';

/** Alle Texte dieses Moduls als Liste (rekursiv). */
function allTexts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    return [String((value as (n: number) => string)(12))];
  }
  if (Array.isArray(value)) return value.flatMap(allTexts);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allTexts);
  return [];
}

/** Verbotene Wörter (Plan 3.4/3.7): Diagnose, Fruchtbarkeit, Verhütung als Funktion, Phasen-Optimierung, Heilung. */
const FORBIDDEN = [
  /eisprung/i,
  /fruchtbar/i,
  /ovulation/i,
  /endometriose/i,
  /pcos/i,
  /eisenmangel/i,
  /amenorrh/i,
  /störung/i,
  /krankhaft/i,
  /depression/i,
  /hormone ausgleichen/i,
  /syncing/i,
  /optimal in (der )?phase/i,
  /lutealphase/i,
  /follikelphase/i,
  /pms-diät/i,
  /heil(t|ung|en\b)/i,
  /sicher verhüt/i,
  /geschützt/i,
  /vorhersage|prognose|nächste periode/i,
  /alles (ist )?normal/i,
];

describe('Texte des Zyklus-Moduls (Plan 3.7)', () => {
  const all = allTexts(texts);

  it('keine verbotenen Wörter', () => {
    for (const text of all) {
      for (const pattern of FORBIDDEN) {
        expect(text, `${pattern} in „${text}“`).not.toMatch(pattern);
      }
    }
  });

  it('„Verhütung“ nur im Pflichtsatz und als Status-Name', () => {
    const allowed = new Set([
      texts.CYCLE_MDR_SENTENCE,
      texts.CYCLE_STATUS_DE.hormonal_contraception,
      texts.CYCLE_WARNING_DE.W3_hormonal.body,
      texts.CYCLE_WARNING_DE.W4_hormonal.body,
    ]);
    for (const text of all.filter((t) => /verhütung/i.test(t))) {
      expect(allowed.has(text), text).toBe(true);
    }
  });

  it('kein Text enthält Kalorien- oder Gramm-Zahlen', () => {
    for (const text of all) expect(text).not.toMatch(/\d+\s*(kcal|kalorien|g\b|mg\b)/i);
  });

  it('keine Notrufnummern vor der Prüfung N2', () => {
    for (const text of [texts.CYCLE_URGENT_DE.body, texts.CYCLE_URGENT_DE.mental]) {
      expect(text).not.toMatch(/\d{3}/);
    }
  });

  it('jeder Code und jede Auswahl hat einen Text', () => {
    for (const code of CYCLE_WARNING_CODES) {
      expect(texts.CYCLE_WARNING_DE[code].title.length).toBeGreaterThan(3);
      expect(texts.CYCLE_WARNING_DE[code].body.length).toBeGreaterThan(10);
    }
    for (const s of CYCLE_STATUSES) expect(texts.CYCLE_STATUS_DE[s]).toBeTruthy();
    for (const s of CYCLE_SYMPTOMS) expect(texts.CYCLE_SYMPTOM_DE[s]).toBeTruthy();
    for (const s of CYCLE_BLEEDING_LEVELS) expect(texts.CYCLE_BLEEDING_DE[s]).toBeTruthy();
  });

  it('Pflichtsatz MDR wörtlich', () => {
    expect(texts.CYCLE_MDR_SENTENCE).toContain('nicht zur Verhütung oder Familienplanung geeignet');
    expect(texts.CYCLE_MDR_SENTENCE).toContain('kein Medizinprodukt');
  });

  it('Angebot „Heute leichter“ ohne Zyklus-Wörter (darf auf „Heute“ stehen, K7)', () => {
    for (const text of allTexts(texts.LIGHTER_OFFER_DE)) {
      expect(text).not.toMatch(/zyklus|periode|blutung|menstru/i);
    }
  });

  it('Formatierer', () => {
    expect(texts.cycleDayOfCycleDe(12)).toBe('Tag 12 seit Periodenbeginn');
    expect(texts.cycleLongGapQuestionDe(45)).toBe('Hattest du seit 45 Tagen keine Blutung?');
  });
});
