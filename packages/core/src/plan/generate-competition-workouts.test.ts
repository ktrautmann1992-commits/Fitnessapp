/**
 * Wettkampfplan – Einheiten, Intensität, Wochenbau (docs/PLAN-PHASE-10.md Abschnitte 3.3–3.6 und 6, Etappe WP2):
 * Eigenschaftstests über den GANZEN Plan (alle Blöcke) und feste Beispiele. Alle Erwartungen UNABHÄNGIG hergeleitet
 * (feste Zahlen aus Plan 3.3–3.5 und den Gründer-Entscheidungen G2/G3/G7), nicht aus constants.ts.
 */
import { describe, expect, it } from 'vitest';

import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import {
  competitionFeasibility,
  type CompetitionRequest,
  competitionVolumePreview,
} from './competition';
import type { CompetitionDiscipline } from './competition-schema';
import {
  chainViolations,
  fixed,
  fullPlan,
  type Kind,
  library,
  request,
  rhythmViolations,
  runner,
  START,
} from './competition-test-helpers';
import {
  generateCompetitionPlan,
  generatedCompetitionPlanSchema,
  generateTrainingPlan,
} from './generate';
import type { PlanInputsInput } from './inputs';
import { hardSeconds, type WorkoutStep } from './intensity';
import { planSafetyRules } from './safety';
import type { GeneratedSession } from './schedule';
import { MONDAY } from './test-library';

// Feste Werte (Plan 3.3–3.5, G2) – bewusst nicht aus constants.ts.
const START_CAP: Partial<Record<string, number>> = { beginner: 30, cautious: 20 };
const FIRST_LOAD_WEEK_MAX = 90;
const LONG_MAX = { '5k': 75, '10k': 90, half_marathon: 120, marathon: 180 } as const;
const HARD = ['fartlek', 'tempo', 'intervals', 'race_pace'];
const REQUIRED_LONG_FINISH = { '5k': 40, '10k': 50, half_marathon: 70, marathon: 120 } as const;
const REQUIRED_WEEK_FINISH = { '5k': 80, '10k': 100, half_marathon: 140, marathon: 240 } as const;

const isHard = (s: GeneratedSession) =>
  s.kind === 'endurance' && HARD.includes(s.workout_type ?? '');
const isLegs = (s: GeneratedSession) =>
  s.kind === 'strength' && (s.focus === 'full_body' || s.focus === 'lower');

interface BlockRules {
  readonly group: string;
  readonly level: string;
  readonly hardAllowed: boolean;
  readonly minor: boolean;
}

function rulesOf(inputs: PlanInputsInput, today: string): BlockRules {
  const rules = planSafetyRules(
    {
      experienceLevel: inputs.experienceLevel,
      birthDate: inputs.birthDate,
      healthScreening: inputs.healthScreening ?? null,
    },
    today,
  );
  const age = Number(today.slice(0, 4)) - Number(inputs.birthDate.slice(0, 4));
  return {
    group: rules.enduranceStartGroup,
    level: inputs.experienceLevel,
    hardAllowed:
      !rules.enduranceWalkOnly &&
      !rules.pregnancyNotice &&
      !rules.noHealthCheck &&
      !rules.medicalNotice,
    minor: age <= 18 && rules.enduranceStartGroup === 'cautious',
  };
}

