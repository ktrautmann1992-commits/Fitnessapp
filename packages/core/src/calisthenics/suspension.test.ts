/**
 * Schlingentrainer im normalen Krafttraining (docs/PLAN-CALISTHENICS-SCHLINGE.md 3): Gerät zählt erst als Kraft-Gerät,
 * wenn Übungen da sind (Supabase: freigegeben, Testmodus: Entwürfe); Tausch auf Schlingentrainer-Übungen für alle
 * Ziele (z. B. Kabelrudern → Schlingentrainer-Rudern), gemischt mit Kurzhanteln; Vorlagen „nur Schlingentrainer“.
 */
import { describe, expect, it } from 'vitest';

import type { EquipmentId } from '../equipment';

import { GOAL_TYPES } from '../enums';
import { swapCandidatesFor } from '../plan/preferences';
import {
  equipmentProfile,
  findSubstitute,
  isBodyweightOnly,
  isStrengthEquipmentIn,
  isSuspensionOnly,
  suspensionLinksTo,
} from '../plan/equipment-profile';
import { generateTrainingPlan } from '../plan/generate';
import { planSafetyRules } from '../plan/safety';
import { MONDAY, person, repoLibrary } from '../plan/test-library';
import { isSuspensionExercise, SUSPENSION_SETUPS, suspensionTrainerReady } from './suspension';

const LIB = repoLibrary();
const exercises = LIB.exercises;
type HomeEquipment = { equipmentId: EquipmentId; weightsKg: number[] }[];
const SLING: HomeEquipment = [{ equipmentId: 'suspension_trainer', weightsKg: [] }];
const SLING_DUMBBELLS: HomeEquipment = [
  { equipmentId: 'suspension_trainer', weightsKg: [] },
  { equipmentId: 'dumbbells', weightsKg: [4, 6, 8, 10] },
];

/** Bibliothek wie im Supabase-Modus vor der Freigabe: ohne Schlingentrainer-Übungen. */
const withoutSling = {
  ...LIB,
  exercises: new Map([...exercises].filter(([, e]) => !isSuspensionExercise(e))),
  templates: LIB.templates.filter((t) => !t.required_equipment_ids.includes('suspension_trainer')),
};

describe('Bereitschaft (suspensionTrainerReady)', () => {
  it('Testmodus mit Entwürfen: bereit; ohne Schlingentrainer-Übungen: nicht bereit', () => {
    expect(suspensionTrainerReady(exercises)).toBe(true);
    expect(suspensionTrainerReady(withoutSling.exercises)).toBe(false);
  });

  it('fehlt eine Gruppe (z. B. Ziehen), ist er nicht bereit', () => {
    const noPull = new Map(
      [...exercises].filter(
        ([, e]) => !(isSuspensionExercise(e) && e.movement_pattern === 'horizontal_pull'),
      ),
    );
    expect(suspensionTrainerReady(noPull)).toBe(false);
  });

  it('isStrengthEquipmentIn: nur mit `suspensionReady`', () => {
    expect(isStrengthEquipmentIn('suspension_trainer', {})).toBe(false);
    expect(isStrengthEquipmentIn('suspension_trainer', { suspensionReady: true })).toBe(true);
    expect(isStrengthEquipmentIn('pull_up_bar', { suspensionReady: true })).toBe(false);
    const ready = equipmentProfile('home', [...SLING], { suspensionReady: true });
    expect(isBodyweightOnly(ready)).toBe(false);
    expect(isSuspensionOnly(ready)).toBe(true);
    expect(isBodyweightOnly(equipmentProfile('home', [...SLING]))).toBe(true);
    expect(
      isSuspensionOnly(equipmentProfile('home', [...SLING_DUMBBELLS], { suspensionReady: true })),
    ).toBe(false);
  });
});

