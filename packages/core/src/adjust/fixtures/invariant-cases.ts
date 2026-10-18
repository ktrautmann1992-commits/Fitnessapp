/**
 * Erzeugt die 20 festen Fälle der Wochen-Invarianten (docs/PLAN-PHASE-4B.md 5.8, Wächter B2) – gültige und absichtlich
 * verletzte Pläne. Ergebnis steht als `invariants.json` im Repository; Etappe B übersetzt die Datei in
 * `supabase/tests/50_week_invariants.test.sql` (Plan: 22; 20–47 belegt), damit Core und SQL nachweislich gleich entscheiden. Neu erzeugen:
 * `pnpm --filter @fitnessapp/content exec tsx ../core/src/adjust/fixtures/write-invariant-fixtures.ts`, danach
 * `pnpm exec prettier --write packages/core/src/adjust/fixtures/invariants.json`.
 */
import { addDays } from '../../dates';
import { fixed, fullPlan, request, runner } from '../../plan/competition-test-helpers';
import { FULL_HOME, person } from '../../plan/test-library';
import type { StoredSession } from '../../plan/view';
import { checkWeekInvariants, type WeekInvariantOptions } from '../invariants';
import { applyPlanChange } from '../plan-changes';
import { planContext, tryDeloadForward } from '../rules/plan-rules';
import { followUpBlock, liveInputs, planWithFollowUps, stored } from '../test-helpers';
import { trailingLoadWeeks } from '../../plan/periodization';

export interface FixtureSession {
  /** Nur in Fällen „mit ids“ (sessionRef = id, Stelle order_no, Vorlagen-Einheit) – sonst wie bisher ohne. */
  readonly id?: string;
  readonly template_day_index?: number | null;
  readonly block_no: number;
  readonly week_no: number;
  readonly scheduled_on: string;
  readonly is_deload: boolean;
  readonly is_intro_week: boolean;
  readonly kind: 'strength' | 'endurance';
  readonly estimated_minutes: number;
  readonly training_phase?: string;
  readonly exercises: readonly {
    readonly order_no?: number;
    readonly exercise_id: string;
    readonly sets: number;
    readonly rpe_target: number;
  }[];
}

export interface InvariantFixture {
  readonly name: string;
  readonly options: {
    readonly maxLoadWeeks: number;
    readonly planStart: string;
    readonly swappedWeeks: readonly { readonly blockNo: number; readonly weekNo: number }[];
    readonly carriedLoadWeeks?: number;
    readonly fromMonday?: string;
  };
  readonly sessions: readonly FixtureSession[];
  /** Erwartete Verstoß-Codes (sortiert, eindeutig); leer = gültig. */
  readonly expected: readonly string[];
}

function slim(sessions: readonly StoredSession[], withIds = false): FixtureSession[] {
  return sessions.map((s) => ({
    ...(withIds ? { id: s.id, template_day_index: s.template_day_index } : {}),
    block_no: s.block_no,
    week_no: s.week_no,
    scheduled_on: s.scheduled_on,
    is_deload: s.is_deload,
    is_intro_week: s.is_intro_week,
    kind: s.kind,
    estimated_minutes: s.estimated_minutes,
    ...(s.training_phase === undefined ? {} : { training_phase: s.training_phase }),
    exercises: s.exercises.map((e) => ({
      ...(withIds ? { order_no: e.order_no } : {}),
      exercise_id: e.exercise_id,
      sets: e.sets,
      rpe_target: e.rpe_target,
    })),
  }));
}

export function codesOf(
  sessions: readonly FixtureSession[],
  options: WeekInvariantOptions,
): string[] {
  return [
    ...new Set(
      checkWeekInvariants(sessions as unknown as StoredSession[], options).map((v) => v.code),
    ),
  ].sort();
}

const two = (level: 'beginner' | 'advanced', extra = {}) =>
  person({
    experienceLevel: level,
    sessionsPerWeek: 2,
    preferredDays: [2, 5],
    minutesPerSession: 45,
    ...extra,
  });

function planOf(inputs: ReturnType<typeof person>, start: string, followUps: number) {
  const r = planWithFollowUps(inputs, start, followUps);
  if (!r) throw new Error('kein Plan');
  return r;
}

