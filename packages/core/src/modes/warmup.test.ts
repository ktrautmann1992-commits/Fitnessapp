import { describe, expect, it } from 'vitest';

import { WARMUP_RULES } from '../constants';
import type { Exercise } from '../content/schemas';
import { MONDAY, person } from '../plan/test-library';
import { planSafetyRules } from '../plan/safety';
import { EXERCISES, NOTHING, strengthSession } from '../plan/swap-test-helpers';
import { painEffectOn } from './pain';
import { mainMusclesOf, sessionRoutine } from './warmup';

const healthy = planSafetyRules(person(), MONDAY);
const noCheck = planSafetyRules(person({ healthScreening: null }), MONDAY);
const published = new Map<string, Exercise>(
  [...EXERCISES].filter(([, e]) => e.status === 'published'),
);
const LEGS = strengthSession([
  'kniebeuge-langhantel',
  'beinpresse',
  'beinbeuger-maschine',
  'wadenheben-kurzhantel',
]);
const UPPER = strengthSession([
  'bankdruecken-langhantel',
  'latziehen',
  'seitheben-kurzhantel',
  'bizepscurl-kurzhantel',
]);

describe('Hauptmuskeln', () => {
  it('nach Sätzen und Reihenfolge gewichtet (Hauptübung vorn), höchstens 3', () => {
    // Ganzkörper: Kniebeuge zuerst → Beine vor Brust/Rücken, obwohl alle Übungen 3 Sätze haben.
    const fullBody = strengthSession([
      'kniebeuge-langhantel',
      'bankdruecken-langhantel',
      'latziehen',
    ]);
    expect(mainMusclesOf(fullBody.exercises, EXERCISES).slice(0, 2).sort()).toEqual([
      'glutes',
      'quadriceps',
    ]);
    expect(mainMusclesOf(LEGS.exercises, EXERCISES)).toEqual([
      'quadriceps',
      'glutes',
      'hamstrings',
    ]);
    expect(mainMusclesOf(UPPER.exercises, EXERCISES)).toHaveLength(WARMUP_RULES.mainMuscles);
    expect(mainMusclesOf([], EXERCISES)).toEqual([]);
  });
});

