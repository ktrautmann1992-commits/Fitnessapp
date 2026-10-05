import {
  LARGE_MUSCLE_GROUPS,
  REST_RANGES_S,
  SMALL_MUSCLE_GROUPS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import type { MovementPattern, MuscleGroup } from '../enums';
import { findEquipment, isHomeSelectable } from '../equipment';
import {
  estimateSessionMinutes,
  type ExerciseLookup,
  isPushPullBalanced,
  pushPullSets,
  sessionDurationWindow,
  weeklySetRange,
  weeklySetsByMuscle,
} from './analysis';
import { type ContentIssue, makeIssue } from './rules';
import type { Exercise, PlanTemplate, TemplateExercise } from './schemas';
import { findTextRuleHits } from './text-rules';

/**
 * Plausibilitäts-Checks für Übungen (Ü2–Ü6) und Plan-Vorlagen (V1–V11). Eingabe sind bereits per Zod
 * geprüfte Inhalte (Ü1). Alle Funktionen sind rein und deterministisch.
 */

const MUSCLE_NAMES_DE: Record<MuscleGroup, string> = {
  chest: 'Brust',
  lats: 'Latissimus',
  upper_back: 'oberer Rücken',
  front_delts: 'vordere Schulter',
  side_delts: 'seitliche Schulter',
  rear_delts: 'hintere Schulter',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'gerade Bauchmuskeln',
  obliques: 'schräge Bauchmuskeln',
  lower_back: 'unterer Rücken',
  glutes: 'Gesäß',
  quadriceps: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  adductors: 'Adduktoren',
  calves: 'Waden',
};

/** Deutsche Anzeige einer Muskelgruppe (Prüfbericht, später Admin-Bereich). */
export function muscleNameDe(muscle: MuscleGroup): string {
  return MUSCLE_NAMES_DE[muscle];
}

const formatNumber = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });

// ---------------------------------------------------------------------------------------------------------
// Ü6 – Textregeln
// ---------------------------------------------------------------------------------------------------------

/** Alle Textfelder einer Übung mit Pfad. */
function exerciseTexts(exercise: Exercise): [string, string][] {
  return [
    ['name_de', exercise.name_de],
    ['name_en', exercise.name_en],
    ...exercise.aliases_de.map((t, i): [string, string] => [`aliases_de.${i}`, t]),
    ['description_de', exercise.description_de],
    ...exercise.steps_de.map((t, i): [string, string] => [`steps_de.${i}`, t]),
    ...exercise.tips_de.map((t, i): [string, string] => [`tips_de.${i}`, t]),
    ...exercise.common_mistakes_de.map((t, i): [string, string] => [`common_mistakes_de.${i}`, t]),
    ['safety_note_de', exercise.safety_note_de],
  ];
}

/** Alle Textfelder einer Vorlage mit Pfad. */
function templateTexts(template: PlanTemplate): [string, string][] {
  const texts: [string, string][] = [
    ['title_de', template.title_de],
    ['description_de', template.description_de],
  ];
  template.sessions.forEach((session, s) => {
    texts.push([`sessions.${s}.name_de`, session.name_de]);
    texts.push([`sessions.${s}.warmup_de`, session.warmup_de]);
    texts.push([`sessions.${s}.cooldown_de`, session.cooldown_de]);
    session.exercises.forEach((item, e) => {
      if (item.notes_de !== null) {
        texts.push([`sessions.${s}.exercises.${e}.notes_de`, item.notes_de]);
      }
    });
  });
  return texts;
}