export function buildInvariantFixtures(): InvariantFixture[] {
  const cases: InvariantFixture[] = [];
  const add = (
    name: string,
    sessions: readonly StoredSession[] | readonly FixtureSession[],
    maxLoadWeeks: number,
    planStart: string,
    swappedWeeks: { blockNo: number; weekNo: number }[] = [],
    extra: { carriedLoadWeeks?: number; fromMonday?: string; withIds?: boolean } = {},
  ) => {
    const { withIds = false, ...more } = extra;
    const s = slim(sessions as StoredSession[], withIds);
    const options = { maxLoadWeeks, planStart, swappedWeeks, ...more };
    cases.push({ name, options, sessions: s, expected: codesOf(s, options) });
  };

  const adv = planOf(two('advanced'), '2026-10-05', 1);
  add('gueltig_fortgeschritten_montag_2_bloecke', adv.sessions, 4, '2026-10-05');
  const beg = planOf(two('beginner'), '2026-10-08', 1);
  add('gueltig_einsteiger_woche0_2_bloecke', beg.sessions, 5, '2026-10-08');
  const mixedInputs = person({
    experienceLevel: 'advanced',
    schedule: {
      mode: 'fixed',
      slots: [
        { weekday: 1, kind: 'strength_gym', minutes: 45 },
        { weekday: 3, kind: 'endurance', minutes: 40 },
        { weekday: 6, kind: 'endurance', minutes: 60 },
      ],
    },
  });
  const mixed = planOf(mixedInputs, '2026-10-05', 1);
  add('gueltig_kraft_und_ausdauer', mixed.sessions, 4, '2026-10-05');
  const enduranceOnly = planOf(
    person({
      goalType: 'endurance',
      discipline: '10k',
      experienceLevel: 'advanced',
      schedule: fixed([2, 'endurance', 45], [4, 'endurance', 45], [7, 'endurance', 75]),
      homeEquipment: [...FULL_HOME],
    }),
    '2026-10-05',
    1,
  );
  add('gueltig_nur_ausdauer', enduranceOnly.sessions, 4, '2026-10-05');
  const cautious = planOf(two('advanced', { healthScreening: null }), '2026-10-05', 1);
  add('gueltig_vorsichtig', cautious.sessions, 4, '2026-10-05');
  const bodyweight = planOf(
    person({
      experienceLevel: 'beginner',
      sessionsPerWeek: 2,
      preferredDays: [2, 5],
      trainingLocation: 'home',
      homeEquipment: [],
    }),
    '2026-10-05',
    1,
  );
  add('gueltig_koerpergewicht', bodyweight.sessions, 5, '2026-10-05');
  const run10k = fullPlan(
    runner('10k', 'advanced', {
      schedule: fixed([2, 'endurance', 45], [4, 'endurance', 45], [7, 'endurance', 75]),
    }),
    request('10k', '2027-01-30'),
    '2026-10-05',
  );
  add('gueltig_wettkampf_10k', stored(run10k.sessions as never), 4, run10k.plan.start_date);
  const tri = fullPlan(
    runner('triathlon_sprint', 'advanced', {
      schedule: fixed(
        [2, 'endurance', 60],
        [4, 'endurance', 60],
        [6, 'endurance', 60],
        [7, 'endurance', 120],
      ),
    }),
    request('triathlon_sprint', '2027-03-06'),
    '2026-10-05',
  );
  add('gueltig_wettkampf_triathlon_sprint', stored(tri.sessions as never), 4, tri.plan.start_date);

  // Tausch-Regel: Einsteiger 5 Belastungswochen, Woche 4 vorgezogen, Woche 6 getauscht.
  const begMon = planOf(two('beginner'), '2026-10-05', 0);
  const base = liveInputs(begMon.sessions, { today: '2026-10-23', level: 'beginner' });
  const live = { ...base, plan: { ...base.plan, startDate: '2026-10-05' } };
  const swap = tryDeloadForward(live, planContext(live));
  if (!swap) throw new Error('kein Tausch');
  const swapped = applyPlanChange(begMon.sessions, swap.pair.after);
  const carried = trailingLoadWeeks(swapped);
  const followCarried = stored(
    followUpBlock(begMon.plan, two('beginner'), swapped, { carriedLoadWeeks: carried }),
    'f',
  );
  add('gueltig_tausch_mit_carried', [...swapped, ...followCarried], 5, '2026-10-05', [
    { blockNo: 1, weekNo: 6 },
  ]);
  const followNaive = stored(followUpBlock(begMon.plan, two('beginner'), swapped), 'g');
  add('verletzt_tausch_ohne_carried', [...swapped, ...followNaive], 5, '2026-10-05', [
    { blockNo: 1, weekNo: 6 },
  ]);

  // Erster Block ohne Erholungswoche (Woche 0 + L + 1 Belastungswochen).
  add(
    'verletzt_erster_block_l_plus_1',
    beg.sessions.map((s) => (s.block_no === 1 ? { ...s, is_deload: false } : s)),
    5,
    '2026-10-08',
  );
  // Folgeblock mit L + 1 Belastungswochen (append_plan_block-Fall).
  add(
    'verletzt_folgeblock_l_plus_1',
    adv.sessions.map((s) => (s.block_no === 2 && s.is_deload ? { ...s, is_deload: false } : s)),
    4,
    '2026-10-05',
  );
  // Ausdauer +20 % in einer Belastungswoche.
  add(
    'verletzt_ausdauer_plus_20',
    mixed.sessions.map((s) =>
      s.kind === 'endurance' && s.block_no === 1 && s.week_no === 3
        ? { ...s, estimated_minutes: Math.ceil(s.estimated_minutes * 1.3) }
        : s,
    ),
    4,
    '2026-10-05',
  );
  // Erholungswoche mit vollem Ausdauer-Umfang.
  const loadMinutes = new Map(
    mixed.sessions
      .filter((s) => s.block_no === 1 && s.week_no === 4 && s.kind === 'endurance')
      .map((s) => [s.scheduled_on.slice(8), s.estimated_minutes]),
  );
  add(
    'verletzt_erholung_ausdauer_voll',
    mixed.sessions.map((s) =>
      s.kind === 'endurance' && s.block_no === 1 && s.is_deload
        ? { ...s, estimated_minutes: Math.max(...loadMinutes.values(), s.estimated_minutes) }
        : s,
    ),
    4,
    '2026-10-05',
  );
  // Erholungswoche mit vollen Sätzen bzw. vollem RPE.
  add(
    'verletzt_erholung_saetze',
    adv.sessions.map((s) =>
      s.block_no === 1 && s.is_deload
        ? { ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets * 2 + 1 })) }
        : s,
    ),
    4,
    '2026-10-05',
  );
  add(
    'verletzt_erholung_rpe',
    adv.sessions.map((s) =>
      s.block_no === 1 && s.is_deload
        ? {
            ...s,
            exercises: s.exercises.map((e) => ({
              ...e,
              rpe_target: Math.min(10, e.rpe_target + 3),
            })),
          }
        : s,
    ),
    4,
    '2026-10-05',
  );
  // Getauschte Woche über der Vorwoche.
  add(
    'verletzt_getauschte_woche_ueber_vorwoche',
    swapped.map((s) =>
      s.week_no === 6
        ? { ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets + 1 })) }
        : s,
    ),
    5,
    '2026-10-05',
    [{ blockNo: 1, weekNo: 6 }],
  );
  // Zweiter Tausch im selben Block.
  add('verletzt_zweiter_tausch_im_block', swapped, 5, '2026-10-05', [
    { blockNo: 1, weekNo: 6 },
    { blockNo: 1, weekNo: 5 },
  ]);
  // Angebrochene erste Woche (Start Mittwoch, keine Woche 0) ist kein Bezug.
  const partial = planOf(mixedInputs, addDays('2026-10-05', 2), 0);
  add('gueltig_angebrochene_startwoche', partial.sessions, 4, '2026-10-07');
  // Belastungswoche ohne Ausdauer → kein Bezug, danach Neustart.
  add(
    'gueltig_neustart_ohne_bezug',
    mixed.sessions.filter((s) => !(s.kind === 'endurance' && s.block_no === 1 && s.week_no === 2)),
    4,
    '2026-10-05',
  );
  // Wächter B Auflage 5: weitere Fälle für die SQL-Nachrechnung.
  // Einheiten mit id (sessionRef = id) und Stelle (order_no) – Erholungswoche mit vollen Sätzen.
  add(
    'verletzt_erholung_saetze_mit_ids',
    adv.sessions.map((s) =>
      s.block_no === 1 && s.is_deload
        ? { ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets * 2 + 1 })) }
        : s,
    ),
    4,
    '2026-10-05',
    [],
    { withIds: true },
  );
  // Nur der Folgeblock mit einer übernommenen Belastungswoche davor (carriedLoadWeeks).
  add(
    'verletzt_folgeblock_mit_carried',
    adv.sessions.filter((s) => s.block_no === 2),
    4,
    '2026-10-05',
    [],
    { carriedLoadWeeks: 1 },
  );
  // Getauschte Woche mit Ausdauer über der Vorwoche (Minuten).
  let longerOnce = false;
  add(
    'verletzt_getauschte_woche_ausdauer',
    mixed.sessions.map((s) => {
      if (longerOnce || s.kind !== 'endurance' || s.block_no !== 1 || s.week_no !== 3) return s;
      longerOnce = true;
      return { ...s, estimated_minutes: s.estimated_minutes + 2 };
    }),
    4,
    '2026-10-05',
    [{ blockNo: 1, weekNo: 3 }],
  );
  // Verstoß in einer Tapering-Woche (eigener Faktor 0,75): Erholungswoche mit vollem Umfang.
  const runStored = stored(run10k.sessions as never);
  const taperWeek = runStored.find((s) => s.is_deload && s.training_phase === 'taper');
  if (!taperWeek) throw new Error('keine Tapering-Woche');
  add(
    'verletzt_tapering_ausdauer',
    runStored.map((s) =>
      s.block_no === taperWeek.block_no && s.week_no === taperWeek.week_no && s.kind === 'endurance'
        ? { ...s, estimated_minutes: s.estimated_minutes * 2 }
        : s,
    ),
    4,
    run10k.plan.start_date,
  );
  // Zweiter Tausch im Block, aber erst ab einer späteren Woche gemeldet (fromMonday nach der ersten Woche des Blocks).
  add(
    'gueltig_zweiter_tausch_vor_from_monday',
    swapped,
    5,
    '2026-10-05',
    [
      { blockNo: 1, weekNo: 6 },
      { blockNo: 1, weekNo: 5 },
    ],
    { fromMonday: '2026-10-12' },
  );
  // Woche 0 mit Ausdauer (Start Donnerstag): zählt nie als Belastungswoche und ist nie Bezug.
  const weekZero = planOf(mixedInputs, '2026-10-08', 1);
  add('gueltig_woche0_mit_ausdauer', weekZero.sessions, 4, '2026-10-08');
  return cases;
}