/** Unabhängige Prüfung des Wochenbaus über alle Wochen des Plans. */
function workoutViolations(
  sessions: readonly GeneratedSession[],
  discipline: CompetitionDiscipline,
  rulesForBlock: (blockNo: number) => BlockRules,
  initialLongest: number | null,
  restartChain: boolean,
): string[] {
  const errors: string[] = [];
  const active = [...sessions].sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1));
  const byDate = new Map(active.map((s) => [s.scheduled_on, s]));
  const weeks = [...new Set(active.map((s) => startOfIsoWeek(s.scheduled_on)))].sort();
  let lastLongest: number | null = restartChain ? null : initialLongest;
  for (const monday of weeks) {
    const inWeek = active.filter((s) => startOfIsoWeek(s.scheduled_on) === monday);
    const endurance = inWeek.filter((s) => s.kind === 'endurance');
    const minutes = endurance.reduce((sum, s) => sum + s.estimated_minutes, 0);
    const longest = Math.max(0, ...endurance.map((s) => s.estimated_minutes));
    const rules = rulesForBlock(inWeek[0]?.block_no ?? 1);
    const phase = endurance[0]?.training_phase ?? inWeek[0]?.training_phase;
    // Jede Ausdauer-Einheit: Art, Phase, Schritte = Dauer.
    for (const s of endurance) {
      if (!s.workout_type || !s.training_phase || !s.workout_steps) {
        errors.push(`${s.scheduled_on}: Einheit ohne Art/Phase/Schritte`);
        continue;
      }
      const sum = s.workout_steps.reduce((t, st) => t + st.seconds, 0);
      if (sum !== s.estimated_minutes * 60) errors.push(`${s.scheduled_on}: Schritte ≠ Dauer`);
    }
    // Langer Lauf (G2): ≤ 50 % der Woche (≥ 2 Einheiten), ≤ Deckel je Distanz, eigene Steigerungsregel.
    if (endurance.length >= 2 && longest > Math.floor(minutes * 0.5)) {
      errors.push(`${monday}: längste Einheit ${longest} > 50 % von ${minutes}`);
    }
    if (longest > LONG_MAX[discipline]) errors.push(`${monday}: langer Lauf ${longest} > Deckel`);
    const week0 = inWeek.every((s) => s.week_no === 0);
    const deload = inWeek.every((s) => s.is_deload);
    if (!week0 && endurance.length > 0) {
      const first = Math.min(START_CAP[rules.group] ?? FIRST_LOAD_WEEK_MAX, FIRST_LOAD_WEEK_MAX);
      const limit =
        lastLongest === null ? first : deload ? lastLongest : Math.floor((lastLongest * 110) / 100);
      if (longest > limit) {
        errors.push(`${monday}: längste Einheit ${longest} > ${limit} (letzte ${lastLongest})`);
      }
      if (!deload) lastLongest = longest;
    }
    // 80/20 je Woche (Seiler 2010): Einsteiger/vorsichtig nur harte Abschnitte, sonst Hauptteil.
    const workOnly = rules.group === 'cautious' || rules.level === 'beginner';
    const hardS = endurance.reduce(
      (sum, s) => sum + hardSeconds((s.workout_steps ?? []) as WorkoutStep[], workOnly),
      0,
    );
    if (hardS > Math.floor(minutes * 0.2) * 60) {
      errors.push(`${monday}: harte Zeit ${hardS / 60} min > 20 % von ${minutes}`);
    }
    const hard = endurance.filter(isHard);
    const hardLimit = workOnly ? 1 : 2;
    if (hard.length > hardLimit) errors.push(`${monday}: ${hard.length} harte Einheiten`);
    if (hard.length > 0 && !rules.hardAllowed) {
      errors.push(`${monday}: harte Einheit trotz Flag/Schwangerschaft/nur Gehen`);
    }
    if (hard.length > 0 && rules.level === 'beginner' && endurance.length < 3) {
      errors.push(`${monday}: Einsteiger mit ${endurance.length} Tagen hat eine harte Einheit`);
    }
    for (const s of hard) {
      if (s.is_deload && s.training_phase !== 'taper') {
        errors.push(`${s.scheduled_on}: harte Einheit in einer Erholungswoche`);
      }
      if (!['build', 'peak', 'taper'].includes(s.training_phase ?? '')) {
        errors.push(`${s.scheduled_on}: harte Einheit in Phase ${s.training_phase}`);
      }
      if ((s.effort_target ?? 0) > (rules.minor ? 7 : 8)) {
        errors.push(`${s.scheduled_on}: Anstrengung ${s.effort_target} zu hoch`);
      }
      // 48-h-Regel erweitert: nie neben harter Ausdauer, langem Lauf oder Kraft mit Beinen.
      for (const d of [addDays(s.scheduled_on, -1), addDays(s.scheduled_on, 1)]) {
        const n = byDate.get(d);
        if (n && (isHard(n) || n.workout_type === 'long' || isLegs(n))) {
          errors.push(`${s.scheduled_on}: harte Einheit neben ${n.name_de} (${d})`);
        }
      }
    }
    if (phase === 'taper' && hard.length > 1) errors.push(`${monday}: Tapering mit 2 harten`);
    for (const s of endurance) {
      if (!isHard(s) && (s.effort_target ?? 0) > 4) {
        errors.push(`${s.scheduled_on}: lockere Einheit mit Anstrengung ${s.effort_target}`);
      }
    }
    // Kraft in Spitze/Tapering/Rennwoche höchstens 1 (Plan 3.5).
    const strength = inWeek.filter((s) => s.kind === 'strength');
    if (['peak', 'taper', 'race_week'].includes(phase ?? '') && strength.length > 1) {
      errors.push(`${monday}: ${strength.length} Kraft-Einheiten in Phase ${phase}`);
    }
  }
  return errors;
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
const pick = <T>(r: () => number, values: readonly T[]): T =>
  values[Math.floor(r() * values.length)] as T;