function textRuleIssues(
  target: Parameters<typeof makeIssue>[1],
  texts: [string, string][],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const [path, value] of texts) {
    for (const hit of findTextRuleHits(value)) {
      const what =
        hit.kind === 'brand'
          ? `Markenname „${hit.match}“ – Inhalte sind herstellerneutral`
          : `„${hit.match}“ (${hit.label}) – keine Heilversprechen oder medizinischen Aussagen`;
      issues.push(makeIssue('Ü6', target, `Text enthält ${what}.`, path));
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// Übungen: Ü2–Ü4, Ü6 je Übung, Ü5 für die ganze Bibliothek
// ---------------------------------------------------------------------------------------------------------

/** Prüft eine Übung gegen die Bibliothek (alle Übungen, die ein gültiges Schema haben). */
export function checkExercise(exercise: Exercise, library: ExerciseLookup): ContentIssue[] {
  const target = { kind: 'exercise' as const, id: exercise.id, status: exercise.status };
  const issues: ContentIssue[] = [];

  exercise.equipment_ids.forEach((equipmentId, i) => {
    if (!findEquipment(equipmentId)) {
      issues.push(
        makeIssue(
          'Ü2',
          target,
          `Gerät „${equipmentId}“ gibt es nicht im Katalog.`,
          `equipment_ids.${i}`,
        ),
      );
    }
  });

  const seen = new Set<string>();
  exercise.alternatives.forEach((alternative, i) => {
    const path = `alternatives.${i}.alternative_id`;
    const otherId = alternative.alternative_id;
    if (otherId === exercise.id) {
      issues.push(
        makeIssue('Ü3', target, 'Die Übung ist als ihre eigene Alternative eingetragen.', path),
      );
      return;
    }
    if (seen.has(otherId)) {
      issues.push(
        makeIssue('Ü3', target, `Alternative „${otherId}“ ist doppelt eingetragen.`, path),
      );
      return;
    }
    seen.add(otherId);
    const other = library.get(otherId);
    if (!other) {
      issues.push(makeIssue('Ü3', target, `Alternative „${otherId}“ gibt es nicht.`, path));
      return;
    }
    if (other.movement_pattern !== exercise.movement_pattern) {
      issues.push(
        makeIssue(
          'Ü4',
          target,
          `Alternative „${otherId}“ hat ein anderes Bewegungsmuster (${other.movement_pattern} statt ${exercise.movement_pattern}).`,
          path,
        ),
      );
    }
  });

  issues.push(...textRuleIssues(target, exerciseTexts(exercise)));
  return issues;
}

/** true = Übung braucht keine Geräte oder nur Widerstandsbänder. */
export function isBodyweightOrBandOnly(exercise: Pick<Exercise, 'equipment_ids'>): boolean {
  return exercise.equipment_ids.every((id) => id === 'resistance_bands');
}

/**
 * true = Körpergewicht-Vorlage: Zuhause und weder Pflicht- noch Optional-Geräte (docs/PLAN-KOERPERGEWICHT.md §4).
 */
export function isBodyweightTemplate(
  template: Pick<PlanTemplate, 'location' | 'required_equipment_ids' | 'optional_equipment_ids'>,
): boolean {
  return (
    template.location === 'home' &&
    template.required_equipment_ids.length === 0 &&
    template.optional_equipment_ids.length === 0
  );
}

/**
 * Ü5 (gelb): Jedes Bewegungsmuster, das in der Bibliothek vorkommt, braucht mindestens eine Variante ohne
 * Geräte oder nur mit Band. Zurückgezogene Übungen zählen nicht.
 */
export function checkLibraryCoverage(exercises: readonly Exercise[]): ContentIssue[] {
  const active = exercises.filter((exercise) => exercise.status !== 'archived');
  const patterns = [...new Set(active.map((exercise) => exercise.movement_pattern))].sort();
  return patterns
    .filter(
      (pattern) =>
        !active.some((ex) => ex.movement_pattern === pattern && isBodyweightOrBandOnly(ex)),
    )
    .map((pattern: MovementPattern) =>
      makeIssue(
        'Ü5',
        { kind: 'library', id: pattern, status: null },
        `Bewegungsmuster „${pattern}“ hat keine Variante ohne Geräte oder nur mit Band.`,
      ),
    );
}

// ---------------------------------------------------------------------------------------------------------
// Plan-Vorlagen: V1–V11 (+ Ü6 für die Texte der Vorlage)
// ---------------------------------------------------------------------------------------------------------

/** Hinweise auf Maximaltests in Notizen (V4): 1RM, Maximalversuch, bis zum Versagen, AMRAP … */
const MAX_TEST_PATTERN =
  /(?<![\p{L}\p{N}])(?:1\s*rm|one[\s-]*rep[\s-]*max|maximal(?:versuch|test|kraftt?est)|amrap)(?![\p{L}\p{N}])|bis\s+zum\s+(?:muskel)?versagen/iu;

/** true = mit den Geräten in `allowed` machbar (Körpergewicht immer). */
function feasibleWith(exercise: Exercise, allowed: ReadonlySet<string>): boolean {
  return exercise.equipment_ids.every((id) => allowed.has(id));
}

function dosageIssues(
  template: PlanTemplate,
  item: TemplateExercise,
  exercise: Exercise | undefined,
  target: Parameters<typeof makeIssue>[1],
  path: string,
): ContentIssue[] {
  const L = TEMPLATE_DOSAGE_LIMITS;
  const issues: ContentIssue[] = [];
  const v4 = (message: string, field: string) =>
    issues.push(makeIssue('V4', target, message, `${path}.${field}`));

  if (item.sets < L.sets.min || item.sets > L.sets.max) {
    v4(`${item.sets} Sätze – erlaubt sind ${L.sets.min}–${L.sets.max}.`, 'sets');
  }
  if (item.reps_min !== null && item.reps_min < L.reps.min) {
    v4(`Mindestens ${L.reps.min} Wiederholungen (keine Maximaltests).`, 'reps_min');
  }
  if (item.reps_max !== null && item.reps_max > L.reps.max) {
    v4(`Höchstens ${L.reps.max} Wiederholungen.`, 'reps_max');
  }
  if (
    item.duration_s !== null &&
    (item.duration_s < L.durationS.min || item.duration_s > L.durationS.max)
  ) {
    v4(
      `Dauer ${item.duration_s} s – erlaubt sind ${L.durationS.min}–${L.durationS.max} s.`,
      'duration_s',
    );
  }
  if (item.rpe_target < L.rpe.min || item.rpe_target > L.rpe.max) {
    v4(
      `RPE ${formatNumber(item.rpe_target)} – erlaubt sind ${L.rpe.min}–${L.rpe.max} (RPE 10 = Maximaltest).`,
      'rpe_target',
    );
  } else if (template.experience_level === 'beginner' && item.rpe_target > L.beginnerRpeMax) {
    v4(`Einsteiger: RPE höchstens ${L.beginnerRpeMax}.`, 'rpe_target');
  }
  if (item.notes_de !== null && MAX_TEST_PATTERN.test(item.notes_de)) {
    v4('Notiz verlangt einen Maximaltest (1RM, Maximalversuch, bis zum Versagen).', 'notes_de');
  }
  if (exercise?.load_type === 'time' && item.duration_s === null) {
    v4('Halteübung: Dauer (duration_s) statt Wiederholungen angeben.', 'duration_s');
  }
  return issues;
}

function restIssue(
  rest: number,
  mechanics: 'compound' | 'isolation',
  target: Parameters<typeof makeIssue>[1],
  path: string,
  label: string,
): ContentIssue[] {
  const range = REST_RANGES_S[mechanics];
  if (rest >= range.min && rest <= range.max) {
    return [];
  }
  const kind = mechanics === 'compound' ? 'Grundübung' : 'Isolationsübung';
  return [
    makeIssue(
      'V5',
      target,
      `${label}: Pause ${rest} s – empfohlen für ${kind} ${range.min}–${range.max} s.`,
      path,
    ),
  ];
}

/**
 * Prüft eine Plan-Vorlage. `exercises` = alle Übungen mit gültigem Schema (jeder Status).
 */
export function checkPlanTemplate(
  template: PlanTemplate,
  exercises: ExerciseLookup,
): ContentIssue[] {
  const target = { kind: 'plan_template' as const, id: template.id, status: template.status };
  const issues: ContentIssue[] = [];

  // V1 – Einheiten, day_index, Übungen vorhanden
  if (template.sessions.length !== template.sessions_per_week) {
    issues.push(
      makeIssue(
        'V1',
        target,
        `${template.sessions.length} Einheiten, aber ${template.sessions_per_week} Tage pro Woche.`,
        'sessions',
      ),
    );
  }
  const dayIndexes = template.sessions.map((s) => s.day_index).sort((a, b) => a - b);
  const expectedDays = template.sessions.map((_, i) => i + 1);
  if (dayIndexes.join(',') !== expectedDays.join(',')) {
    issues.push(
      makeIssue(
        'V1',
        target,
        `day_index muss 1…${template.sessions.length} lückenlos und eindeutig sein.`,
        'sessions',
      ),
    );
  }

  // V2 – Geräte der Vorlage
  const allowed = new Set([...template.required_equipment_ids, ...template.optional_equipment_ids]);
  for (const [field, ids] of [
    ['required_equipment_ids', template.required_equipment_ids],
    ['optional_equipment_ids', template.optional_equipment_ids],
  ] as const) {
    ids.forEach((equipmentId, i) => {
      if (!findEquipment(equipmentId)) {
        issues.push(
          makeIssue(
            'V2',
            target,
            `Gerät „${equipmentId}“ gibt es nicht im Katalog.`,
            `${field}.${i}`,
          ),
        );
      } else if (template.location === 'home' && !isHomeSelectable(equipmentId)) {
        issues.push(
          makeIssue(
            'V2',
            target,
            `„${equipmentId}“ ist ein Studio-Gerät – nicht in einer Zuhause-Vorlage.`,
            `${field}.${i}`,
          ),
        );
      }
    });
  }

  // V12 – Körpergewicht-Vorlage: Zuhause ohne Pflicht- und Optional-Geräte → nur Übungen ohne Geräte
  // (V2 allein lässt Übungen mit Geräten durch, wenn eine Alternative machbar ist; docs/PLAN-KOERPERGEWICHT.md A1).
  const bodyweightTemplate = isBodyweightTemplate(template);

  template.sessions.forEach((session, s) => {
    const sessionPath = `sessions.${s}`;
    if (session.exercises.length > TEMPLATE_DOSAGE_LIMITS.maxExercisesPerSession) {
      issues.push(
        makeIssue(
          'V8',
          target,
          `„${session.name_de}“: ${session.exercises.length} Übungen – höchstens ${TEMPLATE_DOSAGE_LIMITS.maxExercisesPerSession}.`,
          `${sessionPath}.exercises`,
        ),
      );
    }

    const supersets = new Map<string, { rest: number; compound: boolean; path: string }>();
    session.exercises.forEach((item, e) => {
      const path = `${sessionPath}.exercises.${e}`;
      const exercise = exercises.get(item.exercise_id);
      if (!exercise) {
        issues.push(
          makeIssue(
            'V1',
            target,
            `Übung „${item.exercise_id}“ gibt es nicht.`,
            `${path}.exercise_id`,
          ),
        );
      } else {
        if (template.status === 'published' && exercise.status !== 'published') {
          issues.push(
            makeIssue(
              'V3',
              target,
              `Übung „${item.exercise_id}“ ist nicht freigegeben (Status ${exercise.status}).`,
              `${path}.exercise_id`,
            ),
          );
        }
        if (bodyweightTemplate && exercise.equipment_ids.length > 0) {
          issues.push(
            makeIssue(
              'V12',
              target,
              `Übung „${item.exercise_id}“ braucht Geräte (${exercise.equipment_ids.join(', ')}) – eine Körpergewicht-Vorlage darf nur Übungen ohne Geräte enthalten.`,
              `${path}.exercise_id`,
            ),
          );
        }
        if (
          template.location === 'home' &&
          !feasibleWith(exercise, allowed) &&
          !exercise.alternatives.some((alternative) => {
            const other = exercises.get(alternative.alternative_id);
            return other !== undefined && feasibleWith(other, allowed);
          })
        ) {
          issues.push(
            makeIssue(
              'V2',
              target,
              `Übung „${item.exercise_id}“ braucht Geräte außerhalb der Vorlage (${exercise.equipment_ids.join(', ')}) und hat keine machbare Alternative.`,
              `${path}.exercise_id`,
            ),
          );
        }
        if (item.superset_group === null) {
          issues.push(
            ...restIssue(
              item.rest_s,
              exercise.mechanics,
              target,
              `${path}.rest_s`,
              exercise.name_de,
            ),
          );
        } else {
          const group = supersets.get(item.superset_group) ?? {
            rest: 0,
            compound: false,
            path: `${path}.rest_s`,
          };
          group.rest += item.rest_s;
          group.compound ||= exercise.mechanics === 'compound';
          group.path = `${path}.rest_s`;
          supersets.set(item.superset_group, group);
        }
      }
      issues.push(...dosageIssues(template, item, exercise, target, path));
    });
    for (const [name, group] of supersets) {
      issues.push(
        ...restIssue(
          group.rest,
          group.compound ? 'compound' : 'isolation',
          target,
          group.path,
          `Supersatz ${name}`,
        ),
      );
    }

    // V6 – geschätzte Dauer
    const minutes = estimateSessionMinutes(session);
    const window = sessionDurationWindow(template);
    if (minutes < window.min || minutes > window.max) {
      issues.push(
        makeIssue(
          'V6',
          target,
          `„${session.name_de}“: geschätzt ${minutes} min – Vorlage ${template.minutes_min}–${template.minutes_max} min (±15 %: ${formatNumber(window.min)}–${formatNumber(window.max)}).`,
          sessionPath,
        ),
      );
    }
  });

  // V7 – Drücken : Ziehen
  const balance = pushPullSets(template, exercises);
  if (!isPushPullBalanced(balance)) {
    issues.push(
      makeIssue(
        'V7',
        target,
        `Drücken ${balance.push} Sätze : Ziehen ${balance.pull} Sätze pro Woche – mehr als 30 % Unterschied.`,
        'sessions',
      ),
    );
  }

  // V9–V11 – Wochensätze pro Muskelgruppe
  const sets = weeklySetsByMuscle(template, exercises);
  const range = weeklySetRange(template);
  for (const [muscle, value] of Object.entries(sets) as [MuscleGroup, number][]) {
    const name = muscleNameDe(muscle);
    if (value > range.max) {
      issues.push(
        makeIssue(
          'V9',
          target,
          `${name}: ${formatNumber(value)} Wochensätze – höchstens ${range.max}.`,
          'sessions',
        ),
      );
    } else if (value < range.min && (LARGE_MUSCLE_GROUPS as readonly string[]).includes(muscle)) {
      issues.push(
        makeIssue(
          'V10',
          target,
          `${name}: ${formatNumber(value)} Wochensätze – mindestens ${range.min}.`,
          'sessions',
        ),
      );
    } else if (value < range.min && (SMALL_MUSCLE_GROUPS as readonly string[]).includes(muscle)) {
      issues.push(
        makeIssue(
          'V11',
          target,
          `${name}: ${formatNumber(value)} Wochensätze – empfohlen mindestens ${range.min}.`,
          'sessions',
        ),
      );
    }
  }

  issues.push(...textRuleIssues(target, templateTexts(template)));
  return issues;
}
