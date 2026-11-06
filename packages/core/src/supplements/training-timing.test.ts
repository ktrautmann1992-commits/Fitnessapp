import { describe, expect, it } from 'vitest';

import { recommendSupplements } from './eligibility';
import type { SupplementInputs } from './inputs';
import { checkSupplementText } from './text-rules';
import { supplementTestInputs as base, withoutConsent } from './test-helpers';
import {
  supplementTrainingDayTiming,
  timingStartMinutes,
  TRAINING_TIMING_TEXTS_DE,
  type TrainingTimingSession,
} from './training-timing';
import type { UserSupplementChoice } from './user-data';

/** Zeitpunkte rund um die Einheit (06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md). */

const rec = (overrides: Partial<SupplementInputs> = {}) => recommendSupplements(base(overrides));
/** Kreatin passt (Muskelaufbau), Proteinpulver passt (Lücke), Beta-Alanin (Intervalle), Elektrolyte (lange Einheiten). */
const many = rec({ proteinGap: true, hasIntervalSessions: true, hasLongSessions: true });
const session = (
  startMinutes: number | null,
  durationMinutes: number | null = 60,
): TrainingTimingSession => ({
  startMinutes,
  durationMinutes,
});
const ids = (lines: readonly { id: string }[]) => lines.map((line) => line.id);

describe('Ruhetag vs. Trainingstag', () => {
  it('Ruhetag: nur Tägliches (Kreatin, Beta-Alanin), kein Proteinpulver, keine Elektrolyte, kein Koffein', () => {
    const timing = supplementTrainingDayTiming(many, [], null, 70);
    expect(timing.trainingDay).toBe(false);
    expect(timing.startKnown).toBe(false);
    expect(ids(timing.lines)).toEqual(['beta_alanine', 'creatine']);
    expect(timing.lines.find((l) => l.id === 'creatine')?.textDe).toContain('Ruhetag');
  });

  it('Trainingstag morgens 7 Uhr, 60 min: Koffein 6–6:30 Uhr, Proteinpulver 8–10 Uhr, keine Elektrolyte', () => {
    const timing = supplementTrainingDayTiming(many, [], session(7 * 60), 70);
    expect(timing.trainingDay).toBe(true);
    expect(timing.startKnown).toBe(true);
    expect(ids(timing.lines)).toEqual(['caffeine', 'protein_powder', 'beta_alanine', 'creatine']);
    const caffeine = timing.lines[0]!;
    expect(caffeine).toMatchObject({ slot: 'before', fromMinutes: 360, toMinutes: 390 });
    expect(caffeine.textDe).toBe(
      'Falls du Koffein nutzt: etwa 06:00 Uhr bis 06:30 Uhr, höchstens 200 mg auf einmal.',
    );
    const protein = timing.lines[1]!;
    expect(protein).toMatchObject({ slot: 'after', fromMinutes: 480, toMinutes: 600 });
    expect(protein.textDe).toContain('etwa 08:00 Uhr bis 10:00 Uhr');
  });

  it('Abends 18:30: kein Koffein vorher (nach 16 Uhr, Schlaf)', () => {
    const timing = supplementTrainingDayTiming(many, [], session(18 * 60 + 30), 70);
    const caffeine = timing.lines.find((line) => line.id === 'caffeine')!;
    expect(caffeine.slot).toBe('no_caffeine');
    expect(caffeine.textDe).toBe('Deine Einheit beginnt nach 16 Uhr: Nimm vorher kein Koffein.');
    expect(timing.lines[0]!.id).toBe('caffeine');
  });

  it('genau 16 Uhr: Koffein-Fenster noch erlaubt (Grenze inklusive)', () => {
    const timing = supplementTrainingDayTiming(many, [], session(16 * 60), 70);
    expect(timing.lines.find((line) => line.id === 'caffeine')?.slot).toBe('before');
  });

  it('lange Ausdauer 9 Uhr, 120 min: Elektrolyte während 9–11 Uhr mit 300–600 mg Natrium je Stunde', () => {
    const timing = supplementTrainingDayTiming(many, [], session(9 * 60, 120), 70);
    const electrolytes = timing.lines.find((line) => line.id === 'electrolytes')!;
    expect(electrolytes).toMatchObject({ slot: 'during', fromMinutes: 540, toMinutes: 660 });
    expect(electrolytes.textDe).toContain('09:00 Uhr bis 11:00 Uhr');
    expect(electrolytes.textDe).toContain('300–600 mg Natrium je Stunde');
    expect(timing.lines.find((l) => l.id === 'protein_powder')?.fromMinutes).toBe(660);
  });

  it('Elektrolyte: 89 min → keine Zeile, 90 min → Zeile, unbekannte Dauer → keine Zeile', () => {
    const at = (minutes: number | null) =>
      ids(supplementTrainingDayTiming(many, [], session(600, minutes), 70).lines);
    expect(at(89)).not.toContain('electrolytes');
    expect(at(90)).toContain('electrolytes');
    expect(at(null)).not.toContain('electrolytes');
  });

  it('ohne Uhrzeit: Sätze ohne Uhrzeit, Koffein mit 16-Uhr-Bedingung', () => {
    const timing = supplementTrainingDayTiming(many, [], session(null, 120), 70);
    expect(timing.startKnown).toBe(false);
    for (const line of timing.lines) {
      expect(line.fromMinutes, line.id).toBeNull();
      expect(line.textDe, line.id).not.toMatch(/\d{2}:\d{2}/);
    }
    expect(timing.lines.find((line) => line.id === 'caffeine')?.textDe).toBe(
      'Falls du Koffein nutzt: etwa 30–60 Minuten vor dem Start und nur, wenn die Einheit vor 16 Uhr liegt.',
    );
    expect(ids(timing.lines)).toContain('electrolytes');
  });

  it('sehr früh (0:15): Fenster nie vor Mitternacht', () => {
    const timing = supplementTrainingDayTiming(many, [], session(15), 70);
    expect(timing.lines.find((line) => line.id === 'caffeine')).toMatchObject({
      fromMinutes: 0,
      toMinutes: 0,
    });
  });

  it('sehr spät (23:00, 120 min): Fenster enden um 23:59', () => {
    const timing = supplementTrainingDayTiming(many, [], session(23 * 60, 120), 70);
    expect(timing.lines.find((line) => line.id === 'protein_powder')?.toMinutes).toBe(1439);
  });
});

