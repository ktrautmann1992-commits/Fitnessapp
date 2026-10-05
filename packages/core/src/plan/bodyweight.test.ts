/**
 * Körpergewicht-Pläne mit den ECHTEN Inhalten aus content/ (docs/PLAN-KOERPERGEWICHT.md §6, Wächter A2, A5, A6):
 * gemischte Wochen, Eigenschaftstest für Profile ohne Kraft-Geräte, Einstiegs-Sicherheit der Vorlagen.
 */
import { describe, expect, it } from 'vitest';

import { isBodyweightTemplate } from '../content/checks';
import type { MovementPattern } from '../enums';
import { adaptTemplate, fitSessionToMinutes } from './adapt';
import { isBodyweightTemplateId } from './content-pool';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { type PlanInputsInput, planInputsSchema } from './inputs';
import { planSafetyRules } from './safety';
import { type GeneratedSession, nextPlanBlock } from './schedule';
import { MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();
const bodyweightTemplates = library.templates.filter(isBodyweightTemplate);

type Kind = 'strength_gym' | 'strength_home';
const fixed = (days: [number, Kind][], minutes = 45): PlanInputsInput['schedule'] => ({
  mode: 'fixed',
  slots: days.map(([weekday, kind]) => ({ weekday, kind, minutes })),
});

const pattern = (id: string): MovementPattern | undefined =>
  library.exercises.get(id)?.movement_pattern;
const isHip = (id: string) => pattern(id) === 'hinge' || pattern(id) === 'hip_extension';

describe('Körpergewicht-Vorlagen im Inhaltsstand', () => {
  it('18 Vorlagen: 3 Ziele × 2 Level × 2/3/4 Tage, alle mit Kennzeichen ohne Geräte', () => {
    expect(bodyweightTemplates).toHaveLength(18);
    for (const goal of ['muskelaufbau', 'fettverlust', 'fitness']) {
      for (const level of ['einsteiger', 'fortgeschritten']) {
        for (const days of [2, 3, 4]) {
          const id = `${goal}-${level}-${days}t-koerpergewicht`;
          const template = bodyweightTemplates.find((t) => t.id === id);
          expect(template, id).toBeDefined();
          expect(template?.title_de).toContain('Körpergewicht');
          expect(template?.sessions_per_week).toBe(days);
        }
      }
    }
  });

  it('nur Übungen ohne Geräte; jede Einheit mit Drücken, Ziehen über horizontal_pull bzw. Rumpf (A8)', () => {
    for (const template of bodyweightTemplates) {
      const all = template.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
      expect(all.every((id) => library.exercises.get(id)?.equipment_ids.length === 0)).toBe(true);
      expect(
        all.some((id) => pattern(id) === 'horizontal_pull'),
        template.id,
      ).toBe(true);
      expect(all.some((id) => pattern(id) === 'hinge' || pattern(id) === 'hip_extension')).toBe(
        true,
      );
      for (const session of template.sessions) {
        const ids = session.exercises.map((e) => e.exercise_id);
        if (session.focus !== 'lower') {
          expect(
            ids.some((id) => pattern(id) === 'horizontal_push'),
            session.name_de,
          ).toBe(true);
          expect(
            ids.some((id) => pattern(id) === 'horizontal_pull'),
            session.name_de,
          ).toBe(true);
        }
        if (session.focus !== 'upper') {
          expect(
            ids.some((id) => ['squat', 'lunge'].includes(pattern(id) ?? '')),
            `${template.id} ${session.name_de}`,
          ).toBe(true);
          expect(
            ids.some((id) => ['hinge', 'hip_extension'].includes(pattern(id) ?? '')),
            `${template.id} ${session.name_de}`,
          ).toBe(true);
        }
        expect(
          ids.some((id) => (pattern(id) ?? '').startsWith('core_')),
          `${template.id} ${session.name_de}`,
        ).toBe(true);
      }
    }
  });

  it('Sicherheit der Erstwahl (A7, A13, A14): keine Technik-, Sprung- oder Ausdauer-Übung; Einsteiger ohne Über-Kopf', () => {
    for (const template of bodyweightTemplates) {
      for (const item of template.sessions.flatMap((s) => s.exercises)) {
        const exercise = library.exercises.get(item.exercise_id);
        const label = `${template.id}: ${item.exercise_id}`;
        expect(exercise?.caution_tags.includes('high_skill'), label).toBe(false);
        expect(exercise?.caution_tags.includes('high_impact'), label).toBe(false);
        // Ausdauer-Übungen (z. B. Hampelmann) erst mit capWeeklyIncrease im Block-Bau (Phase 10).
        expect(exercise?.movement_pattern, label).not.toBe('conditioning');
        expect(['tisch-rudern', 'nordic-curl-assistiert', 'dips-stuhl'], label).not.toContain(
          item.exercise_id,
        );
        if (template.experience_level === 'beginner') {
          expect(exercise?.caution_tags.includes('overhead'), label).toBe(false);
        }
        // Jede Übung mit Merkmal hat eine erlaubte Alternative ohne Gerät und ohne Merkmal.
        if (exercise && exercise.caution_tags.length > 0) {
          const safe = exercise.alternatives.some((a) => {
            const alt = library.exercises.get(a.alternative_id);
            return (
              alt !== undefined && alt.equipment_ids.length === 0 && alt.caution_tags.length === 0
            );
          });
          expect(safe, label).toBe(true);
        }
      }
    }
  });

  it('Notiz verspricht eine schwerere Variante nur bei Übungen mit `harder`-Alternative (W3)', () => {
    for (const template of bodyweightTemplates) {
      for (const item of template.sessions.flatMap((s) => s.exercises)) {
        if (!/schwerere Variante/.test(item.notes_de ?? '')) continue;
        const exercise = library.exercises.get(item.exercise_id);
        expect(
          exercise?.alternatives.some((a) => a.reason === 'harder'),
          `${template.id}: ${item.exercise_id}`,
        ).toBe(true);
      }
    }
  });

  it('Dauer (A14): 30–45 min, nur Muskelaufbau · Fortgeschritten · 2 Tage bis 60 min (A9)', () => {
    for (const template of bodyweightTemplates) {
      expect(template.minutes_min, template.id).toBe(30);
      expect(template.minutes_max, template.id).toBe(
        template.id === 'muskelaufbau-fortgeschritten-2t-koerpergewicht' ? 60 : 45,
      );
    }
  });
});

describe('gemischte Wochen Studio + Zuhause ohne Geräte (A2): Studio-Vorlage + Hinweis', () => {
  const cases: [string, [number, Kind][]][] = [
    [
      '1:1',
      [
        [1, 'strength_gym'],
        [4, 'strength_home'],
      ],
    ],
    [
      '2:1',
      [
        [1, 'strength_gym'],
        [3, 'strength_gym'],
        [5, 'strength_home'],
      ],
    ],
    [
      '1:2',
      [
        [1, 'strength_gym'],
        [3, 'strength_home'],
        [5, 'strength_home'],
      ],
    ],
  ];
  const HOME_WITHOUT_STRENGTH: [string, NonNullable<PlanInputsInput['homeEquipment']>][] = [
    ['ohne Geräte', []],
    ['Laufband', [{ equipmentId: 'treadmill', weightsKg: [] }]],
    ['nur Klimmzugstange', [{ equipmentId: 'pull_up_bar', weightsKg: [] }]],
    ['nur Flachbank', [{ equipmentId: 'flat_bench', weightsKg: [] }]],
  ];
  const combos = cases.flatMap(([ratio, days]) =>
    HOME_WITHOUT_STRENGTH.map(
      ([name, equipment]) => [`${ratio} ${name}`, days, equipment] as const,
    ),
  );
  it.each(combos)('Studio:Zuhause %s', (_, days, homeEquipment) => {
    const result = generateTrainingPlan(
      person({ schedule: fixed([...days]), homeEquipment: [...homeEquipment] }),
      library,
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.plan;
    const template = library.templates.find((t) => t.id === p.template_id);
    expect(template?.location).toBe('gym');
    expect(p.notes).toContain('location_mismatch');
    expect(p.notes).toContain('exercises_substituted');
    const homeDays = new Set(days.filter(([, k]) => k === 'strength_home').map(([d]) => d));
    const available = new Set<string>(homeEquipment.map((e) => e.equipmentId));
    for (const s of p.sessions.filter((x) => homeDays.has(isoWeekdayOf(x.scheduled_on)))) {
      for (const e of s.exercises) {
        const needs = library.exercises.get(e.exercise_id)?.equipment_ids ?? [];
        expect(
          needs.every((id) => available.has(id)),
          e.exercise_id,
        ).toBe(true);
      }
    }
  });

  it('1:2 mit Kurzhanteln zu Hause bleibt wie bisher (Mehrheit Zuhause → Zuhause-Vorlage)', () => {
    const result = generateTrainingPlan(
      person({
        schedule: fixed(cases[2]?.[1] ?? []),
        homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: [4, 8, 12] }],
      }),
      library,
      MONDAY,
    );
    expect(result.ok && result.plan.template_id).toBe('muskelaufbau-einsteiger-3t-zuhause');
  });
});

function isoWeekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

describe('Eigenschaftstest: Profile ohne Kraft-Geräte (unabhängige Erwartung)', () => {
  // Feste Erwartung, bewusst nicht aus constants.ts: gesperrte Merkmale je Personengruppe.
  const PEOPLE: {
    name: string;
    birthDate: string;
    screening: PlanInputsInput['healthScreening'];
    sex: PlanInputsInput['sex'];
    excluded: string[];
  }[] = [
    { name: 'gesund', birthDate: '1990-01-01', screening: { flags: [] }, sex: null, excluded: [] },
    {
      name: 'schwanger',
      birthDate: '1994-01-01',
      screening: { flags: ['pregnancy'] },
      sex: 'female',
      excluded: ['long_supine', 'high_impact', 'spinal_loading', 'high_skill'],
    },
    {
      name: 'ab 65',
      birthDate: '1958-01-01',
      screening: { flags: [] },
      sex: 'male',
      excluded: ['high_impact', 'high_skill'],
    },
    {
      name: 'unter 18',
      birthDate: '2009-06-01',
      screening: { flags: [] },
      sex: 'diverse',
      excluded: ['high_skill'],
    },
    {
      name: 'vorsichtig',
      birthDate: '1980-01-01',
      screening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
      sex: null,
      excluded: ['high_impact', 'spinal_loading', 'high_skill', 'overhead'],
    },
    {
      name: 'ohne Check',
      birthDate: '1985-01-01',
      screening: null,
      sex: 'unspecified',
      excluded: ['high_impact', 'spinal_loading', 'high_skill', 'overhead'],
    },
  ];
  const EQUIPMENT: NonNullable<PlanInputsInput['homeEquipment']>[] = [
    [],
    [{ equipmentId: 'treadmill', weightsKg: [] }],
    [{ equipmentId: 'pull_up_bar', weightsKg: [] }],
    [{ equipmentId: 'flat_bench', weightsKg: [] }],
  ];
  const GOALS = ['muscle_gain', 'fat_loss', 'general_fitness', 'definition', 'endurance'] as const;

  it('immer Körpergewicht-Vorlage, horizontal_pull und Hüft-Übung, kein no_pull_exercise, nichts Gesperrtes', () => {
    const violations: string[] = [];
    let count = 0;
    for (const person_ of PEOPLE) {
      for (const goalType of GOALS) {
        for (const experienceLevel of ['beginner', 'advanced', 'competitive'] as const) {
          for (const days of [1, 2, 3, 4, 6, 7]) {
            for (const minutes of [20, 30, 45, 240]) {
              for (const homeEquipment of EQUIPMENT) {
                count += 1;
                const label = `${person_.name}/${goalType}/${experienceLevel}/${days}/${minutes}/${homeEquipment.length}`;
                const result = generateTrainingPlan(
                  person({
                    goalType,
                    discipline: goalType === 'endurance' ? '10k' : null,
                    experienceLevel,
                    birthDate: person_.birthDate,
                    healthScreening: person_.screening,
                    sex: person_.sex,
                    homeEquipment,
                    schedule: {
                      mode: 'flex',
                      slots: Array.from({ length: days }, () => ({
                        kind: 'strength_home' as const,
                        minutes,
                      })),
                    },
                  }),
                  library,
                  MONDAY,
                );
                if (!result.ok) {
                  violations.push(`${label}: ${result.error}`);
                  continue;
                }
                const p = result.plan;
                if (!(p.template_id ?? '').endsWith('-koerpergewicht'))
                  violations.push(`${label}: Vorlage ${p.template_id}`);
                if (p.notes.includes('no_pull_exercise')) violations.push(`${label}: no_pull`);
                if (p.notes.includes('location_mismatch'))
                  violations.push(`${label}: location_mismatch`);
                const ids = p.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
                if (!ids.some((id) => pattern(id) === 'horizontal_pull'))
                  violations.push(`${label}: kein horizontal_pull`);
                if (!ids.some(isHip)) violations.push(`${label}: keine Hüft-Übung`);
                // Je Einheit (W7): ab 30 min jede Ganzkörper-/Unterkörper-Einheit mit Hüft-Übung und jede
                // Ganzkörper-/Oberkörper-Einheit mit Rudern; bei 20 min bleiben nur die ersten drei Übungen –
                // dann hat jede Ganzkörper-Einheit mindestens Hüftbeugen ODER Rudern.
                for (const s of p.sessions) {
                  const own = s.exercises.map((e) => e.exercise_id);
                  const hip = own.some(isHip);
                  const row = own.some((id) => pattern(id) === 'horizontal_pull');
                  if (minutes >= 30) {
                    if (s.focus !== 'upper' && !hip)
                      violations.push(`${label}: ${s.name_de} ohne Hüft-Übung`);
                    if (s.focus !== 'lower' && !row)
                      violations.push(`${label}: ${s.name_de} ohne Rudern`);
                  } else if (s.focus === 'full_body' && !hip && !row) {
                    violations.push(`${label}: ${s.name_de} ohne Hüft-Übung und Rudern`);
                  }
                }
                for (const id of new Set(ids)) {
                  const exercise = library.exercises.get(id);
                  if (exercise?.caution_tags.some((t) => person_.excluded.includes(t)))
                    violations.push(`${label}: gesperrt ${id}`);
                  if (exercise && exercise.equipment_ids.length > 0)
                    violations.push(`${label}: Gerät ${id}`);
                  if (/bauchlage/i.test(exercise?.name_de ?? ''))
                    violations.push(`${label}: Bauchlage ${id}`);
                }
              }
            }
          }
        }
      }
    }
    expect(count).toBe(PEOPLE.length * GOALS.length * 3 * 6 * 4 * EQUIPMENT.length);
    expect(violations).toEqual([]);
  }, 120_000);

  it('längere Budgets bekommen keine Extra-Sätze (A14): 240 min = Vorlagen-Umfang', () => {
    const p = generateTrainingPlan(
      person({
        schedule: {
          mode: 'flex',
          slots: [1, 2, 3].map(() => ({ kind: 'strength_home', minutes: 240 })),
        },
      }),
      library,
      MONDAY,
    );
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const template = library.templates.find((t) => t.id === p.plan.template_id);
    const templateSets = new Map(
      template?.sessions.map((s) => [s.day_index, s.exercises.reduce((n, e) => n + e.sets, 0)]),
    );
    for (const s of p.plan.sessions.filter((x) => !x.is_deload && !x.is_intro_week)) {
      const sets = s.exercises.reduce((n, e) => n + e.sets, 0);
      expect(sets).toBe(templateSets.get(s.template_day_index ?? 0));
    }
  });
});

