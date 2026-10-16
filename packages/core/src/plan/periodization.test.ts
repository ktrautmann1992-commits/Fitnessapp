import { describe, expect, it } from 'vitest';

import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import { EXPERIENCE_LEVELS } from '../enums';
import { COMPETITION_DISCIPLINES, type CompetitionDiscipline } from './competition-schema';
import {
  competitionBlocks,
  deloadRhythm,
  isLoadWeek,
  type MacroCycle,
  macroCycle,
  type MacroCycleInputs,
  nextCompetitionBlock,
  taperWeekCount,
  trailingLoadWeeks,
} from './periodization';
import type { EnduranceStartGroup } from './safety';

// Feste Tabellen (Plan 3.1, W-G3) – bewusst nicht aus constants.ts.
const TAPER_MIN_DAYS = { '5k': 7, '10k': 7, half_marathon: 10, marathon: 14 } as const;
const RECOVERY_WEEKS = { '5k': 1, '10k': 1, half_marathon: 1, marathon: 2 } as const;
const PHASE_ORDER = ['base', 'build', 'peak', 'taper', 'race_week', 'recovery'];
const MONDAY = '2026-10-05';

function cycle(overrides: Partial<MacroCycleInputs> = {}, planStart = MONDAY): MacroCycle {
  const c = macroCycle(
    {
      discipline: 'half_marathon',
      raceDate: addDays(MONDAY, 16 * 7 + 6),
      experienceLevel: 'beginner',
      group: 'beginner',
      cautious: false,
      ...overrides,
    },
    planStart,
  );
  if (!c) throw new Error('kein Zyklus');
  return c;
}

/** Erwarteter Rhythmus unabhängig hergeleitet: Basis 5 (Einsteiger) bzw. 4, Aufbau/Spitze 3 für Einsteiger/vorsichtig. */
function expectedRhythm(
  phase: string,
  level: string,
  group: EnduranceStartGroup,
  cautious: boolean,
): number {
  const base = cautious ? 4 : level === 'beginner' ? 5 : 4;
  if (phase !== 'build' && phase !== 'peak') return base;
  return group === 'cautious' || level === 'beginner' ? Math.min(base, 3) : base;
}

function checkCycle(c: MacroCycle, inputs: MacroCycleInputs, planStart: string): string[] {
  const errors: string[] = [];
  const weeks = c.weeks;
  // Wochen lückenlos ab der Woche des Planstarts.
  weeks.forEach((w, i) => {
    if (w.index !== i || w.monday !== addDays(startOfIsoWeek(planStart), 7 * i)) {
      errors.push(`Woche ${i} nicht lückenlos`);
    }
  });
  // Phasen in Reihenfolge.
  for (let i = 1; i < weeks.length; i += 1) {
    const a = PHASE_ORDER.indexOf(weeks[i - 1]?.phase ?? '');
    const b = PHASE_ORDER.indexOf(weeks[i]?.phase ?? '');
    if (b < a) errors.push(`Phase rückwärts in Woche ${i}`);
  }
  const race = weeks.find((w) => w.phase === 'race_week');
  if (!race || race.monday !== startOfIsoWeek(inputs.raceDate)) errors.push('Rennwoche falsch');
  if (weeks.filter((w) => w.phase === 'race_week').length !== 1)
    errors.push('nicht genau 1 Rennwoche');
  if (weeks.filter((w) => w.phase === 'recovery').length !== RECOVERY_WEEKS[inputs.discipline]) {
    errors.push('Erholung nach dem Rennen falsch');
  }
  // Tapering nie kürzer als die Tabelle.
  const taper = weeks.filter((w) => w.phase === 'taper');
  const taperDays = taper.length * 7 + isoWeekday(inputs.raceDate) - 1;
  if (taperDays < TAPER_MIN_DAYS[inputs.discipline]) errors.push(`Tapering ${taperDays} Tage`);
  if (taperDays !== c.taperDays) errors.push('taperDays falsch');
  if (taper.length > 0 && taper[0]?.monday !== addDays(race?.monday ?? '', -7 * taper.length)) {
    errors.push('Tapering nicht direkt vor der Rennwoche');
  }
  const pre = weeks.filter((w) => w.volumeFactor === null);
  // Nie Erholung in der letzten Woche vor dem Tapering.
  if (pre.at(-1)?.deload) errors.push('Erholungswoche direkt vor dem Tapering');
  // Höchstens `Rhythmus` Belastungswochen in Folge (angebrochene Startwoche zählt nicht).
  let run = 0;
  for (const w of pre) {
    if (w.partial) continue;
    if (w.deload) {
      run = 0;
      continue;
    }
    run += 1;
    if (run > expectedRhythm(w.phase, inputs.experienceLevel, inputs.group, inputs.cautious)) {
      errors.push(`${run} Belastungswochen in Folge (${w.phase})`);
    }
  }
  // Angebrochene Startwoche nur, wenn der Plan nicht montags beginnt.
  if ((weeks[0]?.partial ?? false) !== (isoWeekday(planStart) !== 1)) errors.push('Woche 0 falsch');
  // Mindestens eine volle Belastungswoche.
  if (!weeks.some(isLoadWeek)) errors.push('keine Belastungswoche');
  // Blöcke höchstens Woche 0 + 6 Wochen, Folgeblöcke ohne Woche 0/Einstiegswoche.
  competitionBlocks(c, 100).forEach((block, b) => {
    const nos = block.specs.map((s) => s.weekNo);
    if (Math.max(...nos) > 6) errors.push(`Block ${b + 1} zu lang`);
    if (b > 0 && block.specs.some((s) => s.weekNo === 0 || s.kind === 'intro')) {
      errors.push(`Folgeblock ${b + 1} mit Woche 0/Einstieg`);
    }
    if (b === 0 && block.specs.filter((s) => s.kind === 'intro').length !== 1) {
      errors.push('erster Block ohne genau eine Einstiegswoche');
    }
  });
  // Freie Tage: Vortag, Renntag, Rest der Rennwoche.
  const expected: string[] = [];
  for (
    let d = addDays(inputs.raceDate, -1);
    d <= addDays(race?.monday ?? '', 6);
    d = addDays(d, 1)
  ) {
    expected.push(d);
  }
  if (JSON.stringify(c.excludedDates) !== JSON.stringify(expected))
    errors.push('freie Tage falsch');
  return errors;
}

