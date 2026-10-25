/**
 * Sicherheits-Sperren und Anzeige der Skill-Pfade (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.3/2.5): Muscle-up erst ab
 * 8 sauberen Klimmzügen + 10 Barren-Dips, Handstand/Hebel nicht für Einsteiger, ab 65, bei „Fit im Alter“ oder nach
 * auffälligem Gesundheits-Check; Schon-Modus sperrt belastende Stufen; „Nächste Stufe freigeschaltet“ nur ohne Sperre.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { painEffectOn, type PainEpisode } from '../modes/pain';
import { equipmentProfile } from '../plan/equipment-profile';
import { planSafetyRules } from '../plan/safety';
import { person, repoLibrary } from '../plan/test-library';
import { type SkillGateContext, skillStageGate } from './gates';
import { skillPathById } from './skill-paths';
import { entry, repSets, TODAY } from './test-helpers';
import { cleanSessionsToGo, skillPathView, skillPathViews, skillStepHint } from './view';

const library = repoLibrary().exercises;
const healthy = planSafetyRules(person({ experienceLevel: 'advanced' }), TODAY);

function ctx(overrides: Partial<SkillGateContext> = {}): SkillGateContext {
  return {
    library,
    experienceLevel: 'advanced',
    age: 30,
    rules: healthy,
    pain: null,
    profile: null,
    logs: [],
    today: TODAY,
    ...overrides,
  };
}

const path = (id: string) => skillPathById(id)!;
const indexOf = (pathId: string, exerciseId: string) =>
  path(pathId).stages.findIndex((s) => s.exerciseId === exerciseId);

/** 8 saubere Klimmzüge und 10 Barren-Dips in einem Satz. */
const MUSCLE_UP_READY = [
  entry('klimmzug', 3, repSets([8, 7, 6], 8)),
  entry('dips-barren', 3, repSets([10, 9, 8], 8)),
];

describe('Voraussetzungen (Muscle-up, Hebel)', () => {
  it('Muscle-up gesperrt mit 7 Klimmzügen; offen ab 8 Klimmzügen + 10 Dips', () => {
    const seven = [
      entry('klimmzug', 3, repSets([7, 7, 7])),
      entry('dips-barren', 3, repSets([12])),
    ];
    const locked = skillStageGate(path('muscle_up'), 0, ctx({ logs: seven }));
    expect(locked.allowed).toBe(false);
    expect(locked.reasons).toEqual(['requirement']);
    expect(locked.requirements).toEqual([
      { exerciseId: 'klimmzug', reps: 8, best: 7, met: false },
      { exerciseId: 'dips-barren', reps: 10, best: 12, met: true },
    ]);
    expect(skillStageGate(path('muscle_up'), 0, ctx({ logs: MUSCLE_UP_READY })).allowed).toBe(true);
  });

  it('nur 9 Dips → weiter gesperrt; Klimmzüge mit RPE 10 zählen nicht als sauber', () => {
    const logs = [entry('klimmzug', 3, repSets([9], 10)), entry('dips-barren', 3, repSets([9]))];
    const gate = skillStageGate(path('muscle_up'), 2, ctx({ logs }));
    expect(gate.requirements.map((r) => r.met)).toEqual([false, false]);
  });

  it('Front Lever ab 8 Klimmzügen, Back Lever ab 5 Klimmzügen + 5 Dips', () => {
    const logs = [entry('klimmzug', 3, repSets([6])), entry('dips-barren', 3, repSets([5]))];
    expect(skillStageGate(path('front_lever'), 0, ctx({ logs })).reasons).toEqual(['requirement']);
    expect(skillStageGate(path('back_lever'), 0, ctx({ logs })).allowed).toBe(true);
  });
});