describe('Zeitschnitt der Körpergewicht-Vorlagen (Wächter N1, N2)', () => {
  it('bei minutes_min behält jede Einheit Rumpf, Rudern (Ganz-/Oberkörper) und Hüftbeugen (Ganz-/Unterkörper)', () => {
    for (const flags of [[], ['pregnancy']] as const) {
      const rules = planSafetyRules(
        {
          experienceLevel: 'advanced',
          birthDate: '1990-01-01',
          healthScreening: { flags: [...flags] },
        },
        MONDAY,
      );
      for (const template of bodyweightTemplates) {
        const adapted = adaptTemplate(template, {
          library: library.exercises,
          profile: equipmentProfile('home', []),
          rules,
        });
        for (const s of adapted.sessions) {
          const ids = fitSessionToMinutes(s.exercises, template.minutes_min, library.exercises, {
            protectLastCore: true,
          }).exercises.map((e) => e.exercise_id);
          const label = `${flags.join()} ${template.id} ${s.name_de}`;
          expect(
            ids.some((id) => (pattern(id) ?? '').startsWith('core_')),
            label,
          ).toBe(true);
          if (s.focus !== 'lower') {
            expect(
              ids.some((id) => pattern(id) === 'horizontal_pull'),
              label,
            ).toBe(true);
          }
          if (s.focus !== 'upper') expect(ids.some(isHip), label).toBe(true);
        }
      }
    }
  });

  it('Folgeblock kürzt wie der erste Block (nextPlanBlock mit protectLastCore)', () => {
    const week = (wednesday: number): PlanInputsInput['schedule'] => ({
      mode: 'fixed',
      slots: [
        { weekday: 1, kind: 'strength_home', minutes: 45 },
        { weekday: 3, kind: 'strength_home', minutes: wednesday },
        { weekday: 5, kind: 'strength_home', minutes: 45 },
      ],
    });
    const inputs = (wednesday: number) =>
      person({ goalType: 'fat_loss', schedule: week(wednesday), homeEquipment: [] });
    // Block 1 mit 45 min am Mittwoch; danach kürzt die Person den Mittwoch auf 30 min (= minutes_min).
    const first = generateTrainingPlan(inputs(45), library, MONDAY);
    // Erwartung: so kürzt ein NEUER Plan mit 30 min am Mittwoch (erster Block, Engine-Version 3).
    const fresh = generateTrainingPlan(inputs(30), library, MONDAY);
    expect(first.ok && fresh.ok).toBe(true);
    if (!first.ok || !fresh.ok) return;
    expect(first.plan.template_id).toMatch(/-koerpergewicht$/);
    const wednesdayIds = (sessions: readonly GeneratedSession[]) =>
      sessions
        .filter((x) => isoWeekdayOf(x.scheduled_on) === 3 && x.week_no >= 1 && !x.is_deload)
        .map((x) => x.exercises.map((e) => e.exercise_id).join(','))[0];
    const next = (protectLastCore: boolean) =>
      nextPlanBlock(first.plan.sessions, {
        schedule: planInputsSchema.parse(inputs(30)).schedule,
        loadWeeks: first.plan.load_weeks,
        rules: first.plan.safety_rules,
        library: library.exercises,
        profiles: new Map([['home', equipmentProfile('home', [])]]),
        endurance: { goalType: 'fat_loss', discipline: null, experienceLevel: 'beginner' },
        previousStartGroup: first.plan.safety_rules.enduranceStartGroup,
        protectLastCore,
      });
    const expected = wednesdayIds(fresh.plan.sessions);
    expect(isBodyweightTemplateId(library, first.plan.template_id)).toBe(true);
    expect(wednesdayIds(next(true))).toBe(expected);
    expect(expected?.split(',').some((id) => (pattern(id) ?? '').startsWith('core_'))).toBe(true);
    // Gegenprobe: ohne die Option verliert der Folgeblock den Rumpf (genau das soll nie passieren).
    expect(wednesdayIds(next(false))).not.toBe(expected);
  });
});