describe('taperWeekCount', () => {
  it.each([
    // Wochentag des Rennens 1 (Mo) … 7 (So): 7n + (Wochentag − 1) ≥ Mindest-Tage.
    ['5k', [1, 1, 1, 1, 1, 1, 1]],
    ['10k', [1, 1, 1, 1, 1, 1, 1]],
    ['half_marathon', [2, 2, 2, 1, 1, 1, 1]],
    ['marathon', [2, 2, 2, 2, 2, 2, 2]],
  ] as const)('%s', (discipline, expected) => {
    // 2026-10-05 ist ein Montag.
    expect(expected.map((_, k) => taperWeekCount(discipline, addDays(MONDAY, k)))).toEqual(
      expected,
    );
  });
});

describe('deloadRhythm (W-G3)', () => {
  it('Einsteiger: Basis 5, Aufbau/Spitze 3; Fortgeschritten 4 überall; vorsichtig 4/3', () => {
    const b = { experienceLevel: 'beginner', group: 'beginner', cautious: false } as const;
    const a = { experienceLevel: 'advanced', group: 'advanced', cautious: false } as const;
    const c = { experienceLevel: 'advanced', group: 'cautious', cautious: true } as const;
    expect([deloadRhythm('base', b), deloadRhythm('build', b), deloadRhythm('peak', b)]).toEqual([
      5, 3, 3,
    ]);
    expect([deloadRhythm('base', a), deloadRhythm('build', a), deloadRhythm('peak', a)]).toEqual([
      4, 4, 4,
    ]);
    expect([deloadRhythm('base', c), deloadRhythm('build', c), deloadRhythm('peak', c)]).toEqual([
      4, 3, 3,
    ]);
    // Ab 65 ohne Flag: Startgruppe vorsichtig, Plan nicht „cautious“ → Basis wie Level, Aufbau 3.
    const senior = { experienceLevel: 'advanced', group: 'cautious', cautious: false } as const;
    expect([deloadRhythm('base', senior), deloadRhythm('build', senior)]).toEqual([4, 3]);
  });
});

