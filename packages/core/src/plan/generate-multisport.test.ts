/**
 * Rad und Triathlon (Etappe WP5) – Eigenschaftstest über den GANZEN Wettkampfplan (alle Blöcke): 10-%-Regel über die
 * SUMME aller Ausdauer-Minuten, Erholungsrhythmus, Plan = Ampel-Vorschau, Minuten je Disziplin (Koppeltraining zählt in
 * beide), Koppeltraining/Schwimmtechnik nur wo erlaubt, harte Einheiten (Sportart, Zahl, Abstand, 80/20, Phase),
 * Deckel der langen Einheit, Datenbank-Eingabe und Regeln je Person. Erwartungen UNABHÄNGIG hergeleitet (feste Zahlen
 * aus Plan 3.3–3.5 und 9), nicht aus constants.ts.
 */
import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import {
  competitionFeasibility,
  type CompetitionRequest,
  competitionVolumePreview,
} from './competition';
import { checkCompetitionSessions } from './competition-rules';
import type { CompetitionDiscipline } from './competition-schema';
import {
  chainViolations,
  enduranceByWeek,
  fixed,
  fullPlan,
  type Kind,
  library,
  rhythmViolations,
  runner,
  START,
} from './competition-test-helpers';
import { generateCompetitionPlan, generatedCompetitionPlanSchema } from './generate';
import { hardSeconds, type WorkoutStep } from './intensity';
import { sportMinutes } from './multisport';
import { savePlanSessionSchema, toSavePlanSession } from './payload';
import { planSafetyRules } from './safety';
import type { GeneratedSession } from './schedule';
import { MONDAY } from './test-library';

// Feste Werte (Plan 3.3–3.5, 9) – bewusst nicht aus constants.ts.
const HARD = ['fartlek', 'tempo', 'intervals', 'race_pace'];
const LONG_MAX = { cycling: 300, triathlon_sprint: 120, triathlon_olympic: 180 } as const;
const BRICK_MIN = 25;

const isHard = (s: GeneratedSession) =>
  s.kind === 'endurance' && HARD.includes(s.workout_type ?? '');
const isLegs = (s: GeneratedSession) =>
  s.kind === 'strength' && (s.focus === 'full_body' || s.focus === 'lower');

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const pick = <T>(r: () => number, values: readonly T[]): T =>
  values[Math.floor(r() * values.length)] as T;

type Multi = 'cycling' | 'triathlon_sprint' | 'triathlon_olympic';