describe('Aufwärmen & Dehnen (mit den Entwürfen, Testmodus)', () => {
  it('Beintag: allgemein + Beweglichkeit + Aufwärmsätze, danach Dehnen für die Beine, ~5 min', () => {
    const r = sessionRoutine(LEGS, { library: EXERCISES, rules: healthy, profile: NOTHING })!;
    expect(r.warmupFallback).toBe(false);
    expect(r.cooldownFallback).toBe(false);
    expect(r.warmup.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['general', 'mobility', 'ramp']),
    );
    const ramp = r.warmup.find((i) => i.kind === 'ramp')!;
    expect(ramp.exerciseId).toBe('kniebeuge-langhantel');
    expect(ramp.note).toBe('light_weight');
    expect(ramp.sets).toBe(WARMUP_RULES.rampSets);
    const stretched = new Set(
      r.cooldown.flatMap((i) => EXERCISES.get(i.exerciseId)?.primary_muscles ?? []),
    );
    expect([...stretched]).toEqual(expect.arrayContaining(['quadriceps', 'hamstrings', 'glutes']));
    expect(r.warmupMinutes).toBeGreaterThanOrEqual(4);
    expect(r.warmupMinutes).toBeLessThanOrEqual(6);
    expect(r.cooldownMinutes).toBeLessThanOrEqual(WARMUP_RULES.cooldownMinutes);
    expect(r.cooldown.length).toBeLessThanOrEqual(WARMUP_RULES.maxStretches);
    // Nur Beweglichkeit/Dehnen und keine Sprünge im allgemeinen Teil.
    for (const item of r.warmup.filter((i) => i.kind !== 'ramp')) {
      expect(EXERCISES.get(item.exerciseId)?.caution_tags).not.toContain('high_impact');
    }
    for (const item of r.cooldown) {
      const e = EXERCISES.get(item.exerciseId)!;
      expect(e.movement_pattern).toBe('mobility');
      expect(e.load_type).toBe('time');
    }
  });

  it('Oberkörper: Schultern/Brust/Rücken werden aufgewärmt und gedehnt', () => {
    const r = sessionRoutine(UPPER, { library: EXERCISES, rules: healthy, profile: NOTHING })!;
    const mobility = r.warmup.filter((i) => i.kind === 'mobility').map((i) => i.exerciseId);
    expect(mobility.length).toBeGreaterThan(0);
    expect(r.cooldown.map((i) => i.exerciseId)).toContain('brustdehnung-tuerrahmen');
  });

  it('Körpergewicht-Grundübung: Aufwärmsätze mit halber Wiederholungszahl', () => {
    const r = sessionRoutine(strengthSession(['liegestuetz', 'kniebeuge-koerpergewicht']), {
      library: EXERCISES,
      rules: healthy,
      profile: NOTHING,
    })!;
    const ramp = r.warmup.find((i) => i.kind === 'ramp')!;
    expect(ramp.note).toBe('half_reps');
    expect(ramp.reps).toBe(4);
  });

  it('Sicherheitsregeln gelten: ohne Gesundheits-Check kein Über-Kopf-Dehnen', () => {
    const r = sessionRoutine(UPPER, { library: EXERCISES, rules: noCheck, profile: NOTHING })!;
    for (const item of [...r.warmup, ...r.cooldown]) {
      expect(EXERCISES.get(item.exerciseId)?.caution_tags, item.exerciseId).not.toContain(
        'overhead',
      );
    }
  });

  it('Schmerz-Modus: keine Aufwärm-/Dehnübung, die die Region belastet', () => {
    const pain = painEffectOn(
      [
        {
          id: '00000000-0000-4000-8000-000000000001',
          region: 'knee',
          intensity: 'moderate',
          duration_days: 7,
          started_on: MONDAY,
          ended_early_on: null,
          created_at: `${MONDAY}T08:00:00Z`,
        },
      ],
      MONDAY,
    )!;
    const r = sessionRoutine(LEGS, { library: EXERCISES, rules: healthy, profile: NOTHING, pain })!;
    expect(r.warmup.some((i) => i.kind === 'general')).toBe(false);
    expect(r.cooldown.map((i) => i.exerciseId)).not.toContain('oberschenkel-vorderseite-dehnen');
  });

  it('Ausdauer und leere Einheit → null', () => {
    expect(
      sessionRoutine({ kind: 'endurance', exercises: [] }, { library: EXERCISES, rules: healthy }),
    ).toBeNull();
    expect(
      sessionRoutine({ kind: 'strength', exercises: [] }, { library: EXERCISES, rules: healthy }),
    ).toBeNull();
  });
});

describe('Rückfall ohne freigegebene Beweglichkeitsübungen (Supabase heute)', () => {
  it('nur freigegebene Übungen: allgemeiner Teil + Aufwärmsätze, Dehnen = Text der Vorlage', () => {
    const r = sessionRoutine(LEGS, { library: published, rules: healthy, profile: NOTHING })!;
    expect(r.cooldownFallback).toBe(true);
    expect(r.cooldown).toEqual([]);
    expect(r.cooldownMinutes).toBe(WARMUP_RULES.cooldownMinutes);
    expect(r.warmup.some((i) => i.kind === 'ramp')).toBe(true);
    for (const item of r.warmup) expect(published.has(item.exerciseId), item.exerciseId).toBe(true);
  });

  it('leere Bibliothek: beide Teile als Text der Vorlage, Aufwärmsätze aus der Einheit selbst', () => {
    const r = sessionRoutine(LEGS, {
      library: new Map(),
      lookup: EXERCISES,
      rules: healthy,
      profile: NOTHING,
    })!;
    expect(r.warmupFallback).toBe(true);
    expect(r.cooldownFallback).toBe(true);
    expect(r.warmup.map((i) => i.kind)).toEqual(['ramp']);
    expect(r.warmupMinutes).toBe(WARMUP_RULES.targetMinutes);
  });

  it('ohne Bibliothek für die Einheit (offline): keine Aufwärmsätze, nur Rückfall', () => {
    const r = sessionRoutine(LEGS, { library: new Map(), rules: healthy })!;
    expect(r.warmup).toEqual([]);
    expect(r.warmupFallback).toBe(true);
    expect(r.mainMuscles).toEqual([]);
  });
});