describe('macroCycle – Beispiele', () => {
  it('Halbmarathon Einsteiger, Planstart Montag, Rennen Sonntag in 16 Wochen + 6 Tagen', () => {
    const c = cycle();
    const phases = c.weeks.map((w) => `${w.phase}${w.deload ? '*' : ''}`);
    expect(phases.join(' ')).toBe(
      'base base base base base base* base base build build* build build peak peak* peak taper race_week recovery',
    );
    expect(c.weeks.map((w) => w.volumeFactor).slice(-3)).toEqual([0.7, 0.4, 0.5]);
    expect(c.taperDays).toBe(13);
    expect(c.weeks[0]?.partial).toBe(false);
  });

  it('Erholungswoche fiele in die letzte Woche vor dem Tapering → eine Woche vorgezogen, nie gestrichen', () => {
    const c = cycle({ raceDate: addDays(MONDAY, 16 * 7) });
    const pre = c.weeks.filter((w) => w.volumeFactor === null);
    expect(pre.map((w) => `${w.phase}${w.deload ? '*' : ''}`).slice(-3)).toEqual([
      'peak',
      'peak*',
      'peak',
    ]);
    expect(c.weeks.filter((w) => w.deload)).toHaveLength(3);
  });

  it('Renntag Montag: Vortag (Sonntag) liegt in der letzten Tapering-Woche und ist frei', () => {
    const raceDate = addDays(MONDAY, 16 * 7);
    const c = cycle({ raceDate });
    expect(isoWeekday(raceDate)).toBe(1);
    expect(c.weeks.filter((w) => w.phase === 'taper')).toHaveLength(2);
    expect(c.taperDays).toBe(14);
    expect(c.excludedDates[0]).toBe(addDays(raceDate, -1));
    expect(c.excludedDates).toHaveLength(8);
    const blocks = competitionBlocks(c, 140);
    const taperSpec = blocks.at(-1)?.specs[1];
    expect(taperSpec?.excludedDates).toContain(addDays(raceDate, -1));
  });

  it('Planstart mitten in der Woche: Woche 0 angebrochen, zählt nicht für den Rhythmus', () => {
    const wednesday = addDays(MONDAY, 2);
    const c = cycle({}, wednesday);
    expect(c.weeks[0]).toMatchObject({ partial: true, deload: false, monday: MONDAY });
    const [first] = competitionBlocks(c, 140);
    expect(first?.specs.map((s) => `${s.weekNo}${s.kind[0]}`)).toEqual([
      '0i',
      '1l',
      '2l',
      '3l',
      '4l',
      '5l',
      '6d',
    ]);
  });

  it('Marathon: 2 Wochen Erholung nach dem Rennen, Tapering 2 Wochen', () => {
    const c = cycle({ discipline: 'marathon', raceDate: addDays(MONDAY, 24 * 7 + 6) });
    expect(c.weeks.filter((w) => w.phase === 'recovery').map((w) => w.volumeFactor)).toEqual([
      0.5, 0.6,
    ]);
    expect(c.weeks.filter((w) => w.phase === 'taper').map((w) => w.volumeFactor)).toEqual([
      0.75, 0.6,
    ]);
  });

  it('null ohne volle Belastungswoche vor dem Tapering bzw. Renntag nicht nach dem Start', () => {
    const base = {
      discipline: '5k',
      experienceLevel: 'competitive',
      group: 'competitive',
      cautious: false,
    } as const;
    expect(macroCycle({ ...base, raceDate: MONDAY }, MONDAY)).toBeNull();
    // Rennen Sonntag derselben Woche + 1: Woche 0 = Tapering → keine Belastungswoche.
    expect(macroCycle({ ...base, raceDate: addDays(MONDAY, 13) }, MONDAY)).toBeNull();
    expect(macroCycle({ ...base, raceDate: addDays(MONDAY, 20) }, MONDAY)).not.toBeNull();
    expect(macroCycle({ ...base, raceDate: addDays(MONDAY, 20) }, addDays(MONDAY, 1))).toBeNull();
  });

  it('deterministisch: gleiche Eingaben → gleiches Ergebnis', () => {
    expect(JSON.stringify(cycle())).toBe(JSON.stringify(cycle()));
  });
});