describe('Körperwinkel (SUSPENSION_SETUPS)', () => {
  it('jede Schlingentrainer-Übung hat genau eine Aufstellung, keine überzählige', () => {
    const ids = [...exercises.values()].filter(isSuspensionExercise).map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(SUSPENSION_SETUPS).sort()).toEqual(ids.sort());
  });

  it('Winkel leicht < schwer; Text „Füße weiter nach vorn = schwerer“ bei Gesicht zum Anker', () => {
    for (const [id, setup] of Object.entries(SUSPENSION_SETUPS)) {
      if (setup.angleDeg) expect(setup.angleDeg[0], id).toBeLessThan(setup.angleDeg[1]);
      const tips = exercises.get(id)!.tips_de.join(' ');
      if (setup.position === 'facing_anchor') expect(tips, id).toMatch(/Füße weiter nach vorn/);
      if (setup.position === 'facing_away' && id !== 'schlingentrainer-fallout') {
        expect(tips, id).toMatch(/Füße weiter nach hinten/);
      }
    }
  });

  it('Sicherheits-Hinweis zum Anker an jeder Übung (Tür: Seite, zu der sie sich schließt; vorher testen)', () => {
    for (const id of Object.keys(SUSPENSION_SETUPS)) {
      const note = exercises.get(id)!.safety_note_de;
      expect(note, id).toMatch(/zu der sich die Tür schließt/);
      expect(note, id).toMatch(/testen/);
    }
  });
});

describe('Tausch auf Schlingentrainer-Übungen (alle Ziele)', () => {
  const sling = equipmentProfile('home', [...SLING]);
  const rules = planSafetyRules(person(), MONDAY);
  const sub = (id: string, profile = sling) =>
    findSubstitute(exercises.get(id)!, { library: exercises, profile, rules })?.exercise.id;

  it('Kabelrudern → Schlingentrainer-Rudern, Kurzhantel-Curl → Schlingentrainer-Curl; nie schwerer als das Original', () => {
    expect(sub('kabelrudern')).toBe('schlingentrainer-rudern');
    // Schlingentrainer-Fliegende (Schwierigkeit 2) ist schwerer als Fliegende am Kabel (1) → nicht als Ersatz.
    expect(sub('fliegende-kabel')).not.toBe('schlingentrainer-fliegende');
    // Eigene Zuhause-Alternative der Übung geht vor (Brustpresse nennt den Liegestütz).
    expect(sub('brustpresse')).toBe('liegestuetz');
    expect(sub('bizepscurl-kurzhantel')).toBe('schlingentrainer-bizepscurl');
    // Schlingentrainer-Beinbeuger (2) ist schwerer als die Maschine (1) → nicht als Ersatz.
    expect(sub('beinbeuger-maschine')).not.toBe('schlingentrainer-beinbeuger');
    expect(sub('face-pull-kabel')).toBe('schlingentrainer-face-pull');
    expect(sub('trizepsdruecken-kabel')).toBe('schlingentrainer-trizepsstrecken');
  });

  it('ohne Schlingentrainer bleibt der bisherige Ersatz (Rückwärts-Verknüpfung wirkt nur mit Gerät)', () => {
    const none = equipmentProfile('home', []);
    expect(suspensionLinksTo(exercises.get('kabelrudern')!, exercises, none)).toEqual([]);
    expect(sub('kabelrudern', none)).not.toMatch(/^schlingentrainer-/);
  });

  it('gemischt mit Kurzhanteln: Kurzhantel-Übung bleibt, wenn sie direkt als Alternative passt', () => {
    const mixed = equipmentProfile('home', [
      ...SLING_DUMBBELLS,
      { equipmentId: 'flat_bench', weightsKg: [] },
    ]);
    // Kabelrudern nennt Kurzhantelrudern einarmig zuerst (Kurzhanteln + Bank vorhanden).
    expect(sub('kabelrudern', mixed)).toBe('kurzhantelrudern-einarmig');
    // Ohne Bank: Schlingentrainer-Rudern vor den Alternativen der Alternativen.
    expect(sub('kabelrudern', equipmentProfile('home', [...SLING_DUMBBELLS]))).toBe(
      'schlingentrainer-rudern',
    );
  });

  it('Tausch-Dialog („Nur heute“): Schlingentrainer-Rudern unter den ersten Kandidaten', () => {
    const kabel = exercises.get('kabelrudern')!;
    const result = swapCandidatesFor(kabel, kabel, {
      library: exercises,
      profile: sling,
      swapRules: rules,
      preferences: [],
      location: 'home',
      ambiguousLocation: false,
      inSession: new Set(),
      mode: 'today',
      harderVariantId: null,
    });
    expect(result.candidates[0]?.id).toBe('schlingentrainer-rudern');
  });

  it('Sicherheitsregeln gelten auch hier: ab 65 kein Atomic Push-up, „Fit im Alter“ keine Bodenübungen', () => {
    const aging = planSafetyRules(person({ goalType: 'active_aging' }), MONDAY);
    for (const id of Object.keys(SUSPENSION_SETUPS)) {
      const e = exercises.get(id)!;
      const blocked = e.caution_tags.some((t) => aging.excludedCautionTags.includes(t));
      expect(
        findSubstitute(e, { library: exercises, profile: sling, rules: aging })?.exercise.id === id,
      ).toBe(!blocked);
    }
  });
});

