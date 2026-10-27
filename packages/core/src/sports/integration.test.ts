import { describe, expect, it } from 'vitest';

import { FREE_SESSION, SESSION_KCAL, SPORT_CATALOGUE, WEARABLE_SYNC } from '../constants';
import { SPORT_IDS } from '../enums';
import { freeSessionNutritionSessions } from '../log/free-session';
import {
  sessionCalories,
  sessionCaloriesForLog,
  type SessionCaloriesInput,
  sessionCaloriesInputForLog,
} from '../log/session-calories';
import { weekStatus, type WeekStatusLog, type WeekStatusSession } from '../plan/week-status';
import { WEARABLE_NAME_PATTERN } from '../wearables/schema';
import {
  mapExerciseType,
  sportForExerciseType,
  sportFromWearableTitle,
  WEARABLE_OTHER_TITLES,
  WEARABLE_SPORT_TYPES,
} from '../wearables/exercise-types';
import { sportMet } from './catalogue';

/** Sportarten im Zusammenspiel: kcal je Einheit, Uhr-Zuordnung, Training-Übersicht, Tagesziel. */

const PADEL: SessionCaloriesInput = {
  kind: 'strength',
  enduranceModality: null,
  effortTarget: null,
  durationS: 3600,
  bodyWeightKg: 80,
  measuredKcal: null,
  sport: 'padel',
  effort: 6,
};
const round5 = (value: number) => Math.round(value / 5) * 5;

describe('kcal je Einheit mit Sportart (SESSION_KCAL-Formel, MET der Sportart)', () => {
  it('Padel 60 min, 80 kg, Anstrengung 6 → MET 6,8 × 80 = 545 kcal (gerundet auf 5)', () => {
    expect(sportMet('padel', 6)).toBe(6.8);
    expect(sessionCalories(PADEL)).toEqual({
      kcal: 545,
      source: 'estimate',
      reason: null,
      met: 6.8,
    });
  });

  it.each(SPORT_IDS)('%s: MET × kg × h; ohne Anstrengung der hohe Wert', (sport) => {
    const { low, high } = SPORT_CATALOGUE[sport].met;
    expect(sessionCalories({ ...PADEL, sport, effort: 0 }).kcal).toBe(round5(low * 80));
    expect(sessionCalories({ ...PADEL, sport, effort: null }).kcal).toBe(round5(high * 80));
  });

  it('Grenzfälle Gewicht (40 kg, 250 kg) und Dauer (1 min, 8 h, darüber)', () => {
    expect(sessionCalories({ ...PADEL, bodyWeightKg: 40 }).kcal).toBe(round5(6.8 * 40));
    expect(
      sessionCalories({
        ...PADEL,
        bodyWeightKg: 250,
        sport: 'handball',
        effort: 10,
        durationS: 8 * 3600,
      }).kcal,
    ).toBe(SESSION_KCAL.maxKcal);
    expect(sessionCalories({ ...PADEL, durationS: 60 }).kcal).toBe(round5((6.8 * 80) / 60));
    expect(sessionCalories({ ...PADEL, durationS: 59 }).reason).toBe('no_duration');
    expect(sessionCalories({ ...PADEL, durationS: 8 * 3600 + 1 }).reason).toBe('no_duration');
    expect(sessionCalories({ ...PADEL, bodyWeightKg: null }).reason).toBe('no_weight');
  });

  it('Uhr-Wert geht vor; ohne Sportart unverändert Kraft', () => {
    expect(sessionCalories({ ...PADEL, measuredKcal: 612 })).toEqual({
      kcal: 610,
      source: 'watch',
      reason: null,
    });
    expect(sessionCalories({ ...PADEL, sport: null }).kcal).toBe(280);
  });

  it('aus dem Tagebuch: Sportart, Dauer und Anstrengung aus der Zeile', () => {
    const log = {
      kind: 'strength' as const,
      started_at: null,
      finished_at: null,
      name_de: 'Padel',
      source: 'manual' as const,
      session_rpe: 6,
      sport: 'padel' as const,
      sport_duration_s: 3600,
    };
    expect(sessionCaloriesInputForLog({ log, cardio: null, planned: null })).toMatchObject({
      kind: 'strength',
      durationS: 3600,
      sport: 'padel',
      effort: 6,
    });
    expect(
      sessionCaloriesForLog({
        log,
        cardio: null,
        planned: null,
        bodyWeightKg: 80,
        measuredKcal: null,
      }).kcal,
    ).toBe(545);
  });

  it('Uhr-Einheit „Tennis“ ohne Spalte: Sportart aus dem Titel, Dauer aus Beginn/Ende', () => {
    const log = {
      kind: 'strength' as const,
      started_at: '2026-10-25T09:00:00Z',
      finished_at: '2026-10-25T10:30:00Z',
      name_de: 'Tennis',
      source: 'health_connect' as const,
      session_rpe: null,
      sport: null,
    };
    expect(sessionCaloriesInputForLog({ log, cardio: null, planned: null })).toMatchObject({
      durationS: 5400,
      sport: 'tennis',
      effort: null,
    });
  });

  it('ältere Aufrufer ohne Sportart-Felder: unverändert', () => {
    const log = { kind: 'strength' as const, started_at: null, finished_at: null };
    const input = sessionCaloriesInputForLog({ log, cardio: null, planned: null });
    expect(input).not.toHaveProperty('sport');
  });
});