describe('Blöcke und Folgeblock', () => {
  it('Schnitt nach jeder Erholungswoche und vor dem Tapering; Plateau auf Belastungswochen', () => {
    const blocks = competitionBlocks(cycle(), 140);
    expect(blocks.map((b) => b.specs.map((s) => s.kind[0]).join(''))).toEqual([
      'illlld',
      'llld',
      'llld',
      'l',
      'ddd',
    ]);
    for (const block of blocks) {
      for (const spec of block.specs) {
        if (spec.kind === 'deload') expect(spec.enduranceMaxBudget).toBeUndefined();
        else expect(spec.enduranceMaxBudget).toBe(140);
      }
    }
  });

  it('nextCompetitionBlock: beginnt immer am Montag nach der Woche der letzten Einheit, am Ende null (Wächter M1)', () => {
    const c = cycle();
    const blocks = competitionBlocks(c, 140);
    const lastOfFirst = addDays(blocks[0]?.weeks.at(-1)?.monday ?? '', 3);
    const next = nextCompetitionBlock(c, 140, lastOfFirst);
    expect(next?.weeks[0]?.monday).toBe(blocks[1]?.weeks[0]?.monday);
    expect(next?.specs.map((s) => s.kind[0]).join('')).toBe('llld');
    // Letzte Einheit früher (z. B. Rest gestrichen) → direkt danach weiter, keine Woche ohne Plan.
    const early = nextCompetitionBlock(c, 140, blocks[0]?.weeks[1]?.monday ?? '');
    expect(early?.weeks[0]?.monday).toBe(blocks[0]?.weeks[2]?.monday);
    expect(early?.specs.every((s) => s.kind !== 'intro' && s.weekNo >= 1)).toBe(true);
    const end = addDays(c.weeks.at(-1)?.monday ?? '', 6);
    expect(nextCompetitionBlock(c, 140, end)).toBeNull();
  });

  it('Neustart des Rhythmus (CycleRestart): ohne Änderung dieselben Erholungswochen, sonst ab dem Neustart gezählt', () => {
    const c = cycle();
    const restartAt = c.weeks[6]?.monday ?? '';
    const same = macroCycle(
      {
        discipline: 'half_marathon',
        raceDate: addDays(MONDAY, 16 * 7 + 6),
        experienceLevel: 'beginner',
        group: 'beginner',
        cautious: false,
      },
      MONDAY,
      { fromMonday: restartAt, loadWeeksBefore: 0 },
    );
    expect(same?.weeks.slice(6).map((w) => w.deload)).toEqual(
      c.weeks.slice(6).map((w) => w.deload),
    );
    // 4 Belastungswochen davor (Rhythmus 5) → nach einer weiteren sofort Erholung.
    const late = macroCycle(
      {
        discipline: 'half_marathon',
        raceDate: addDays(MONDAY, 16 * 7 + 6),
        experienceLevel: 'beginner',
        group: 'beginner',
        cautious: false,
      },
      MONDAY,
      { fromMonday: c.weeks[2]?.monday ?? '', loadWeeksBefore: 4 },
    );
    expect(late?.weeks.slice(2, 5).map((w) => w.deload)).toEqual([false, true, false]);
    expect(trailingLoadWeeks([])).toBe(0);
    expect(
      trailingLoadWeeks([
        { scheduled_on: addDays(MONDAY, 1), week_no: 0, is_deload: false },
        { scheduled_on: addDays(MONDAY, 8), week_no: 1, is_deload: false },
        { scheduled_on: addDays(MONDAY, 15), week_no: 2, is_deload: true },
        { scheduled_on: addDays(MONDAY, 22), week_no: 3, is_deload: false },
        { scheduled_on: addDays(MONDAY, 29), week_no: 4, is_deload: false },
      ]),
    ).toBe(2);
    expect(
      trailingLoadWeeks([
        { scheduled_on: addDays(MONDAY, 1), week_no: 0, is_deload: false },
        { scheduled_on: addDays(MONDAY, 8), week_no: 1, is_deload: false },
      ]),
    ).toBe(1);
  });
});

describe('Eigenschaften (alle Distanzen, Level, Gruppen, Wochentage, 1–52 Wochen)', () => {
  it('Phasen geordnet, Tapering ≥ Tabelle, Rhythmus, nie Erholung vor dem Tapering, Blöcke ≤ 6 Wochen', () => {
    const groups: [EnduranceStartGroup, boolean][] = [
      ['cautious', true],
      ['cautious', false],
    ];
    const errors: string[] = [];
    let cycles = 0;
    for (const discipline of COMPETITION_DISCIPLINES as readonly CompetitionDiscipline[]) {
      for (const level of EXPERIENCE_LEVELS) {
        for (const [group, cautious] of [
          [level, false] as [EnduranceStartGroup, boolean],
          ...groups,
        ]) {
          for (let start = 0; start < 7; start += 1) {
            const planStart = addDays(MONDAY, start);
            for (let days = 1; days <= 52 * 7; days += 3) {
              const inputs = {
                discipline,
                raceDate: addDays(planStart, days),
                experienceLevel: level,
                group,
                cautious,
              };
              const c = macroCycle(inputs, planStart);
              if (!c) continue;
              cycles += 1;
              for (const e of checkCycle(c, inputs, planStart)) {
                errors.push(`${discipline}/${level}/${group}/${planStart}/+${days}: ${e}`);
              }
            }
          }
        }
      }
    }
    expect(cycles).toBeGreaterThan(20_000);
    expect(errors.slice(0, 10)).toEqual([]);
  }, 60_000);
});