describe('Plan erzeugen mit Schlingentrainer', () => {
  const generate = (
    library: typeof LIB,
    homeEquipment: HomeEquipment,
    overrides: Parameters<typeof person>[0] = {},
  ) => {
    const result = generateTrainingPlan(
      person({ trainingLocation: 'home', homeEquipment: [...homeEquipment], ...overrides }),
      library,
      MONDAY,
    );
    if (!result.ok) throw new Error(result.error);
    return result.plan;
  };

  it('nur Schlingentrainer (Testmodus): Vorlage „nur Schlingentrainer“, nur Schlingentrainer-Übungen + Körpergewicht', () => {
    for (const goalType of ['general_fitness', 'muscle_gain', 'fat_loss'] as const) {
      const plan = generate(LIB, SLING, { goalType });
      expect(plan.template_id, goalType).toMatch(/-schlingentrainer$/);
      expect(plan.uses_draft_content).toBe(true);
      for (const s of plan.sessions.filter((x) => x.kind === 'strength')) {
        for (const e of s.exercises) {
          const ids = exercises.get(e.exercise_id)!.equipment_ids;
          expect(
            ids.every((id) => id === 'suspension_trainer'),
            e.exercise_id,
          ).toBe(true);
        }
      }
    }
  });

  it('nur Schlingentrainer, aber noch keine freigegebenen Übungen: Körpergewicht-Plan wie bisher', () => {
    const plan = generate(withoutSling, SLING);
    expect(plan.template_id).toMatch(/-koerpergewicht$/);
    const bodyweight = generate(withoutSling, []);
    expect(plan.template_id).toBe(bodyweight.template_id);
  });

  it('Schlingentrainer + Kurzhanteln: Zuhause-Vorlage, gemischt (Kurzhanteln und Schlingentrainer)', () => {
    const plan = generate(LIB, SLING_DUMBBELLS, { goalType: 'general_fitness' });
    expect(plan.template_id).toMatch(/-zuhause$/);
    const used = new Set(
      plan.sessions.flatMap((s) => s.exercises.map((e) => exercises.get(e.exercise_id)!)),
    );
    expect([...used].some((e) => e.equipment_ids.includes('dumbbells'))).toBe(true);
    expect([...used].some((e) => e.equipment_ids.includes('suspension_trainer'))).toBe(true);
  });

  it.each([1, 7])(
    'nur Schlingentrainer, %i Wunsch-Tage: Plan entsteht, höchstens 4 Kraft-Tage',
    (days) => {
      const plan = generate(LIB, SLING, {
        sessionsPerWeek: days,
        preferredDays: days === 7 ? [1, 2, 3, 4, 5, 6, 7] : [3],
      });
      const firstWeek = plan.sessions.filter((s) => s.week_no === plan.sessions[0]!.week_no);
      expect(firstWeek.length).toBeGreaterThanOrEqual(1);
      expect(firstWeek.length).toBeLessThanOrEqual(4);
    },
  );

  it('jedes Ziel mit nur Schlingentrainer erzeugt einen Plan (Vorlage folgt dem Ziel bzw. nächstbeste)', () => {
    for (const goalType of GOAL_TYPES) {
      const result = generateTrainingPlan(
        person({ trainingLocation: 'home', homeEquipment: [...SLING], goalType }),
        LIB,
        MONDAY,
      );
      expect(result.ok, goalType).toBe(true);
    }
  });
});
