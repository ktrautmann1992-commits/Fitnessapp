import { describe, expect, it } from 'vitest';

import {
  equipmentValue,
  scheduleSummaryText,
  slotKindLabel,
  summaryLines,
  trainingDaysValue,
} from './summary';

describe('Trainingstage als Text', () => {
  it('Ausdauer heißt nach der Disziplin (kurz) bzw. „Ausdauer – …“ (lang)', () => {
    expect(slotKindLabel('endurance', null, 'short')).toBe('Laufen');
    expect(slotKindLabel('endurance', 'cycling', 'long')).toBe('Ausdauer – Radfahren');
    expect(slotKindLabel('endurance', 'triathlon_sprint', 'short')).toBe('Laufen und Rad');
    expect(slotKindLabel('strength_home', null, 'long')).toBe('Kraft zu Hause');
  });

  it('Live-Zusammenfassung: Tage, Anzahl je Art, Minuten pro Woche', () => {
    expect(
      scheduleSummaryText(
        [
          { kind: 'strength_gym', minutes: 60 },
          { kind: 'endurance', minutes: 30 },
          { kind: 'strength_gym', minutes: 60 },
          { kind: 'endurance', minutes: 30 },
        ],
        null,
      ),
    ).toBe('4 Tage: 2× Kraft im Studio, 2× Laufen · 180 min pro Woche');
    expect(scheduleSummaryText([{ kind: 'endurance', minutes: 10 }], 'swimming')).toBe(
      '1 Tag: 1× Schwimmen · 10 min pro Woche',
    );
    expect(scheduleSummaryText([], null)).toBe('Noch nichts geplant.');
  });

  it('„Geschafft!“: feste Tage je Zeile, „Tage egal“ zusammengefasst', () => {
    expect(
      trainingDaysValue(
        {
          mode: 'fixed',
          slots: [
            { weekday: 1, kind: 'endurance', minutes: 30 },
            { weekday: 3, kind: 'strength_gym', minutes: 60 },
            { weekday: 6, kind: 'strength_home', minutes: 90 },
          ],
        },
        null,
      ),
    ).toBe('Mo Laufen 30 min\nMi Kraft im Studio 60 min\nSa Kraft zu Hause 90 min');
    expect(
      trainingDaysValue(
        {
          mode: 'flex',
          slots: [
            { kind: 'strength_gym', minutes: 60 },
            { kind: 'strength_gym', minutes: 60 },
            { kind: 'endurance', minutes: 30 },
            { kind: 'endurance', minutes: 30 },
          ],
        },
        null,
      ),
    ).toBe('2× Kraft im Studio à 60 min, 2× Laufen à 30 min – die Tage verteilen wir');
  });
});

describe('Equipment kompakt', () => {
  it('Gewichte als Spanne mit Anzahl, Langhantel mit Stange und Scheiben', () => {
    expect(
      equipmentValue([
        { equipmentId: 'dumbbells', location: 'home', weightsKg: [2, 4, 6, 8, 10, 12, 14, 20] },
        { equipmentId: 'barbell', location: 'home', weightsKg: [1.25, 20, 5], barKg: null },
        { equipmentId: 'kettlebells', location: 'home', weightsKg: [16] },
        { equipmentId: 'flat_bench', location: 'home', weightsKg: [] },
      ]),
    ).toBe(
      'Kurzhanteln (2–20 kg, 8 Stufen), Langhantel mit Scheiben (Stange 20 kg, Scheiben 1,25–20 kg), ' +
        'Kettlebells (16 kg), Flachbank',
    );
    expect(
      equipmentValue([{ equipmentId: 'barbell', location: 'home', weightsKg: [], barKg: 7.5 }]),
    ).toBe('Langhantel mit Scheiben (Stange 7,5 kg)');
    expect(equipmentValue([])).toBe('Keine Geräte (Körpergewicht)');
  });

  it('Zusammenfassung: keine Zeile „Trainingsort“, Equipment nur mit Kraft zu Hause', () => {
    const studio = summaryLines(
      {
        trainingSchedule: { mode: 'flex', slots: [{ kind: 'strength_gym', minutes: 60 }] },
      },
      false,
    ).map((line) => line.label);
    expect(studio).toContain('Trainingstage');
    expect(studio).not.toContain('Trainingsort');
    expect(studio).not.toContain('Equipment');
    const home = summaryLines(
      {
        trainingSchedule: { mode: 'flex', slots: [{ kind: 'strength_home', minutes: 60 }] },
        equipment: [],
      },
      false,
    );
    expect(home.find((line) => line.label === 'Equipment')?.value).toBe(
      'Keine Geräte (Körpergewicht)',
    );
  });
});
