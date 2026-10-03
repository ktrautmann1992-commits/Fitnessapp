import { describe, expect, it } from 'vitest';

import type { ContentRuleId } from './rules';
import {
  checkExercise,
  checkLibraryCoverage,
  checkPlanTemplate,
  isBodyweightOrBandOnly,
  muscleNameDe,
} from './checks';
import type { Exercise, PlanTemplate, TemplateExercise } from './schemas';
import { item, LIBRARY, libraryMap, makeExercise, makeTemplate } from './test-fixtures';

const lib = libraryMap();
const rules = (issues: { rule: ContentRuleId }[]) => issues.map((issue) => issue.rule);

/** Vorlage, in der eine Übung (Einheit s, Position e) verändert ist. */
function withItem(
  patch: Partial<TemplateExercise>,
  s = 0,
  e = 0,
  base: PlanTemplate = makeTemplate(),
): PlanTemplate {
  return {
    ...base,
    sessions: base.sessions.map((session, si) =>
      si !== s
        ? session
        : {
            ...session,
            exercises: session.exercises.map((x, ei) => (ei === e ? { ...x, ...patch } : x)),
          },
    ),
  };
}

describe('checkExercise (Ü2, Ü3, Ü4, Ü6)', () => {
  const goblet = makeExercise({ id: 'goblet', equipment_ids: ['dumbbells'] });
  const row = makeExercise({ id: 'rudern-x', movement_pattern: 'horizontal_pull' });
  const library = libraryMap([goblet, row]);

  it('gültige Übung ohne Befund', () => {
    const squat = makeExercise({
      alternatives: [{ alternative_id: 'goblet', reason: 'other_equipment', priority: 1 }],
    });
    expect(checkExercise(squat, library)).toEqual([]);
  });

  it('Ü2: Gerät nicht im Katalog', () => {
    const issues = checkExercise(
      makeExercise({ equipment_ids: ['barbell', 'hovercraft'] }),
      library,
    );
    expect(rules(issues)).toEqual(['Ü2']);
    expect(issues[0]?.path).toBe('equipment_ids.1');
    expect(issues[0]?.severity).toBe('error');
  });

  it('Ü3: Alternative fehlt, ist die Übung selbst oder doppelt', () => {
    const issues = checkExercise(
      makeExercise({
        alternatives: [
          { alternative_id: 'gibt-es-nicht', reason: 'easier', priority: 1 },
          { alternative_id: 'kniebeuge-test', reason: 'easier', priority: 2 },
          { alternative_id: 'goblet', reason: 'easier', priority: 3 },
          { alternative_id: 'goblet', reason: 'home', priority: 4 },
        ],
      }),
      libraryMap([goblet, makeExercise()]),
    );
    expect(rules(issues)).toEqual(['Ü3', 'Ü3', 'Ü3']);
    expect(issues.map((i) => i.message)).toEqual([
      'Alternative „gibt-es-nicht“ gibt es nicht.',
      'Die Übung ist als ihre eigene Alternative eingetragen.',
      'Alternative „goblet“ ist doppelt eingetragen.',
    ]);
  });

  it('Ü4: Alternative mit anderem Bewegungsmuster', () => {
    const issues = checkExercise(
      makeExercise({
        alternatives: [{ alternative_id: 'rudern-x', reason: 'easier', priority: 1 }],
      }),
      library,
    );
    expect(rules(issues)).toEqual(['Ü4']);
  });

  it('Ü6: Heilversprechen und Marken in jedem Textfeld', () => {
    const issues = checkExercise(
      makeExercise({
        tips_de: ['Gut für die Bandscheiben.'],
        steps_de: ['Füße hüftbreit stellen.', 'Am TRX festhalten und ziehen.'],
        safety_note_de: 'Garantiert ohne Risiko, wenn sauber ausgeführt.',
      }),
      library,
    );
    expect(rules(issues)).toEqual(['Ü6', 'Ü6', 'Ü6']);
    expect(issues.map((i) => i.path)).toEqual(['steps_de.1', 'tips_de.0', 'safety_note_de']);
  });
});