describe('Eigenschaften Wochenbau (WP2) über den ganzen Wettkampfplan', () => {
  it('langer Lauf (G2), 80/20, harte Einheiten (Abstand, Phase, Gruppen), Kraft in Spitze/Tapering, 10-%-Kette, Start-Deckel, Rhythmus, Plan = Ampel, Ampel ehrlich (400 Läufe, Varianten)', () => {
    const r = random(20261017);
    const errors: string[] = [];
    let plans = 0;
    let hardSessions = 0;
    let longRuns = 0;
    const variants = new Map<string, number>();
    for (let i = 0; i < 400; i += 1) {
      const variant = pick(r, ['plain', 'own_start', 'reference', 'flex', 'group_change'] as const);
      const discipline = pick(r, ['5k', '10k', 'half_marathon', 'marathon'] as const);
      const level = pick(r, ['beginner', 'advanced', 'competitive'] as const);
      const flags = pick(r, [[], [], [], [], ['injury'], ['pregnancy']] as const);
      const birthDate = pick(r, ['1996-01-15', '1996-01-15', '2009-12-01', '1958-06-01']);
      const today = addDays(MONDAY, Math.floor(r() * 7));
      const enduranceDays = 1 + Math.floor(r() * 7);
      const weekdays = [2, 4, 7, 6, 3, 5, 1].slice(0, enduranceDays);
      const slots: [number, Kind, number][] = weekdays.map((w) => [
        w,
        'endurance',
        w === 7 ? pick(r, [60, 90, 120, 150, 180]) : pick(r, [30, 45, 60, 90]),
      ]);
      const strengthDay = [1, 3, 5].find((d) => !weekdays.includes(d));
      if (strengthDay && r() < 0.5) {
        slots.push([strengthDay, pick(r, ['strength_gym', 'strength_home'] as const), 60]);
      }
      const schedule =
        variant === 'flex'
          ? { mode: 'flex' as const, slots: slots.map(([, kind, minutes]) => ({ kind, minutes })) }
          : fixed(...slots);
      const inputs = runner(discipline, level, {
        schedule,
        birthDate,
        healthScreening: { flags: [...flags] },
      });
      const raceDate = addDays(today, 7 * 6 + Math.floor(r() * 300));
      const refVolume = pick(r, [0, 45, 90, 150, 240, 400]);
      const startGroup = pick(r, ['cautious', 'beginner', 'advanced', 'competitive'] as const);
      const withPace = r() < 0.5;
      const req: CompetitionRequest = {
        competition: {
          ...request(discipline, raceDate).competition,
          ...(withPace
            ? { reference: { discipline: '10k', timeS: 50 * 60, date: addDays(today, -10) } }
            : {}),
        },
        ...(r() < 0.3 ? { longRunWeekday: pick(r, [1, 2, 4, 6, 7]) } : {}),
        ...(variant === 'own_start'
          ? { ownStart: { weeklyMinutes: pick(r, [100, 200, 300, 600]), confirmed: true } }
          : {}),
        ...(variant === 'reference'
          ? {
              startReference: {
                volume: refVolume,
                sessionCap:
                  refVolume === 0 ? null : Math.min(refVolume, pick(r, [10, 30, 60, 120, 240])),
                startGroup,
              },
            }
          : {}),
      };
      const feasibility = competitionFeasibility(inputs, req, today);
      if (!feasibility.ok) {
        errors.push(`${i}: ungültig`);
        continue;
      }
      const f = feasibility.feasibility;
      const generated = generateCompetitionPlan(inputs, library, today, req);
      if (f.status === 'too_short' || f.status === 'not_available') {
        if (generated.ok) errors.push(`${i}: ${f.status} hat einen Plan erzeugt`);
        continue;
      }
      if (!generated.ok) {
        if (generated.error !== 'no_template') errors.push(`${i}: ${generated.error}`);
        continue;
      }
      plans += 1;
      variants.set(variant, (variants.get(variant) ?? 0) + 1);
      const change = pick(r, ['flag', 'beginner', 'looser'] as const);
      const changed: PlanInputsInput =
        change === 'flag'
          ? { ...inputs, healthScreening: { flags: ['injury'] } }
          : change === 'beginner'
            ? { ...inputs, experienceLevel: 'beginner' }
            : { ...inputs, healthScreening: { flags: [] }, experienceLevel: 'competitive' };
      const later = (blockNo: number) =>
        variant === 'group_change' && blockNo >= 2
          ? { inputs: changed, today: addDays(today, 30) }
          : { inputs, today };
      const { sessions, weeks, gaps } = fullPlan(inputs, req, today, later);
      const blockRules = (blockNo: number) => {
        const l = later(blockNo);
        return rulesOf(l.inputs, l.today);
      };
      // Startwert der Kette wie im WP1-Eigenschaftstest (unabhängig hergeleitet).
      const first = rulesOf(inputs, today);
      const groupStart = START[first.group as keyof typeof START];
      const ORDER = ['cautious', 'beginner', 'advanced', 'competitive'];
      const ref = req.startReference && req.startReference.volume > 0 ? req.startReference : null;
      const stricter = ref !== null && ORDER.indexOf(first.group) < ORDER.indexOf(ref.startGroup);
      const initialReference = ref
        ? Math.min(ref.volume, stricter ? groupStart : 2 * groupStart)
        : 0;
      const ownAllowed = req.ownStart && first.group !== 'cautious' && level !== 'beginner' && !ref;
      const start = ownAllowed
        ? Math.min(req.ownStart?.weeklyMinutes ?? 0, 2 * groupStart)
        : groupStart;
      for (const e of chainViolations(sessions, start, initialReference)) errors.push(`${i}: ${e}`);
      const initialLongest =
        ref && ref.sessionCap !== null
          ? Math.min(ref.sessionCap, ref.volume, 2 * groupStart)
          : null;
      for (const e of workoutViolations(
        sessions,
        discipline,
        blockRules,
        initialLongest,
        ref === null || stricter,
      )) {
        errors.push(`${i} (${variant}, ${level}, ${discipline}): ${e}`);
      }
      for (const e of [...rhythmViolations(weeks), ...gaps]) errors.push(`${i}: ${e}`);
      for (const blockNo of new Set(sessions.map((s) => s.block_no))) {
        const block = sessions.filter((s) => s.block_no === blockNo);
        if (
          !generatedCompetitionPlanSchema.safeParse({ ...generated.plan, sessions: block }).success
        )
          errors.push(`${i}: Block ${blockNo} außerhalb des Rahmens`);
      }
      hardSessions += sessions.filter(isHard).length;
      longRuns += sessions.filter((s) => s.workout_type === 'long').length;
      if (variant === 'group_change') continue;
      // Plan = Ampel-Vorschau (Wochenminuten UND längste Einheit, dieselbe Kette).
      const preview = competitionVolumePreview(inputs, req, today) ?? [];
      for (const w of preview) {
        const inWeek = sessions.filter(
          (s) => s.kind === 'endurance' && startOfIsoWeek(s.scheduled_on) === w.monday,
        );
        const sum = inWeek.reduce((t, s) => t + s.estimated_minutes, 0);
        const longest = Math.max(0, ...inWeek.map((s) => s.estimated_minutes));
        if (sum !== w.minutes || longest !== w.longestMinutes) {
          errors.push(
            `${i}: ${w.monday} Plan ${sum}/${longest} ≠ Vorschau ${w.minutes}/${w.longestMinutes}`,
          );
        }
      }
      // Ampel ehrlich (G2): „passt“ (Ankommen) = mindestens 2 Belastungswochen mit Wochenumfang UND langem Lauf.
      if (f.effectiveGoal === 'finish') {
        const reached = preview.filter(
          (w) =>
            w.load &&
            w.minutes >= REQUIRED_WEEK_FINISH[discipline] &&
            w.longestMinutes >= REQUIRED_LONG_FINISH[discipline],
        ).length;
        if (f.status === 'ok' && reached < 2) errors.push(`${i}: „passt“ mit ${reached} Wochen`);
        if (f.status === 'tight' && reached < 1) errors.push(`${i}: „knapp“ ohne Spitzenwoche`);
      }
      // G7: nur Gehen → höchstens „knapp“ mit Hinweis.
      if (
        first.group === 'cautious' &&
        planSafetyRules(
          { experienceLevel: level, birthDate, healthScreening: { flags: [...flags] } },
          today,
        ).enduranceWalkOnly
      ) {
        if (f.status === 'ok') errors.push(`${i}: nur Gehen, aber „passt“`);
        if (!f.notices.includes('walk_only_plan'))
          errors.push(`${i}: Hinweis walk_only_plan fehlt`);
      }
      if (isoWeekday(today) !== 1 && !sessions.every((s) => s.scheduled_on >= today)) {
        errors.push(`${i}: Einheit vor dem Planstart`);
      }
    }
    expect(plans).toBeGreaterThan(100);
    expect(hardSessions).toBeGreaterThan(200);
    expect(longRuns).toBeGreaterThan(500);
    for (const v of ['plain', 'own_start', 'reference', 'flex', 'group_change']) {
      expect(variants.get(v) ?? 0, v).toBeGreaterThan(10);
    }
    expect(errors.slice(0, 10)).toEqual([]);
  }, 120_000);
});

