import { WORKOUT_LIMITS } from '../constants';
import type { ExerciseLookup } from '../content/analysis';
import { type ContentIssue, makeIssue } from '../content/rules';
import { findNutritionTextRuleHits } from '../content/text-rules';
import { findEquipment } from '../equipment';
import type { Workout } from './schema';
import { buildWorkoutTimerPlan, estimateWorkoutSeconds } from './timer';
import { wodTimeCapS } from './wod';

/**
 * Prüfregeln der Workouts (docs/PLAN-WORKOUTS.md Abschnitt 3). Eingabe ist ein per Zod geprüftes Workout (W1) und die
 * Übungsbibliothek (alle Übungen mit gültigem Schema). Rein und deterministisch; eingebunden in validateContent
 * (content:validate, ci, content-seed). Rot blockiert bei freigegebenen Workouts, gelb ist nur ein Hinweis.
 * - W2: Jede Übung existiert; ein freigegebenes Workout enthält nur freigegebene Übungen.
 * - W3: Geräte im Katalog und genau die Vereinigung der Geräte aller Übungen (Filter „ohne Geräte“ stimmt immer).
 * - W4: Format passt zur Belastungsart: Halte-/Zeitübungen nach Sekunden, Übungen mit Gewicht nach Wiederholungen.
 * - W5: Sicherheit: 1–2 Sterne nur leichte Übungen (Schwierigkeit ≤ 2, ohne „high_skill“) und mit Pausen (außer im
 *       Format `flow`, das ohne Pausen-Bildschirm läuft); 1 Stern ohne Sprünge („high_impact“).
 * - W6 (gelb): Angegebene Dauer passt zur geschätzten Dauer (±20 %, mindestens ±2 Minuten). WOD-Stil mit Zeitlimit
 *       (AMRAP, For Time, Chipper – wod.ts): `minutes` ist das Limit, gelb nur, wenn die Schätzung darüber liegt.
 * - W7: Textregeln (keine Heil-/Gesundheitsversprechen, keine Marken) wie bei Rezepten.
 */