describe('Koffein-Sicherheit', () => {
  it('ohne Gewicht: Tassen-Satz statt mg', () => {
    const timing = supplementTrainingDayTiming(rec({ weightKg: null }), [], session(8 * 60), null);
    expect(timing.lines.find((line) => line.id === 'caffeine')?.textDe).toContain(
      '1–2 Tassen Kaffee',
    );
  });

  it('leichtes Gewicht (40 kg): persönliche Grenze 120 mg', () => {
    const timing = supplementTrainingDayTiming(rec({ weightKg: 40 }), [], session(8 * 60), 40);
    expect(timing.lines.find((line) => line.id === 'caffeine')?.textDe).toContain('120 mg');
  });

  it('Koffein-empfindlich, Schwangerschaft, unter 18 → keine Koffein-Zeile', () => {
    for (const overrides of [
      { supplementFlags: ['caffeine_sensitive' as const] },
      { healthFlags: ['pregnancy' as const] },
      { birthDate: '2009-10-20' },
    ]) {
      const timing = supplementTrainingDayTiming(rec(overrides), [], session(8 * 60), 70);
      expect(ids(timing.lines)).not.toContain('caffeine');
    }
  });
});

describe('Auswahl und Einordnung', () => {
  it('„Nicht für mich“ blendet aus; „Nehme ich“ bei Vitamin D (Info) zeigt es', () => {
    const choices: UserSupplementChoice[] = [
      { supplementId: 'creatine', status: 'not_for_me' },
      { supplementId: 'vitamin_d', status: 'taking' },
    ];
    const timing = supplementTrainingDayTiming(many, choices, session(8 * 60), 70);
    expect(ids(timing.lines)).not.toContain('creatine');
    expect(timing.lines.find((line) => line.id === 'vitamin_d')?.slot).toBe('with_meals');
  });

  it('EAA (vegan mit Lücke): kurz vor dem Training, ab 30 min vorher', () => {
    const timing = supplementTrainingDayTiming(
      rec({ proteinGap: true, dietType: 'vegan' }),
      [],
      session(17 * 60),
      70,
    );
    expect(timing.lines.find((line) => line.id === 'eaa')).toMatchObject({
      slot: 'before',
      fromMinutes: 16 * 60 + 30,
      toMinutes: 17 * 60,
    });
  });

  it('Sperr-Flag (Niere) → Kreatin, Proteinpulver, Elektrolyte, Beta-Alanin verschwinden', () => {
    const blocked = rec({
      proteinGap: true,
      hasIntervalSessions: true,
      hasLongSessions: true,
      supplementFlags: ['kidney'],
    });
    const timing = supplementTrainingDayTiming(blocked, [], session(8 * 60, 120), 70);
    expect(ids(timing.lines).filter((id) => id !== 'caffeine')).toEqual([]);
  });

  it('ohne Einwilligung: nichts außer der allgemeinen Koffein-Info', () => {
    const timing = supplementTrainingDayTiming(
      recommendSupplements(withoutConsent({ hasIntervalSessions: true })),
      [{ supplementId: 'creatine', status: 'taking' }],
      session(8 * 60),
      null,
    );
    expect(ids(timing.lines)).toEqual(['caffeine']);
    expect(timing.lines[0]!.textDe).toContain('Tassen Kaffee');
  });

  it('ungültige Uhrzeit → Fehler (Zod an der Grenze)', () => {
    expect(() => supplementTrainingDayTiming(many, [], session(1440), 70)).toThrow();
    expect(() => supplementTrainingDayTiming(many, [], session(600, 0), 70)).toThrow();
  });
});

describe('Beginn der Einheit', () => {
  it('echter Beginn vor geplanter Uhrzeit; sonst geplant; sonst null', () => {
    expect(timingStartMinutes(18 * 60, 18 * 60 + 47)).toBe(18 * 60 + 47);
    expect(timingStartMinutes(18 * 60, null)).toBe(18 * 60);
    expect(timingStartMinutes(null, null)).toBeNull();
    expect(() => timingStartMinutes(2000, null)).toThrow();
  });
});

describe('Texte', () => {
  it('feste Texte ohne verbotene Wörter, ohne Zahlen (nur Platzhalter)', () => {
    for (const [key, text] of Object.entries(TRAINING_TIMING_TEXTS_DE)) {
      const hits = checkSupplementText(text).filter((hit) => hit.kind !== 'unknown_placeholder');
      expect(hits, key).toEqual([]);
    }
  });

  it('gerenderte Zeilen ohne verbotene Wörter (Zahlen kommen nur aus dem Core)', () => {
    const timing = supplementTrainingDayTiming(many, [], session(9 * 60, 120), 70);
    for (const line of timing.lines) {
      const hits = checkSupplementText(line.textDe).filter((hit) => hit.kind !== 'number');
      expect(hits, line.textDe).toEqual([]);
    }
  });
});
