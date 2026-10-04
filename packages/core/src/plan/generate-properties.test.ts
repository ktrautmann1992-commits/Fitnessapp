/**
 * Eigenschaftstest mit UNABHÄNGIGEN Erwartungen (Wächter-Auflage B3 Nr. 4): Alle Grenzen werden hier aus den
 * EINGABEN und einer festen Tabelle (Erweiterungsplan 5.2/5.5/5.6) hergeleitet – nicht aus Zwischenwerten der
 * Engine (kein p.training_week, keine safety_rules). Geprüft über zwei Blöcke (nextPlanBlock), auch wenn die Regeln
 * zwischen den Blöcken strenger werden (65. Geburtstag, neues Flag, Schwangerschaft).
 */
import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { planSafetyRules } from './safety';
import { type GeneratedSession, nextPlanBlock } from './schedule';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();
type Kind = 'strength_gym' | 'strength_home' | 'endurance';
type Flag = 'pregnancy' | 'injury' | 'medication' | 'conservative_plan';
type Level = 'beginner' | 'advanced' | 'competitive';

// Feste Tabelle (Erweiterungsplan 5.2, 5.5, 5.6) – bewusst NICHT aus constants.ts importiert.
const TABLE = {
  start: { beginner: 60, advanced: 120, competitive: 150, cautious: 45 },
  enduranceMax: { beginner: 4, advanced: 5, competitive: 6, cautious: 3 },
  startCap: { beginner: 30, cautious: 20 } as Partial<Record<string, number>>,
  totalMax: 5,
  strengthMax: 4,
  firstWeekMax: 90,
};