export function checkWorkout(workout: Workout, library: ExerciseLookup): ContentIssue[] {
  const target = { kind: 'workout' as const, id: workout.id, status: workout.status };
  const issues: ContentIssue[] = [];
  const L = WORKOUT_LIMITS;

  // W2 – Übungen existieren (freigegeben nur mit freigegebenen)
  workout.exercises.forEach((item, i) => {
    const exercise = library.get(item.exercise_id);
    const path = `exercises.${i}.exercise_id`;
    if (!exercise) {
      issues.push(makeIssue('W2', target, `Übung „${item.exercise_id}“ gibt es nicht.`, path));
    } else if (workout.status === 'published' && exercise.status !== 'published') {
      issues.push(
        makeIssue(
          'W2',
          target,
          `Übung „${item.exercise_id}“ ist nicht freigegeben (${exercise.status}).`,
          path,
        ),
      );
    }
  });

  // W3 – Geräte
  workout.equipment_ids.forEach((id, i) => {
    if (!findEquipment(id)) {
      issues.push(
        makeIssue('W3', target, `Gerät „${id}“ gibt es nicht im Katalog.`, `equipment_ids.${i}`),
      );
    }
  });
  const needed = new Set(
    workout.exercises.flatMap((item) => library.get(item.exercise_id)?.equipment_ids ?? []),
  );
  const declared = new Set(workout.equipment_ids);
  const missing = [...needed].filter((id) => !declared.has(id)).sort();
  const extra = [...declared].filter((id) => !needed.has(id)).sort();
  if (missing.length > 0) {
    issues.push(
      makeIssue(
        'W3',
        target,
        `Geräte der Übungen fehlen in „equipment_ids“: ${missing.join(', ')}.`,
        'equipment_ids',
      ),
    );
  }
  if (extra.length > 0) {
    issues.push(
      makeIssue(
        'W3',
        target,
        `„equipment_ids“ nennt Geräte, die keine Übung braucht: ${extra.join(', ')}.`,
        'equipment_ids',
      ),
    );
  }

  // W4 – Belastungsart passt zum Format
  workout.exercises.forEach((item, i) => {
    const exercise = library.get(item.exercise_id);
    if (!exercise) return;
    if (exercise.load_type === 'time' && item.duration_s === null) {
      issues.push(
        makeIssue(
          'W4',
          target,
          `„${exercise.name_de}“ ist eine Zeitübung – bitte Sekunden (duration_s) statt Wiederholungen.`,
          `exercises.${i}.reps`,
        ),
      );
    }
    if (exercise.load_type === 'weight' && item.reps === null) {
      issues.push(
        makeIssue(
          'W4',
          target,
          `„${exercise.name_de}“ wird mit Gewicht gemacht – bitte Wiederholungen (reps) statt Sekunden.`,
          `exercises.${i}.duration_s`,
        ),
      );
    }
  });

  // W5 – Sicherheit: Sterne und Übungen, Pausen bei leichten Workouts
  if (workout.difficulty <= L.easyMaxStars) {
    workout.exercises.forEach((item, i) => {
      const exercise = library.get(item.exercise_id);
      const path = `exercises.${i}`;
      if (exercise && exercise.difficulty > L.easyMaxExerciseDifficulty) {
        issues.push(
          makeIssue(
            'W5',
            target,
            `${workout.difficulty} Stern(e): „${exercise.name_de}“ ist zu schwer (Schwierigkeit ${exercise.difficulty}).`,
            path,
          ),
        );
      }
      if (exercise?.caution_tags.includes('high_skill')) {
        issues.push(
          makeIssue(
            'W5',
            target,
            `${workout.difficulty} Stern(e): „${exercise.name_de}“ braucht viel Technik (high_skill).`,
            path,
          ),
        );
      }
      if (
        workout.difficulty <= L.noImpactMaxStars &&
        exercise?.caution_tags.includes('high_impact')
      ) {
        issues.push(
          makeIssue(
            'W5',
            target,
            `1 Stern: „${exercise.name_de}“ enthält Sprünge (high_impact).`,
            path,
          ),
        );
      }
      const last = i === workout.exercises.length - 1;
      // Flow (Sportarten Stufe 1): Pose für Pose ohne Pausen-Bildschirm – die Übergänge sind Teil des Ablaufs.
      const restApplies =
        workout.format === 'flow'
          ? false
          : workout.format === 'sets_reps'
            ? (item.sets ?? 1) > 1 || !last
            : !last;
      if (restApplies && item.rest_s < L.easyMinRestS) {
        issues.push(
          makeIssue(
            'W5',
            target,
            `${workout.difficulty} Stern(e): Pause mindestens ${L.easyMinRestS} s.`,
            `${path}.rest_s`,
          ),
        );
      }
    });
    if (workout.format !== 'flow' && workout.rounds > 1 && workout.round_rest_s < L.easyMinRestS) {
      issues.push(
        makeIssue(
          'W5',
          target,
          `${workout.difficulty} Stern(e): Pause zwischen den Runden mindestens ${L.easyMinRestS} s.`,
          'round_rest_s',
        ),
      );
    }
  }

  // W6 – Dauer plausibel (gelb)
  const estimatedS = estimateWorkoutSeconds(
    buildWorkoutTimerPlan(workout),
    (id) => library.get(id)?.unilateral === true,
  );
  const estimatedMin = estimatedS / 60;
  const tolerance = Math.max(
    L.durationTolerance.minMinutes,
    workout.minutes * L.durationTolerance.share,
  );
  const capped = wodTimeCapS(workout) !== null;
  const off = capped ? estimatedMin - workout.minutes : Math.abs(estimatedMin - workout.minutes);
  if (off > tolerance) {
    issues.push(
      makeIssue(
        'W6',
        target,
        `Angegeben ${workout.minutes} Min., geschätzt etwa ${Math.round(estimatedMin)} Min. – Dauer oder Ablauf anpassen.`,
        'minutes',
      ),
    );
  }

  // W7 – Textregeln
  const texts: [string, string][] = [
    ['title_de', workout.title_de],
    ['summary_de', workout.summary_de],
    ['warmup_de', workout.warmup_de],
    ['cooldown_de', workout.cooldown_de],
    ...workout.exercises.flatMap((item, i): [string, string][] =>
      item.note_de === null ? [] : [[`exercises.${i}.note_de`, item.note_de]],
    ),
  ];
  for (const [path, value] of texts) {
    for (const hit of findNutritionTextRuleHits(value)) {
      const what =
        hit.kind === 'brand'
          ? `Markenname „${hit.match}“ – Inhalte sind herstellerneutral`
          : `„${hit.match}“ (${hit.label}) – keine Heil- oder Gesundheitsversprechen`;
      issues.push(makeIssue('W7', target, `Text enthält ${what}.`, path));
    }
  }

  return issues;
}