/** Unabhängige Prüfung der Wochen (Rad/Triathlon). */
function weekViolations(
  sessions: readonly GeneratedSession[],
  discipline: Multi,
  rules: { hardAllowed: boolean; strict: boolean; minor: boolean },
): string[] {
  const errors: string[] = [];
  const byDate = new Map(sessions.map((s) => [s.scheduled_on, s]));
  const weeks = [...new Set(sessions.map((s) => startOfIsoWeek(s.scheduled_on)))].sort();
  const tri = discipline !== 'cycling';
  for (const monday of weeks) {
    const inWeek = sessions.filter((s) => startOfIsoWeek(s.scheduled_on) === monday);
    const endurance = inWeek.filter((s) => s.kind === 'endurance');
    const minutes = endurance.reduce((t, s) => t + s.estimated_minutes, 0);
    // Minuten je Disziplin: Summe = Ausdauer-Minuten der Woche (Koppeltraining zählt in beide, aber nur einmal).
    const per = sportMinutes(endurance);
    if (per.swim + per.bike + per.run !== minutes)
      errors.push(`${monday}: Summe je Disziplin ≠ Woche`);
    const phase = endurance[0]?.training_phase;
    for (const s of endurance) {
      if (!s.workout_type || !s.training_phase || !s.workout_steps) {
        errors.push(`${s.scheduled_on}: ohne Art/Phase/Schritte`);
        continue;
      }
      if (s.workout_steps.reduce((t, st) => t + st.seconds, 0) !== s.estimated_minutes * 60) {
        errors.push(`${s.scheduled_on}: Schritte ≠ Dauer`);
      }
      if (!tri && s.endurance_modality !== 'bike')
        errors.push(`${s.scheduled_on}: Rad-Plan nicht Rad`);
      if (s.estimated_minutes > LONG_MAX[discipline])
        errors.push(`${s.scheduled_on}: über dem Deckel`);
      if (s.workout_type === 'brick') {
        if (!tri) errors.push(`${s.scheduled_on}: Koppeltraining beim Rad`);
        if (s.endurance_modality !== 'bike')
          errors.push(`${s.scheduled_on}: Koppeltraining nicht Rad`);
        if (!['build', 'peak'].includes(s.training_phase) || s.is_deload || s.week_no === 0) {
          errors.push(`${s.scheduled_on}: Koppeltraining in ${s.training_phase}/Erholung/Woche 0`);
        }
        if (s.estimated_minutes < BRICK_MIN)
          errors.push(`${s.scheduled_on}: Koppeltraining zu kurz`);
        if (!rules.hardAllowed) errors.push(`${s.scheduled_on}: Koppeltraining bei „nur locker“`);
      }
      if (s.workout_type === 'technique' && s.endurance_modality !== 'swim') {
        errors.push(`${s.scheduled_on}: Technik nicht beim Schwimmen`);
      }
      if (!tri && s.endurance_modality === 'swim')
        errors.push(`${s.scheduled_on}: Schwimmen beim Rad`);
      if (!isHard(s) && (s.effort_target ?? 0) > 4) errors.push(`${s.scheduled_on}: locker über 4`);
      if (
        s.endurance_modality === 'bike' &&
        !rules.hardAllowed &&
        !s.name_de.startsWith('Ergometer')
      ) {
        errors.push(`${s.scheduled_on}: Rad im Freien bei „nur Gehen“`);
      }
    }
    if (endurance.filter((s) => s.workout_type === 'brick').length > 1)
      errors.push(`${monday}: 2 Koppel`);
    if (endurance.filter((s) => s.workout_type === 'technique').length > 1) {
      errors.push(`${monday}: 2 × Technik`);
    }
    // Triathlon: in Wochen mit mindestens 3 Einheiten (außer Erholung nach dem Rennen) jede Disziplin.
    if (tri && endurance.length >= 3 && phase !== 'recovery') {
      if (!(per.swim > 0 && per.bike > 0 && per.run > 0)) {
        errors.push(`${monday}: nicht alle Disziplinen (${JSON.stringify(per)})`);
      }
    }
    // Lange Einheit ≤ 50 % der Woche (≥ 2 Einheiten).
    const longest = Math.max(0, ...endurance.map((s) => s.estimated_minutes));
    if (endurance.length >= 2 && longest > Math.floor(minutes * 0.5)) {
      errors.push(`${monday}: längste ${longest} > 50 % von ${minutes}`);
    }
    // Harte Einheiten: nur Rad/Laufen, Zahl, Phase, 80/20, Anstrengung, 48 h.
    const hard = endurance.filter(isHard);
    if (hard.length > (rules.strict ? 1 : 2)) errors.push(`${monday}: ${hard.length} harte`);
    if (hard.length > 0 && !rules.hardAllowed) errors.push(`${monday}: harte trotz „nur locker“`);
    const hardS = endurance.reduce(
      (t, s) => t + hardSeconds((s.workout_steps ?? []) as WorkoutStep[], rules.strict),
      0,
    );
    if (hardS > Math.floor(minutes * 0.2) * 60) errors.push(`${monday}: 80/20 verletzt`);
    for (const s of hard) {
      if (!['bike', 'run'].includes(s.endurance_modality ?? '')) {
        errors.push(`${s.scheduled_on}: hart beim ${s.endurance_modality}`);
      }
      if (!['build', 'peak', 'taper'].includes(s.training_phase ?? '')) {
        errors.push(`${s.scheduled_on}: hart in ${s.training_phase}`);
      }
      if (s.is_deload && s.training_phase !== 'taper')
        errors.push(`${s.scheduled_on}: hart in Erholung`);
      if ((s.effort_target ?? 0) > (rules.minor ? 7 : 8)) errors.push(`${s.scheduled_on}: zu hart`);
      for (const d of [addDays(s.scheduled_on, -1), addDays(s.scheduled_on, 1)]) {
        const n = byDate.get(d);
        if (n && (isHard(n) || n.workout_type === 'long' || isLegs(n))) {
          errors.push(`${s.scheduled_on}: hart neben ${n.name_de}`);
        }
      }
    }
    for (const s of endurance) {
      const easyOnly = (s.is_deload && s.training_phase !== 'taper') || s.week_no === 0;
      if (easyOnly && (s.workout_steps ?? []).some((st) => st.effort >= 6)) {
        errors.push(`${s.scheduled_on}: Anstrengung ≥ 6 in Erholung/Woche 0`);
      }
    }
  }
  return errors;
}