describe('Health Connect → Sportart', () => {
  it('Katalog-Arten bekommen ihre Sportart; Laufen/Kraft keine; Unbekanntes → other', () => {
    expect(sportForExerciseType(64)).toBe('football');
    expect(sportForExerciseType(11)).toBe('boxing');
    expect(sportForExerciseType(2)).toBe('badminton');
    expect(sportForExerciseType(61)).toBe('alpine_skiing');
    expect(sportForExerciseType(51)).toBe('climbing');
    expect(sportForExerciseType(46)).toBe('kayaking');
    expect(sportForExerciseType(36)).toBe('hiit');
    expect(sportForExerciseType(56)).toBeNull();
    expect(sportForExerciseType(70)).toBeNull();
    // Sportarten Stufe 1 (Etappe Y): Yoga 83, Pilates 48; Dehnen 71 bleibt „Sonstige“.
    expect(sportForExerciseType(83)).toBe('yoga');
    expect(sportForExerciseType(48)).toBe('pilates');
    expect(sportForExerciseType(71)).toBe('other');
    expect(sportForExerciseType(0)).toBe('other');
    expect(sportForExerciseType(999)).toBe('other');
  });

  it('jede zugeordnete Art ist eine „Sonstige“ mit Titel; Titel passen zum Server-Muster', () => {
    const pattern = new RegExp(WEARABLE_NAME_PATTERN);
    for (const [type, sport] of Object.entries(WEARABLE_SPORT_TYPES)) {
      const mapped = mapExerciseType(Number(type));
      expect(mapped.group, type).toBe('other');
      expect(mapped.nameDe, type).toMatch(pattern);
      expect([...mapped.nameDe].length).toBeLessThanOrEqual(WEARABLE_SYNC.nameMaxLength);
      expect(sportFromWearableTitle(mapped.nameDe), type).toBe(sport);
    }
  });

  it('Titel = Name der Sportart, wo das Muster es erlaubt', () => {
    for (const [type, sport] of Object.entries(WEARABLE_SPORT_TYPES)) {
      const title = WEARABLE_OTHER_TITLES[Number(type)];
      if (
        !SPORT_CATALOGUE[sport].nameDe.includes('/') &&
        type !== '10' &&
        type !== '44' &&
        type !== '46'
      ) {
        expect(title, type).toBe(SPORT_CATALOGUE[sport].nameDe);
      }
    }
  });
});

describe('Training-Übersicht: Sportart zählt nie für eine geplante Einheit', () => {
  const strength: WeekStatusSession = {
    id: 's1',
    scheduled_on: '2026-10-21',
    original_date: null,
    status: 'planned',
    kind: 'strength',
    endurance_modality: null,
    name_de: 'Ganzkörper A',
    plan_active: true,
  };
  const padel: WeekStatusLog = {
    id: 'p1',
    planned_session_id: null,
    performed_on: '2026-10-21',
    kind: 'strength',
    status: 'completed',
    name_de: 'Padel',
    is_free: true,
    sport: 'padel',
    duration_s: 3600,
    kcal: 545,
  };

  it('gleicher Tag wie offene Kraft-Einheit → keine Zuordnung, keine Frage, Sportart im Eintrag', () => {
    const status = weekStatus({
      sessions: [strength],
      logs: [padel],
      weekOf: '2026-10-21',
      today: '2026-10-23',
    });
    const day = status.days.find((d) => d.date === '2026-10-21');
    expect(day?.entries).toHaveLength(1);
    expect(day?.entries[0]).toMatchObject({
      name_de: 'Padel',
      sport: 'padel',
      fulfils: null,
      changeable: false,
      alternatives: [],
      kcal: 545,
    });
    expect(day?.open.map((o) => o.sessionId)).toEqual(['s1']);
    expect(status.questions).toEqual([]);
    expect(status.summary.extraUnits).toBe(1);
  });

  it('auch eine gespeicherte Zuordnung wirkt nicht; ohne Sportart unverändert', () => {
    const status = weekStatus({
      sessions: [strength],
      logs: [padel],
      assignments: [{ logId: 'p1', sessionId: 's1' }],
      weekOf: '2026-10-21',
      today: '2026-10-23',
    });
    expect(status.summary.sessionsDone).toBe(0);
    const free = weekStatus({
      sessions: [strength],
      logs: [{ ...padel, sport: null, name_de: FREE_SESSION.names.strength }],
      weekOf: '2026-10-21',
      today: '2026-10-23',
    });
    expect(free.summary.sessionsDone).toBe(1);
  });
});

describe('Tagesziel: Sportart-Dauer als Trainingsenergie', () => {
  it('Sportart-Eintrag zählt mit seiner Dauer (Kraft-MET, sichere Richtung), gedeckelt', () => {
    const sessions = freeSessionNutritionSessions(
      [
        {
          id: 'p',
          is_free: true,
          performed_on: '2026-10-25',
          kind: 'strength',
          session_rpe: 6,
          sport_duration_s: 3600,
        },
        {
          id: 'q',
          is_free: true,
          performed_on: '2026-10-25',
          kind: 'strength',
          session_rpe: null,
          sport_duration_s: 12 * 3600,
        },
      ],
      { cardio: [], doneSets: new Map() },
    );
    expect(sessions.map((s) => s.minutes)).toEqual([60, FREE_SESSION.strengthMinutesMax]);
    expect(sessions[0]).toMatchObject({
      kind: 'strength',
      enduranceModality: null,
      effortTarget: null,
    });
  });
});