describe('Sperren nach Person', () => {
  it('Einsteiger: Handstand an der Wand gesperrt (Erfahrung), Grundlagen-Stufen offen', () => {
    const beginner = planSafetyRules(person({ experienceLevel: 'beginner' }), TODAY);
    const c = ctx({ experienceLevel: 'beginner', rules: beginner });
    expect(
      skillStageGate(path('handstand'), indexOf('handstand', 'handstand-wand'), c).reasons,
    ).toContain('experience');
    expect(skillStageGate(path('klimmzug'), indexOf('klimmzug', 'klimmzug'), c).allowed).toBe(true);
    expect(skillStageGate(path('handstand'), 0, c).allowed).toBe(true);
  });

  it('ab 65: Stufen mit hoher Technik gesperrt (Plan-Regeln + Alter); 64 nicht', () => {
    const birth65 = addDays(TODAY, -Math.round(65.2 * 365.25));
    const rules65 = planSafetyRules(
      person({ experienceLevel: 'advanced', birthDate: birth65 }),
      TODAY,
    );
    const gate = skillStageGate(
      path('front_lever'),
      0,
      ctx({ age: 65, rules: rules65, logs: MUSCLE_UP_READY }),
    );
    expect(gate.reasons).toEqual(expect.arrayContaining(['safety_rules', 'age']));
    expect(
      skillStageGate(path('front_lever'), 0, ctx({ age: 64, logs: MUSCLE_UP_READY })).allowed,
    ).toBe(true);
  });

  it('„Fit im Alter“ und vorsichtiger Plan (ohne Gesundheits-Check) sperren Skills', () => {
    const aging = planSafetyRules(
      person({ experienceLevel: 'advanced', goalType: 'active_aging' }),
      TODAY,
    );
    const handstand = indexOf('handstand', 'handstand-frei');
    expect(skillStageGate(path('handstand'), handstand, ctx({ rules: aging })).reasons).toEqual(
      expect.arrayContaining(['safety_rules', 'age']),
    );
    const noCheck = planSafetyRules(
      person({ experienceLevel: 'advanced', healthScreening: null }),
      TODAY,
    );
    expect(skillStageGate(path('handstand'), handstand, ctx({ rules: noCheck })).reasons).toEqual(
      expect.arrayContaining(['safety_rules', 'health_check']),
    );
  });

  it('Schon-Modus: Handgelenk sperrt Handstand und L-Sitz, nicht die Kniebeuge; endet automatisch', () => {
    const episode: PainEpisode = {
      id: '55555555-5555-4555-8555-555555555555',
      region: 'wrist',
      intensity: 'moderate',
      duration_days: 3,
      started_on: TODAY,
      ended_early_on: null,
      created_at: `${TODAY}T08:00:00Z`,
    };
    const pain = painEffectOn([episode], TODAY);
    const c = ctx({ pain });
    expect(
      skillStageGate(path('handstand'), indexOf('handstand', 'handstand-wand'), c).reasons,
    ).toContain('pain');
    expect(skillStageGate(path('rumpf'), indexOf('rumpf', 'l-sitz'), c).reasons).toContain('pain');
    expect(skillStageGate(path('kniebeuge'), 0, c).allowed).toBe(true);
    expect(painEffectOn([episode], addDays(TODAY, 3))).toBeNull();
  });

  it('Geräte: ohne Barren sind Barren-Dips nicht machbar (nur Hinweis), Park bringt Barren mit', () => {
    const none = equipmentProfile('home', []);
    const park = equipmentProfile('home', [{ equipmentId: 'calisthenics_park', weightsKg: [] }]);
    const dips = indexOf('dips', 'dips-barren');
    expect(skillStageGate(path('dips'), dips, ctx({ profile: none })).reasons).toEqual([
      'equipment',
    ]);
    expect(skillStageGate(path('dips'), dips, ctx({ profile: park })).allowed).toBe(true);
  });

  it('Übung fehlt in der Bibliothek (Supabase vor der Freigabe) → missing_content', () => {
    const published = new Map([...library].filter(([, e]) => e.status === 'published'));
    const gate = skillStageGate(
      path('klimmzug'),
      indexOf('klimmzug', 'archer-klimmzug'),
      ctx({
        library: published,
      }),
    );
    expect(gate.reasons[0]).toBe('missing_content');
  });
});