describe('Eigenschaften Rad und Triathlon (WP5) über den ganzen Wettkampfplan', () => {
  it.each([20261018, 7])(
    'Seed %i: 10-Prozent-Regel über die Summe, Rhythmus, Plan = Ampel, Disziplinen, Koppeltraining, harte Einheiten, Datenbank (400 Läufe)',
    (seed) => {
      const r = random(seed);
      const errors: string[] = [];
      let plans = 0;
      let bricks = 0;
      let hardTotal = 0;
      let notPlanned = 0;
      for (let i = 0; i < 400; i += 1) {
        const discipline = pick(r, ['cycling', 'triathlon_sprint', 'triathlon_olympic'] as const);
        const distanceKm =
          discipline === 'cycling' ? pick(r, [20, 60, 61, 100, 150, 200, 300]) : null;
        const level = pick(r, ['beginner', 'advanced', 'competitive'] as const);
        const flags = pick(r, [[], [], [], [], ['injury'], ['pregnancy']] as const);
        const birthDate = pick(r, ['1996-01-15', '1996-01-15', '2009-12-01', '1958-06-01']);
        const today = addDays(MONDAY, Math.floor(r() * 7));
        const enduranceDays = 1 + Math.floor(r() * 7);
        const weekdays = [2, 4, 7, 6, 3, 5, 1].slice(0, enduranceDays);
        const slots: [number, Kind, number][] = weekdays.map((w) => [
          w,
          'endurance',
          w === 7 ? pick(r, [60, 120, 180, 240]) : pick(r, [30, 45, 60, 90, 120]),
        ]);
        const strengthDay = [1, 3, 5].find((d) => !weekdays.includes(d));
        if (strengthDay && r() < 0.4) {
          slots.push([strengthDay, pick(r, ['strength_gym', 'strength_home'] as const), 60]);
        }
        const schedule =
          r() < 0.25
            ? {
                mode: 'flex' as const,
                slots: slots.map(([, kind, minutes]) => ({ kind, minutes })),
              }
            : fixed(...slots);
        const inputs = runner(discipline as CompetitionDiscipline, level, {
          schedule,
          birthDate,
          healthScreening: { flags: [...flags] },
        });
        const raceDate = addDays(today, 7 * 6 + Math.floor(r() * 300));
        const request: CompetitionRequest = {
          competition: {
            name: 'Wettkampf',
            discipline,
            raceDate,
            ...(distanceKm === null ? {} : { distanceKm }),
          },
          ...(r() < 0.3 ? { longRunWeekday: pick(r, [1, 2, 4, 6, 7]) } : {}),
        };
        const feasibility = competitionFeasibility(inputs, request, today);
        if (!feasibility.ok) {
          errors.push(`${i}: ungültig`);
          continue;
        }
        const f = feasibility.feasibility;
        const generated = generateCompetitionPlan(inputs, library, today, request);
        if (f.status === 'too_short' || f.status === 'not_available') {
          notPlanned += 1;
          if (generated.ok) errors.push(`${i}: ${f.status} hat einen Plan erzeugt`);
          if (
            discipline !== 'cycling' &&
            enduranceDays < 3 &&
            !f.reasons.includes('triathlon_days_too_few')
          ) {
            if (f.status === 'too_short') errors.push(`${i}: Grund triathlon_days_too_few fehlt`);
          }
          continue;
        }
        if (discipline !== 'cycling' && enduranceDays < 3)
          errors.push(`${i}: Triathlon mit ${enduranceDays} Tagen`);
        if (!generated.ok) {
          if (generated.error !== 'no_template') errors.push(`${i}: ${generated.error}`);
          continue;
        }
        plans += 1;
        if (!generatedCompetitionPlanSchema.safeParse(generated.plan).success) {
          errors.push(`${i}: erster Block passt nicht zum Wettkampf-Schema`);
        }
        const { sessions, weeks, gaps } = fullPlan(inputs, request, today);
        errors.push(...gaps.map((g) => `${i}: ${g}`));
        const rules = planSafetyRules(
          { experienceLevel: level, birthDate, healthScreening: { flags: [...flags] } },
          today,
        );
        const group = rules.enduranceStartGroup;
        const hardAllowed =
          !rules.enduranceWalkOnly && !rules.medicalNotice && !rules.pregnancyNotice;
        const minor = birthDate === '2009-12-01';
        for (const e of chainViolations(sessions as GeneratedSession[], START[group])) {
          errors.push(`${i}: ${e}`);
        }
        for (const e of rhythmViolations(weeks)) errors.push(`${i}: ${e}`);
        for (const e of weekViolations(sessions as GeneratedSession[], discipline, {
          hardAllowed,
          strict: level === 'beginner' || group === 'cautious',
          minor,
        })) {
          errors.push(`${i}: ${e}`);
        }
        // Plan = Ampel-Vorschau (dieselbe Kette, Wochenumfang je Woche).
        const preview = competitionVolumePreview(inputs, request, today) ?? [];
        const planned = enduranceByWeek(sessions as GeneratedSession[]);
        for (const w of preview) {
          const got = planned.get(w.monday) ?? 0;
          if (got !== w.minutes) errors.push(`${i}: ${w.monday} Plan ${got} ≠ Ampel ${w.minutes}`);
        }
        // Datenbank-Eingabe und Regeln je Person (private.insert_plan_sessions).
        for (const s of sessions as GeneratedSession[]) {
          if (!savePlanSessionSchema.safeParse(toSavePlanSession(s)).success) {
            errors.push(`${i}: ${s.scheduled_on} passt nicht durch die Eingabe-Prüfung`);
          }
        }
        const check = checkCompetitionSessions(sessions, sessions, {
          today,
          birthDate,
          plan: {
            usesHealthData: true,
            medicalNotice: rules.medicalNotice,
            level,
            discipline,
          },
          profileLevel: level,
          pregnancy: false,
          competition: {
            discipline,
            distanceM: distanceKm === null ? 0 : distanceKm * 1000,
            usesHealthData: true,
          },
        });
        if (!check.ok) errors.push(`${i}: Regeln je Person: ${check.reason}`);
        bricks += sessions.filter((s) => s.workout_type === 'brick').length;
        hardTotal += (sessions as GeneratedSession[]).filter(isHard).length;
      }
      expect(errors.slice(0, 15)).toEqual([]);
      // Nicht leer: es gibt Pläne, Koppeltraining, harte Einheiten und abgelehnte Fälle.
      expect(plans).toBeGreaterThan(60);
      expect(bricks).toBeGreaterThan(50);
      expect(hardTotal).toBeGreaterThan(100);
      expect(notPlanned).toBeGreaterThan(50);
    },
    240_000,
  );
});