describe('Beispiele am fertigen Plan (WP2)', () => {
  const raceIn = (n: number) => addDays(MONDAY, n * 7 + 6);
  const advanced = (overrides: Partial<PlanInputsInput> = {}) =>
    runner('half_marathon', 'advanced', {
      schedule: fixed(
        [1, 'strength_gym', 60],
        [2, 'endurance', 60],
        [4, 'endurance', 60],
        [6, 'endurance', 45],
        [7, 'endurance', 150],
      ),
      ...overrides,
    });

  it('Fortgeschritten Halbmarathon: harte Einheiten ab Aufbau, Basis/Erholung/Rennwoche ohne, Hinweis „kommt später“ entfällt', () => {
    const { plan, sessions } = fullPlan(advanced(), request('half_marathon', raceIn(20)), MONDAY);
    expect(plan.notes).not.toContain('endurance_basic_only');
    const hard = sessions.filter(isHard);
    expect(hard.length).toBeGreaterThan(3);
    expect(hard.every((s) => ['build', 'peak', 'taper'].includes(s.training_phase ?? ''))).toBe(
      true,
    );
    expect(sessions.filter((s) => s.workout_type === 'long').length).toBeGreaterThan(10);
    expect(
      workoutViolations(sessions, 'half_marathon', () => rulesOf(advanced(), MONDAY), null, true),
    ).toEqual([]);
  });

  it('Gesundheits-Flag: Plan ohne harte Einheiten (Handy-Test 5), nur „knapp“', () => {
    const flagged = advanced({ healthScreening: { flags: ['injury'] } });
    const { plan, sessions } = fullPlan(flagged, request('half_marathon', raceIn(30)), MONDAY);
    expect(plan.competition?.feasibility.status).toBe('tight');
    expect(sessions.some(isHard)).toBe(false);
    expect(sessions.some((s) => s.workout_type === 'strides')).toBe(false);
  });

  it('Kraft in Spitze/Tapering: höchstens 1 Einheit je Woche, Bein-Übungen in Erholungs-Dosierung', () => {
    const inputs = advanced({
      schedule: fixed(
        [1, 'strength_gym', 60],
        [3, 'strength_gym', 60],
        [2, 'endurance', 60],
        [5, 'endurance', 60],
        [7, 'endurance', 150],
      ),
    });
    const { sessions } = fullPlan(inputs, request('half_marathon', raceIn(20)), MONDAY);
    const peakWeeks = new Set(
      sessions
        .filter((s) => s.training_phase === 'peak' && !s.is_deload)
        .map((s) => startOfIsoWeek(s.scheduled_on)),
    );
    expect(peakWeeks.size).toBeGreaterThan(0);
    for (const monday of peakWeeks) {
      const strength = sessions.filter(
        (s) => s.kind === 'strength' && startOfIsoWeek(s.scheduled_on) === monday,
      );
      expect(strength.length).toBeLessThanOrEqual(1);
      for (const st of strength) {
        for (const e of st.exercises) {
          const muscles = library.exercises.get(e.exercise_id)?.primary_muscles ?? [];
          if (
            muscles.some((m) =>
              ['glutes', 'quadriceps', 'hamstrings', 'adductors', 'calves'].includes(m),
            )
          ) {
            // Erholungs-Dosierung: RPE höchstens Belastungs-RPE − 2 (Einsteiger-/Fortgeschrittenen-Deckel 9).
            expect(e.rpe_target).toBeLessThanOrEqual(7);
          }
        }
      }
    }
    // Aufbau: beide Kraft-Tage bleiben.
    const build = sessions.filter((s) => s.training_phase === 'build' && !s.is_deload);
    const buildWeek = startOfIsoWeek(build[0]?.scheduled_on ?? MONDAY);
    expect(
      sessions.filter((s) => s.kind === 'strength' && startOfIsoWeek(s.scheduled_on) === buildWeek)
        .length,
    ).toBe(2);
  });

  it('ohne Wettkampf: keine Wettkampf-Felder in den Einheiten; mit Wettkampf jede Ausdauer-Einheit mit Art', () => {
    const plain = generateTrainingPlan(advanced(), library, MONDAY);
    expect(plain.ok).toBe(true);
    if (plain.ok) {
      for (const key of ['workout_type', 'training_phase', 'workout_steps', 'target_distance_m']) {
        expect(plain.plan.sessions.some((s) => key in s)).toBe(false);
      }
    }
    const competition = generateCompetitionPlan(
      advanced(),
      library,
      MONDAY,
      request('half_marathon', raceIn(20)),
    );
    expect(competition.ok).toBe(true);
    if (competition.ok) {
      expect(competition.plan.sessions.every((s) => s.kind !== 'endurance' || s.workout_type)).toBe(
        true,
      );
    }
  });
});