describe('checkLibraryCoverage (Ü5)', () => {
  it('Muster ohne Variante ohne Geräte/nur Band → gelb', () => {
    const issues = checkLibraryCoverage([
      makeExercise({ equipment_ids: ['barbell'] }),
      makeExercise({
        id: 'rudern-band',
        movement_pattern: 'horizontal_pull',
        equipment_ids: ['resistance_bands'],
      }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      rule: 'Ü5',
      severity: 'warning',
      kind: 'library',
      id: 'squat',
    });
  });

  it('zurückgezogene Übungen zählen nicht', () => {
    const issues = checkLibraryCoverage([
      makeExercise({ equipment_ids: ['barbell'] }),
      makeExercise({ id: 'kniebeuge-kg', equipment_ids: [], status: 'archived' }),
    ]);
    expect(rules(issues)).toEqual(['Ü5']);
    expect(checkLibraryCoverage([makeExercise({ status: 'archived' })])).toEqual([]);
  });

  it('Fixture-Bibliothek deckt alle Muster ab', () => {
    expect(checkLibraryCoverage(LIBRARY)).toEqual([]);
    expect(isBodyweightOrBandOnly({ equipment_ids: [] })).toBe(true);
    expect(isBodyweightOrBandOnly({ equipment_ids: ['resistance_bands'] })).toBe(true);
    expect(isBodyweightOrBandOnly({ equipment_ids: ['resistance_bands', 'pull_up_bar'] })).toBe(
      false,
    );
  });
});

describe('checkPlanTemplate', () => {
  it('Fixture-Vorlage erfüllt alle Regeln', () => {
    expect(checkPlanTemplate(makeTemplate(), lib)).toEqual([]);
  });

  describe('V1', () => {
    it('Anzahl Einheiten ≠ Tage pro Woche', () => {
      expect(rules(checkPlanTemplate(makeTemplate({ sessions_per_week: 4 }), lib))).toContain('V1');
    });

    it('day_index nicht lückenlos/eindeutig', () => {
      const template = makeTemplate();
      const sessions = template.sessions.map((s, i) => ({
        ...s,
        day_index: i === 2 ? 2 : s.day_index,
      }));
      expect(rules(checkPlanTemplate({ ...template, sessions }, lib))).toEqual(['V1']);
    });

    it('Übung existiert nicht', () => {
      const issues = checkPlanTemplate(withItem({ exercise_id: 'gibt-es-nicht' }), lib);
      expect(rules(issues)).toContain('V1');
      expect(issues.find((i) => i.rule === 'V1')?.path).toBe('sessions.0.exercises.0.exercise_id');
    });
  });

  describe('V2', () => {
    const dumbbellSquat = makeExercise({ id: 'kh-kniebeuge', equipment_ids: ['dumbbells'] });
    const benchSquat = makeExercise({
      id: 'bank-kniebeuge',
      equipment_ids: ['dumbbells', 'flat_bench'],
      alternatives: [{ alternative_id: 'kh-kniebeuge', reason: 'home', priority: 1 }],
    });
    const machine = makeExercise({ id: 'beinpresse-x', equipment_ids: ['leg_press'] });
    const homeLib = libraryMap([...LIBRARY, dumbbellSquat, benchSquat, machine]);
    const home = (patch: Partial<PlanTemplate> = {}) =>
      makeTemplate({
        location: 'home',
        required_equipment_ids: ['dumbbells', 'resistance_bands'],
        optional_equipment_ids: ['flat_bench'],
        ...patch,
      });

    it('Zuhause: Übungen mit Pflicht-/Optional-Geräten erlaubt', () => {
      expect(
        checkPlanTemplate(withItem({ exercise_id: 'kh-kniebeuge' }, 0, 0, home()), homeLib),
      ).toEqual([]);
      expect(
        checkPlanTemplate(withItem({ exercise_id: 'bank-kniebeuge' }, 0, 0, home()), homeLib),
      ).toEqual([]);
    });

    it('Zuhause: fremdes Gerät nur mit machbarer Alternative', () => {
      const noBench = home({ optional_equipment_ids: [] });
      // Bank fehlt, aber die Alternative (nur Kurzhanteln) ist machbar → in Ordnung.
      expect(
        checkPlanTemplate(withItem({ exercise_id: 'bank-kniebeuge' }, 0, 0, noBench), homeLib),
      ).toEqual([]);
      const issues = checkPlanTemplate(
        withItem({ exercise_id: 'beinpresse-x' }, 0, 0, home()),
        homeLib,
      );
      expect(rules(issues)).toEqual(['V2']);
    });

    it('Studio-Gerät in der Geräteliste einer Zuhause-Vorlage', () => {
      const issues = checkPlanTemplate(
        home({ optional_equipment_ids: ['cable_station'] }),
        homeLib,
      );
      expect(rules(issues)).toEqual(['V2']);
      expect(issues[0]?.path).toBe('optional_equipment_ids.0');
    });

    it('unbekanntes Gerät in der Geräteliste (auch Studio)', () => {
      expect(
        rules(checkPlanTemplate(makeTemplate({ required_equipment_ids: ['hovercraft'] }), lib)),
      ).toEqual(['V2']);
      // Studio-Vorlagen dürfen Studio-Geräte nutzen.
      expect(
        checkPlanTemplate(makeTemplate({ required_equipment_ids: ['cable_station'] }), lib),
      ).toEqual([]);
    });
  });

  it('V3: freigegebene Vorlage mit nicht freigegebener Übung', () => {
    const reviewed = { ...makeTemplate().meta, reviewed_by: 'KT', reviewed_at: '2026-10-03' };
    const published = makeTemplate({ status: 'published', meta: reviewed });
    const issues = checkPlanTemplate(published, lib);
    expect(rules(issues).every((r) => r === 'V3')).toBe(true);
    expect(issues).toHaveLength(published.sessions.flatMap((s) => s.exercises).length);
    const allPublished = libraryMap(LIBRARY.map((e): Exercise => ({ ...e, status: 'published' })));
    expect(checkPlanTemplate(published, allPublished)).toEqual([]);
    // Entwürfe dürfen Entwurfs-Übungen enthalten.
    expect(checkPlanTemplate(makeTemplate(), lib)).toEqual([]);
  });

  describe('V4', () => {
    it.each([
      [{ sets: 6 }, []],
      [{ sets: 7 }, ['V4']],
      [{ reps_min: 3, reps_max: 5 }, []],
      [{ reps_min: 2, reps_max: 5 }, ['V4']],
      [{ reps_min: 1, reps_max: 1 }, ['V4']],
      [{ reps_min: 20, reps_max: 30 }, []],
      [{ reps_min: 20, reps_max: 31 }, ['V4']],
      [{ rpe_target: 5 }, []],
      [{ rpe_target: 4.5 }, ['V4']],
      [{ rpe_target: 8 }, []],
      [{ rpe_target: 8.5 }, ['V4']],
      [{ rpe_target: 10 }, ['V4']],
      [{ notes_de: 'Letzter Satz als 1RM-Test.' }, ['V4']],
      [{ notes_de: 'Letzter Satz bis zum Muskelversagen.' }, ['V4']],
      [{ notes_de: 'AMRAP im letzten Satz.' }, ['V4']],
      [{ notes_de: 'Ruhige, saubere Wiederholungen.' }, []],
    ] as const)('%o → %o', (patch, expected) => {
      const issues = checkPlanTemplate(withItem(patch), lib).filter((i) => i.rule === 'V4');
      expect(rules(issues)).toEqual(expected);
    });

    it('Fortgeschrittene dürfen RPE 9, nicht 9,5', () => {
      const advanced = makeTemplate({ experience_level: 'advanced' });
      const v4 = (rpe: number) =>
        rules(checkPlanTemplate(withItem({ rpe_target: rpe }, 0, 0, advanced), lib)).filter(
          (r) => r === 'V4',
        );
      expect(v4(9)).toEqual([]);
      expect(v4(9.5)).toEqual(['V4']);
    });

    it('Halteübung: Dauer 10–120 s, Wiederholungen nicht erlaubt', () => {
      const plank = (patch: Partial<TemplateExercise>) =>
        rules(checkPlanTemplate(withItem(patch, 0, 7), lib)).filter((r) => r === 'V4');
      expect(plank({ duration_s: 10 })).toEqual([]);
      expect(plank({ duration_s: 9 })).toEqual(['V4']);
      expect(plank({ duration_s: 120 })).toEqual([]);
      expect(plank({ duration_s: 121 })).toEqual(['V4']);
      expect(plank({ duration_s: null, reps_min: 10, reps_max: 12 })).toEqual(['V4']);
    });
  });

  describe('V5 (gelb)', () => {
    it.each([
      [0, 90, []],
      [0, 89, ['V5']],
      [0, 240, []],
      [0, 241, ['V5']],
      [6, 45, []],
      [6, 44, ['V5']],
      [6, 120, []],
      [6, 121, ['V5']],
    ] as const)('Übung %i, Pause %i s → %o', (e, rest_s, expected) => {
      const issues = checkPlanTemplate(withItem({ rest_s }, 0, e), lib).filter(
        (i) => i.rule === 'V5',
      );
      expect(rules(issues)).toEqual(expected);
      expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    });

    it('Supersatz: Summe der Pausen der Gruppe zählt', () => {
      let template = withItem({ superset_group: 'A', rest_s: 30 }, 0, 6);
      template = withItem({ superset_group: 'A', rest_s: 30 }, 0, 7, template);
      expect(rules(checkPlanTemplate(template, lib)).filter((r) => r === 'V5')).toEqual([]);
      template = withItem({ superset_group: 'A', rest_s: 10 }, 0, 7, template);
      expect(rules(checkPlanTemplate(template, lib)).filter((r) => r === 'V5')).toEqual(['V5']);
      // Gruppe mit Grundübung → Bereich der Grundübung.
      template = withItem({ superset_group: 'B', rest_s: 0 }, 0, 0);
      template = withItem({ superset_group: 'B', rest_s: 120 }, 0, 1, template);
      expect(rules(checkPlanTemplate(template, lib)).filter((r) => r === 'V5')).toEqual([]);
    });
  });

  it('V6 (gelb): geschätzte Dauer außerhalb der Spanne ±15 %', () => {
    // Fixture: Einheiten ca. 36, 38 und 36 min. Fenster 45–60 → 38,25–69 → alle zu kurz.
    const issues = checkPlanTemplate(makeTemplate({ minutes_min: 45, minutes_max: 60 }), lib);
    expect(rules(issues)).toEqual(['V6', 'V6', 'V6']);
    expect(issues[0]?.message).toContain('geschätzt 36 min');
    // Obergrenze: 38 min bei Spanne 20–33 (max 37,95) → zu lang, bei 20–34 (max 39,1) in Ordnung.
    expect(
      rules(checkPlanTemplate(makeTemplate({ minutes_min: 20, minutes_max: 33 }), lib)),
    ).toEqual(['V6']);
    expect(checkPlanTemplate(makeTemplate({ minutes_min: 20, minutes_max: 34 }), lib)).toEqual([]);
  });

  it('V7 (gelb): Drücken und Ziehen unausgewogen', () => {
    // Rudern in allen Einheiten weg → Ziehen 3, Drücken 9.
    let template = makeTemplate();
    for (const s of [0, 1, 2]) {
      template = withItem({ exercise_id: 'kniebeuge' }, s, 2, template);
    }
    const issues = checkPlanTemplate(template, lib);
    expect(rules(issues)).toContain('V7');
    expect(issues.find((i) => i.rule === 'V7')?.severity).toBe('warning');
  });

  it('V8: höchstens 8 Übungen je Einheit', () => {
    const template = makeTemplate({ minutes_min: 30, minutes_max: 60 });
    const first = template.sessions[0]!;
    const nine = {
      ...first,
      exercises: [...first.exercises, item(9, 'seitheben', 1, { rest_s: 60 })],
    };
    const issues = checkPlanTemplate(
      { ...template, sessions: [nine, ...template.sessions.slice(1)] },
      lib,
    );
    expect(rules(issues)).toEqual(['V8']);
  });

  describe('V9–V11: Wochensätze pro Muskelgruppe', () => {
    it('V9 rot: Obergrenze überschritten (Gesäß 13 > 12)', () => {
      const issues = checkPlanTemplate(withItem({ sets: 3 }, 0, 0), lib);
      expect(rules(issues)).toEqual(['V9']);
      expect(issues[0]?.message).toBe('Gesäß: 13 Wochensätze – höchstens 12.');
    });

    it('Grenze genau erreicht ist erlaubt (Gesäß 12 = 12)', () => {
      expect(checkPlanTemplate(makeTemplate(), lib)).toEqual([]);
    });

    it('V10 rot: große Muskelgruppe unter der Untergrenze', () => {
      // Brustdrücken nur 1 Satz in Einheit 1 → Brust 5 < 6 (Fortgeschrittene: Untergrenze 6).
      const template = withItem({ sets: 1 }, 0, 1, makeTemplate({ experience_level: 'advanced' }));
      const issues = checkPlanTemplate(template, lib);
      expect(rules(issues)).toContain('V10');
      expect(issues.find((i) => i.rule === 'V10')?.message).toBe(
        'Brust: 5 Wochensätze – mindestens 6.',
      );
    });

    it('V11 gelb: kleine Muskelgruppe unter der Untergrenze', () => {
      // Wadenheben in Einheit 1 weg (ersetzt durch Seitheben) → Waden 2 < 4.
      const issues = checkPlanTemplate(withItem({ exercise_id: 'seitheben' }, 0, 6), lib);
      expect(rules(issues)).toContain('V11');
      expect(issues.find((i) => i.rule === 'V11')).toMatchObject({ severity: 'warning' });
      expect(issues.find((i) => i.rule === 'V11')?.message).toBe(
        'Waden: 2 Wochensätze – empfohlen mindestens 4.',
      );
    });

    it('übrige Gruppen (z. B. Unterarme 0) haben keine Untergrenze', () => {
      expect(rules(checkPlanTemplate(makeTemplate(), lib))).not.toContain('V11');
    });
  });

  it('Ü6 gilt auch für Texte der Vorlage', () => {
    const template = withItem({ notes_de: 'Wirkt wie eine Therapie.' });
    const issues = checkPlanTemplate(
      { ...template, description_de: 'Garantiert fit in vier Wochen, versprochen.' },
      lib,
    );
    expect(rules(issues)).toEqual(['Ü6', 'Ü6']);
    expect(issues.map((i) => i.path)).toEqual([
      'description_de',
      'sessions.0.exercises.0.notes_de',
    ]);
  });
});

describe('muscleNameDe', () => {
  it('deutsche Namen', () => {
    expect(muscleNameDe('hamstrings')).toBe('Beinbeuger');
    expect(muscleNameDe('upper_back')).toBe('oberer Rücken');
  });
});