describe('skillPathView', () => {
  it('ohne Einträge: Stufe 1 aktuell, nicht begonnen, kein Vorschlag', () => {
    const view = skillPathView(path('klimmzug'), ctx());
    expect(view).toMatchObject({ currentIndex: 0, started: false, suggestion: null });
    expect(view.stages.map((s) => s.role)).toEqual([
      'current',
      'next',
      'later',
      'later',
      'later',
      'later',
      'later',
    ]);
    expect(view.stages[0]?.nameDe).toBe('Toter Hang');
  });

  it('aktuelle Stufe = höchste mit Eintrag; zweimal 3 × 8 sauber → Archer freigeschaltet', () => {
    const logs = [
      entry('klimmzug-band-unterstuetzt', 20, repSets([8, 8, 8])),
      entry('klimmzug', 4, repSets([8, 8, 8], 8)),
      entry('klimmzug', 1, repSets([9, 8, 8], 7)),
    ];
    const view = skillPathView(path('klimmzug'), ctx({ logs }));
    expect(view.currentIndex).toBe(indexOf('klimmzug', 'klimmzug'));
    expect(view.suggestion).toBe('advance');
    expect(view.stages[view.currentIndex + 1]?.role).toBe('next');
    expect(cleanSessionsToGo(view.stages[view.currentIndex]?.progress ?? null)).toBe(0);
  });

  it('Ziel erreicht, aber nächste Stufe gesperrt (Einsteiger) → „blocked“', () => {
    const beginner = planSafetyRules(person({ experienceLevel: 'beginner' }), TODAY);
    const logs = [
      entry('klimmzug', 4, repSets([8, 8, 8])),
      entry('klimmzug', 1, repSets([8, 8, 8])),
    ];
    const view = skillPathView(
      path('klimmzug'),
      ctx({ logs, experienceLevel: 'beginner', rules: beginner }),
    );
    expect(view.suggestion).toBe('blocked');
    expect(view.stages[view.currentIndex + 1]?.gate.reasons).toContain('experience');
  });

  it('letzte Stufe sauber → „mastered“; dreimal verfehlt → „regress“', () => {
    const last = path('rudern').stages.at(-1)!.exerciseId;
    const mastered = [entry(last, 4, repSets([10, 10, 10])), entry(last, 1, repSets([12, 10, 10]))];
    expect(skillPathView(path('rudern'), ctx({ logs: mastered })).suggestion).toBe('mastered');
    const misses = [
      entry('australian-pull-up', 6, repSets([3])),
      entry('australian-pull-up', 4, repSets([4])),
      entry('australian-pull-up', 2, repSets([2])),
    ];
    expect(skillPathView(path('rudern'), ctx({ logs: misses })).suggestion).toBe('regress');
  });

  it('alle Pfade auf einmal, deterministisch', () => {
    const a = skillPathViews(ctx());
    expect(a.map((v) => v.pathId)).toHaveLength(10);
    expect(skillPathViews(ctx())).toEqual(a);
  });
});

describe('skillStepHint (Hinweis im Training)', () => {
  const clean = [
    entry('liegestuetz', 4, repSets([10, 10, 10])),
    entry('liegestuetz', 1, repSets([11, 10, 10])),
  ];

  it('„Nächste Stufe freigeschaltet“ mit Name der Stufe', () => {
    expect(skillStepHint('liegestuetz', ctx({ logs: clean }))).toEqual({
      kind: 'unlocked',
      pathId: 'liegestuetz',
      exerciseId: 'diamant-liegestuetz',
      nameDe: 'Diamant-Liegestütz',
    });
  });

  it('kein Hinweis nach nur einer sauberen Einheit oder wenn die nächste Stufe schon geübt wird', () => {
    expect(skillStepHint('liegestuetz', ctx({ logs: clean.slice(1) }))).toBeNull();
    const already = [...clean, entry('diamant-liegestuetz', 0, repSets([6]))];
    expect(skillStepHint('liegestuetz', ctx({ logs: already }))).toBeNull();
  });

  it('kein Hinweis, wenn die nächste Stufe gesperrt ist (Muscle-up ohne Voraussetzungen)', () => {
    const explosive = [
      entry('explosiver-klimmzug', 4, repSets([5, 5, 5])),
      entry('explosiver-klimmzug', 1, repSets([5, 5, 5])),
    ];
    expect(skillStepHint('explosiver-klimmzug', ctx({ logs: explosive }))).toBeNull();
    expect(
      skillStepHint('explosiver-klimmzug', ctx({ logs: [...explosive, ...MUSCLE_UP_READY] })),
    ).toMatchObject({ kind: 'unlocked', exerciseId: 'muscle-up-negativ' });
  });

  it('dreimal deutlich verfehlt → „Vorige Stufe üben“ (neutral, kein Zwang)', () => {
    const misses = [
      entry('klimmzug', 6, repSets([3, 2])),
      entry('klimmzug', 4, repSets([4, 2])),
      entry('klimmzug', 2, repSets([2, 1])),
    ];
    expect(skillStepHint('klimmzug', ctx({ logs: misses }))).toMatchObject({
      kind: 'step_back',
      exerciseId: 'klimmzug-band-unterstuetzt',
    });
  });

  it('Übung ohne Skill-Pfad → kein Hinweis', () => {
    expect(skillStepHint('bankdruecken-langhantel', ctx({ logs: clean }))).toBeNull();
  });
});