function age(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = on.split('-').map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

interface Person {
  level: Level;
  birthDate: string;
  screening: { flags: Flag[] } | null;
}

function expected(p: Person, on: string) {
  const years = age(p.birthDate, on);
  const flags = p.screening?.flags ?? [];
  const cautious = p.screening === null || flags.length > 0 || years < 18 || years >= 65;
  const group = cautious ? 'cautious' : p.level;
  const walk = flags.length > 0 || years >= 65;
  const effortMax =
    p.screening === null || flags.length > 0 || years >= 65 ? 3 : years < 18 ? 4 : 4;
  return {
    group,
    walk,
    effortMax,
    enduranceMax: TABLE.enduranceMax[group],
    totalMax: group === 'cautious' || group === 'beginner' ? TABLE.totalMax : 7,
    start: TABLE.start[group],
    startCap: TABLE.startCap[group] ?? null,
  };
}

/** Prüft einen Block. `reference` = Ausdauer-Minuten der letzten Belastungswoche davor (null = erster Block). */
function check(
  sessions: readonly GeneratedSession[],
  exp: ReturnType<typeof expected>,
  wishSum: number,
  reference: { volume: number; sessionCap: number; stricter: boolean } | null,
  label: string,
): { violations: string[]; lastLoad: number; lastLongest: number } {
  const violations: string[] = [];
  const byWeek = new Map<string, GeneratedSession[]>();
  for (const s of sessions) {
    const key = `${s.block_no}:${s.week_no}:${startOfIsoWeek(s.scheduled_on)}`;
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }
  if (new Set(sessions.map((s) => s.scheduled_on)).size !== sessions.length) {
    violations.push(`${label}: zwei Einheiten an einem Tag`);
  }
  let ref = reference
    ? reference.stricter
      ? Math.min(reference.volume, exp.start)
      : reference.volume
    : 0;
  // Deckel je Einheit: Start-Deckel der Gruppe; im Folgeblock (gleiche Gruppe) aus der längsten Einheit fortgeschrieben.
  let cap: number | null =
    exp.startCap === null
      ? null
      : reference && !reference.stricter
        ? Math.floor((reference.sessionCap * 110) / 100)
        : exp.startCap;
  let firstLoad = reference === null || reference.stricter;
  const start = Math.min(exp.start, wishSum);
  for (const [key, week] of [...byWeek.entries()].sort()) {
    const runs = week.filter((s) => s.kind === 'endurance');
    const strength = week.filter((s) => s.kind === 'strength');
    if (strength.length > TABLE.strengthMax) violations.push(`${label} ${key}: > 4 Kraft`);
    if (runs.length > exp.enduranceMax) violations.push(`${label} ${key}: ${runs.length} Ausdauer`);
    if (week.length > exp.totalMax) violations.push(`${label} ${key}: ${week.length} Einheiten`);
    for (const s of runs) {
      if ((s.effort_target ?? 99) > exp.effortMax) violations.push(`${label} ${key}: Anstrengung`);
      if (exp.walk && s.endurance_modality === 'run')
        violations.push(`${label} ${key}: Laufen statt Gehen`);
      if (s.estimated_minutes < 10 || s.estimated_minutes > 240)
        violations.push(`${label} ${key}: Dauer`);
    }
    const sum = runs.reduce((acc, s) => acc + s.estimated_minutes, 0);
    const weekNo = week[0]?.week_no ?? 0;
    const deload = week.every((s) => s.is_deload);
    if (runs.length === 0) {
      if (!deload && weekNo >= 1) {
        ref = 0;
      }
      continue;
    }
    if (weekNo === 0) {
      if (sum > start) violations.push(`${label} ${key}: Woche 0 ${sum} > ${start}`);
      continue;
    }
    if (deload) {
      if (sum > Math.floor((ref * 60) / 100))
        violations.push(`${label} ${key}: Erholung ${sum}/${ref}`);
      continue;
    }
    const limit = ref > 0 ? Math.floor((ref * 110) / 100) : start;
    if (sum > limit) violations.push(`${label} ${key}: ${sum} > ${limit} (10 %)`);
    const perSession = Math.min(
      cap ?? Infinity,
      firstLoad ? TABLE.firstWeekMax : Infinity,
      runs.length >= 2 ? Math.floor(limit / 2) : Infinity,
    );
    for (const s of runs) {
      if (s.estimated_minutes > perSession) {
        violations.push(`${label} ${key}: Einheit ${s.estimated_minutes} > ${perSession}`);
      }
    }
    ref = sum;
    if (cap !== null) cap = Math.floor((cap * 110) / 100);
    firstLoad = false;
  }
  const loadWeeks = [...byWeek.values()].filter(
    (w) => !w.every((s) => s.is_deload) && (w[0]?.week_no ?? 0) >= 1,
  );
  const last = loadWeeks.at(-1) ?? [];
  const lastRuns = last.filter((s) => s.kind === 'endurance');
  return {
    violations,
    lastLoad: lastRuns.reduce((acc, s) => acc + s.estimated_minutes, 0),
    lastLongest: Math.max(0, ...lastRuns.map((s) => s.estimated_minutes)),
  };
}

describe('Eigenschaften mit unabhängigen Erwartungen – zwei Blöcke, auch mit strengeren Regeln', () => {
  it('Deckel, Anstrengung, Gehen, Altersgruppen, 10 %-Regel über die Blockgrenze', () => {
    const SCHEDULES: {
      mode: 'fixed';
      slots: { weekday: number; kind: Kind; minutes: number }[];
    }[] = [
      {
        mode: 'fixed',
        slots: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          kind: 'endurance',
          minutes: 60,
        })),
      },
      {
        mode: 'fixed',
        slots: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          kind: (weekday % 2 === 0
            ? 'endurance'
            : weekday === 7
              ? 'strength_home'
              : 'strength_gym') as Kind,
          minutes: 30 + weekday * 10,
        })),
      },
      {
        mode: 'fixed',
        slots: [
          { weekday: 1, kind: 'endurance', minutes: 20 },
          { weekday: 3, kind: 'endurance', minutes: 240 },
          { weekday: 5, kind: 'strength_gym', minutes: 45 },
        ],
      },
      { mode: 'fixed', slots: [{ weekday: 4, kind: 'endurance', minutes: 10 }] },
    ];
    const PEOPLE: Person[] = [];
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      for (const birthDate of ['2009-12-01', '1990-01-01', '1961-11-20', '1940-01-01']) {
        for (const screening of [
          { flags: [] },
          null,
          { flags: ['injury', 'conservative_plan'] },
        ] as const) {
          PEOPLE.push({ level, birthDate, screening: screening as Person['screening'] });
        }
      }
    }
    // Was sich zwischen den Blöcken ändert (strenger): nichts, neues Flag, Schwangerschaft.
    const LATER: (Person['screening'] | 'same')[] = [
      'same',
      { flags: ['medication', 'conservative_plan'] },
      { flags: ['pregnancy', 'conservative_plan'] },
    ];
    const violations: string[] = [];
    let count = 0;
    for (const schedule of SCHEDULES) {
      const wishSum = schedule.slots
        .filter((s) => s.kind === 'endurance')
        .reduce((a, s) => a + s.minutes, 0);
      for (const p of PEOPLE) {
        const today = addDays(MONDAY, count % 7);
        count += 1;
        const result = generateTrainingPlan(
          person({
            goalType: 'endurance',
            discipline: '10k',
            experienceLevel: p.level,
            birthDate: p.birthDate,
            healthScreening: p.screening as never,
            homeEquipment: [...FULL_HOME],
            schedule,
          }),
          library,
          today,
        );
        const label = `${count}/${p.level}/${p.birthDate}/${JSON.stringify(p.screening)}`;
        if (!result.ok) {
          violations.push(`${label}: ${result.error}`);
          continue;
        }
        const exp1 = expected(p, today);
        const first = check(result.plan.sessions, exp1, wishSum, null, `${label} B1`);
        violations.push(...first.violations);
        for (const later of LATER) {
          const lastDate = result.plan.sessions
            .map((s) => s.scheduled_on)
            .sort()
            .at(-1) as string;
          const nextStart = addDays(startOfIsoWeek(lastDate), 7);
          const p2: Person = { ...p, screening: later === 'same' ? p.screening : later };
          const rules2 = planSafetyRules(
            { experienceLevel: p.level, birthDate: p.birthDate, healthScreening: p2.screening },
            nextStart,
          );
          const next = nextPlanBlock(result.plan.sessions, {
            schedule: result.plan.inputs.schedule,
            loadWeeks: 4,
            rules: rules2,
            library: library.exercises,
            profiles: new Map([
              ['gym', equipmentProfile('gym', [])],
              ['home', equipmentProfile('home', [...FULL_HOME])],
            ]),
            endurance: { goalType: 'endurance', discipline: '10k', experienceLevel: p.level },
            previousStartGroup: result.plan.safety_rules.enduranceStartGroup,
          });
          const exp2 = expected(p2, nextStart);
          const rank = ['cautious', 'beginner', 'advanced', 'competitive'];
          const stricter = rank.indexOf(exp2.group) < rank.indexOf(exp1.group);
          violations.push(
            ...check(
              next,
              exp2,
              wishSum,
              { volume: first.lastLoad, sessionCap: first.lastLongest, stricter },
              `${label} B2(${JSON.stringify(later)})`,
            ).violations,
          );
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    expect(count).toBe(4 * 36);
  }, 120_000);
});
