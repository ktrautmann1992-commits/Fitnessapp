/**
 * Wettkampfplan (docs/PLAN-PHASE-10.md Abschnitt 5, Etappe WP1): erster Block über generateCompetitionPlan, Folgeblöcke
 * über competitionFollowUpBlock + nextPlanBlock. Erwartungen UNABHÄNGIG hergeleitet (feste Zahlen aus Plan 3.1–3.3),
 * nicht aus Zwischenwerten der Engine. Dazu der Regressionstest „ohne Wettkampf byte-gleich“.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import {
  type CompetitionRequest,
  competitionVolumePreview,
  competitionFeasibility,
} from './competition';
import { equipmentProfile } from './equipment-profile';
import {
  generateCompetitionPlan,
  generatedCompetitionPlanSchema,
  generatedPlanSchema,
  generateTrainingPlan,
} from './generate';
import type { PlanInputsInput } from './inputs';
import { planSafetyRules } from './safety';
import { nextPlanBlock } from './schedule';
import {
  chainViolations,
  enduranceByWeek,
  fixed,
  fullPlan,
  type Kind,
  library,
  request,
  rhythmViolations,
  runner,
  START,
} from './competition-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';

describe('generateCompetitionPlan – Beispiele', () => {
  it('Halbmarathon Einsteiger: Plan im Datenbank-Rahmen, Wettkampf-Teil nur hier', () => {
    const result = generateCompetitionPlan(
      runner('half_marathon'),
      library,
      MONDAY,
      request('half_marathon', addDays(MONDAY, 17 * 7 + 6)),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { plan } = result;
    expect(generatedPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.competition?.feasibility.status).toBe('ok');
    expect(plan.competition?.block_weeks.map((w) => `${w.week_no}:${w.phase}`)).toEqual([
      '1:base',
      '2:base',
      '3:base',
      '4:base',
      '5:base',
      '6:base',
    ]);
    expect(plan.sessions.filter((s) => s.week_no === 6).every((s) => s.is_deload)).toBe(true);
    // Ohne Wettkampf: Schlüssel fehlt.
    const plain = generateTrainingPlan(runner('half_marathon'), library, MONDAY);
    expect(plain.ok && 'competition' in plain.plan).toBe(false);
  });

  it('Leistungssport 5 km in 4 Wochen: Tapering-Block mit freiem Vortag, Renntag und Rest der Rennwoche', () => {
    const race = addDays(MONDAY, 4 * 7 + 5); // Samstag
    const inputs = runner('5k', 'competitive', {
      schedule: fixed(
        [1, 'strength_gym', 60],
        [2, 'endurance', 60],
        [4, 'endurance', 60],
        [5, 'endurance', 45],
        [6, 'endurance', 60],
        [7, 'endurance', 90],
      ),
    });
    const { sessions, endReason } = fullPlan(inputs, request('5k', race), MONDAY);
    expect(endReason).toBe('cycle_finished');
    for (const day of [addDays(race, -1), race, addDays(race, 1)]) {
      expect(
        sessions.some((s) => s.scheduled_on === day),
        day,
      ).toBe(false);
    }
    // Rennwoche: Einheiten nur vor dem Vortag; danach eine Erholungswoche.
    const raceWeek = sessions.filter(
      (s) => startOfIsoWeek(s.scheduled_on) === startOfIsoWeek(race),
    );
    expect(raceWeek.length).toBeGreaterThan(0);
    expect(raceWeek.every((s) => s.scheduled_on < addDays(race, -1) && s.is_deload)).toBe(true);
    expect(sessions.some((s) => s.scheduled_on > addDays(startOfIsoWeek(race), 6))).toBe(true);
    expect(chainViolations(sessions, START.competitive)).toEqual([]);
  });

  it('„zu kurz“ erzeugt keinen Plan – auch nicht über einen Umweg', () => {
    const result = generateCompetitionPlan(
      runner('marathon'),
      library,
      MONDAY,
      request('marathon', addDays(MONDAY, 23 * 7 + 6)),
    );
    expect(result.ok).toBe(false);
    if (result.ok || result.error !== 'competition_not_feasible') throw new Error('erwartet');
    expect(result.feasibility.status).toBe('too_short');
    const pregnant = generateCompetitionPlan(
      runner('10k', 'advanced', { healthScreening: { flags: ['pregnancy'] } }),
      library,
      MONDAY,
      request('10k', addDays(MONDAY, 30 * 7)),
    );
    expect(pregnant.ok).toBe(false);
  });

  it('Folgeblock mit strengerer Gruppe (65. Geburtstag): Umfang beginnt wieder beim vorsichtigen Start', () => {
    const birthDate = '1962-01-20'; // 65 am 20.01.2027
    const inputs = runner('half_marathon', 'advanced', { birthDate });
    const req = request('half_marathon', '2027-03-14');
    const { sessions } = fullPlan(inputs, req, MONDAY, (blockNo) => ({
      inputs,
      today: blockNo >= 3 ? '2027-01-25' : MONDAY,
    }));
    const third = sessions.filter((s) => s.block_no === 3);
    expect(third.length).toBeGreaterThan(0);
    const firstWeek = Math.min(...third.map((s) => s.week_no));
    const minutes = third
      .filter((s) => s.week_no === firstWeek && s.kind === 'endurance')
      .reduce((sum, s) => sum + s.estimated_minutes, 0);
    expect(minutes).toBeLessThanOrEqual(Math.floor(START.cautious * 1.1));
    // Ab 65: nur zügiges Gehen (bestehende Regel), nichts über 10 %.
    expect(
      third.filter((s) => s.kind === 'endurance').every((s) => s.endurance_modality === 'walk'),
    ).toBe(true);
    expect(chainViolations(sessions, START.advanced)).toEqual([]);
  });

  it('Schwangerschaft zwischen den Blöcken: kein weiterer Wettkampf-Block (not_available)', () => {
    const inputs = runner('half_marathon', 'advanced');
    const pregnant = { ...inputs, healthScreening: { flags: ['pregnancy' as const] } };
    const { endReason, sessions } = fullPlan(
      inputs,
      request('half_marathon', addDays(MONDAY, 20 * 7)),
      MONDAY,
      () => ({ inputs: pregnant, today: addDays(MONDAY, 40) }),
    );
    expect(endReason).toBe('not_available');
    expect(Math.max(...sessions.map((s) => s.block_no))).toBe(1);
  });
});

describe('Wächter-Befunde WP1 am fertigen Plan', () => {
  it('H1: 70 Jahre mit Tagebuch-Bezug aus einem weniger strengen Plan → Start 45 min, Einheiten ≤ 20 min', () => {
    const senior = runner('half_marathon', 'advanced', { birthDate: '1956-01-01' });
    const result = generateCompetitionPlan(senior, library, MONDAY, {
      ...request('half_marathon', addDays(MONDAY, 30 * 7)),
      startReference: { volume: 200, sessionCap: 90, startGroup: 'advanced' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const week1 = result.plan.sessions.filter((s) => s.week_no === 1 && s.kind === 'endurance');
    expect(week1.reduce((sum, s) => sum + s.estimated_minutes, 0)).toBeLessThanOrEqual(
      Math.floor(START.cautious * 1.1),
    );
    expect(week1.every((s) => s.estimated_minutes <= 20)).toBe(true);
  });

  it('M2: eigener Startumfang nur im ersten Block – ohne Tagebuch-Einträge startet Block 2 beim Start der Gruppe', () => {
    const inputs = runner('half_marathon', 'advanced', {
      schedule: fixed(
        [2, 'endurance', 90],
        [4, 'endurance', 90],
        [6, 'endurance', 90],
        [7, 'endurance', 120],
      ),
    });
    const req = {
      ...request('half_marathon', addDays(MONDAY, 30 * 7)),
      ownStart: { weeklyMinutes: 300, confirmed: true as const },
    };
    const { sessions } = fullPlan(inputs, req, MONDAY, undefined, { logged: 'none' });
    const sum = (block: number, week: number) =>
      sessions
        .filter((s) => s.block_no === block && s.week_no === week && s.kind === 'endurance')
        .reduce((total, s) => total + s.estimated_minutes, 0);
    expect(sum(1, 1)).toBe(2 * START.advanced);
    expect(sum(2, 1)).toBe(START.advanced);
  });

  it('M1: Flag fällt ab Block 2 weg (Rhythmus 4 → 5): Zähler ab dem Neustart, keine doppelte Erholungswoche', () => {
    const inputs = runner('half_marathon', 'beginner', { healthScreening: { flags: ['injury'] } });
    const healthy = { ...inputs, healthScreening: { flags: [] } };
    const { weeks, gaps } = fullPlan(
      inputs,
      request('half_marathon', addDays(MONDAY, 40 * 7 + 6)),
      MONDAY,
      (blockNo) =>
        blockNo >= 2 ? { inputs: healthy, today: addDays(MONDAY, 40) } : { inputs, today: MONDAY },
    );
    expect(gaps).toEqual([]);
    expect(rhythmViolations(weeks)).toEqual([]);
  });

  it('M1: Gesundheits-Flag ab Block 2 (Rhythmus 5 → 4): keine Woche ohne Plan, Rhythmus eingehalten', () => {
    const inputs = runner('half_marathon');
    const flagged = { ...inputs, healthScreening: { flags: ['injury' as const] } };
    const { weeks, gaps, sessions } = fullPlan(
      inputs,
      request('half_marathon', addDays(MONDAY, 40 * 7 + 6)),
      MONDAY,
      (blockNo) =>
        blockNo >= 2 ? { inputs: flagged, today: addDays(MONDAY, 40) } : { inputs, today: MONDAY },
    );
    expect(gaps).toEqual([]);
    expect(rhythmViolations(weeks)).toEqual([]);
    const mondays = new Set(sessions.map((s) => startOfIsoWeek(s.scheduled_on)));
    for (let k = 0; k < 40; k += 1)
      expect(mondays.has(addDays(MONDAY, 7 * k)), `Woche ${k}`).toBe(true);
  });
});

/** JSON ohne `activeAging: false` (neues Feld der Sicherheitsregeln, Fit im Alter FA1). */
function withoutActiveAgingFalse(key: string, value: unknown): unknown {
  // Sportarten Stufe 1 (Etappe Y): die Regel-Liste kennt neu `inversion` (vorsichtig, Schwangerschaft) und
  // `trunk_rotation` (Schwangerschaft) – keine Übung vor Stufe 1 trägt sie, die Einheiten bleiben byte-gleich.
  if (key === 'excludedCautionTags' && Array.isArray(value)) {
    return value.filter((tag) => tag !== 'inversion' && tag !== 'trunk_rotation');
  }
  return key === 'activeAging' && value === false ? undefined : value;
}

describe('Regression: ohne Wettkampf byte-gleich (Plan 5)', () => {
  it('reine Ausdauer-Pläne + Folgeblock: Prüfsumme wie vor WP1 (origin/main 6e6b4ff)', () => {
    // Raster ist eine Teilmenge des manuell gegen origin/main geprüften Rasters (Umsetzungsstand WP1). Nur Ausdauer,
    // damit die Prüfsumme nicht vom Übungs-Bestand in content/ abhängt. Ändert sich die Engine BEWUSST, neue Summe
    // eintragen und im Plan begründen.
    const hash = createHash('sha256');
    let count = 0;
    const levels = ['beginner', 'advanced', 'competitive'] as const;
    const disciplines = [
      null,
      '5k',
      'half_marathon',
      'marathon',
      'cycling',
      'triathlon_sprint',
    ] as const;
    const screenings = [
      null,
      { flags: [] },
      { flags: ['injury'] },
      { flags: ['pregnancy'] },
    ] as const;
    const births = ['2009-03-01', '1996-01-15', '1958-06-01'];
    const schedules = [
      fixed([2, 'endurance', 45], [4, 'endurance', 45], [6, 'endurance', 90]),
      fixed(...[1, 2, 3, 4, 5, 6, 7].map((w): [number, Kind, number] => [w, 'endurance', 40])),
      fixed([7, 'endurance', 120]),
    ];
    for (let d = 0; d < 7; d += 1) {
      for (const level of levels) {
        for (const discipline of disciplines) {
          for (const screening of screenings) {
            for (const birthDate of births) {
              for (const schedule of schedules) {
                const today = addDays('2026-10-05', d);
                const inputs = person({
                  goalType: 'endurance',
                  discipline,
                  experienceLevel: level,
                  schedule,
                  birthDate,
                  healthScreening: screening as PlanInputsInput['healthScreening'],
                  homeEquipment: [...FULL_HOME],
                });
                const r = generateTrainingPlan(inputs, library, today);
                // Fit im Alter (FA1): neues Feld safety_rules.activeAging (hier immer false) – ohne dieses Feld muss
                // der Plan byte-gleich bleiben.
                hash.update(JSON.stringify(r, withoutActiveAgingFalse));
                count += 1;
                if (!r.ok) continue;
                const rules = planSafetyRules(
                  {
                    experienceLevel: level,
                    birthDate,
                    healthScreening: screening as PlanInputsInput['healthScreening'] & object,
                  },
                  today,
                );
                const next = nextPlanBlock(r.plan.sessions, {
                  schedule: r.plan.inputs.schedule,
                  loadWeeks: r.plan.load_weeks,
                  rules,
                  library: library.exercises,
                  profiles: new Map([
                    ['home', equipmentProfile('home', [...FULL_HOME])],
                    ['gym', equipmentProfile('gym', [])],
                  ]),
                  endurance: {
                    goalType: 'endurance',
                    discipline: r.plan.inputs.discipline,
                    experienceLevel: level,
                  },
                  previousStartGroup: r.plan.safety_rules.enduranceStartGroup,
                  loadWeeksBefore: r.plan.load_weeks,
                });
                hash.update(JSON.stringify(next));
              }
            }
          }
        }
      }
    }
    expect(count).toBe(4536);
    expect(hash.digest('hex')).toBe(
      '648532a4449845efc4481916d91be619e9c15c21c8de7911b103800e86b45c07',
    );
  }, 60_000);
});

describe('Eigenschaften über den ganzen Wettkampfplan', () => {
  // Deterministischer Zufall (LCG), damit Fehler reproduzierbar sind.
  function random(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
  }
  const pick = <T>(r: () => number, values: readonly T[]): T =>
    values[Math.floor(r() * values.length)] as T;

  it('10-%-Kette, Start-Deckel, Plan = Ampel-Vorschau, freie Renntage, Datenbank-Rahmen, Rhythmus phasengenau, keine Lücke; „zu kurz“ nie ein Plan (400 Läufe, Varianten)', () => {
    const r = random(20261016);
    const errors: string[] = [];
    let plans = 0;
    let refused = 0;
    const variants = new Map<string, number>();
    for (let i = 0; i < 400; i += 1) {
      const variant = pick(r, ['plain', 'own_start', 'reference', 'flex', 'group_change'] as const);
      const discipline = pick(r, ['5k', '10k', 'half_marathon', 'marathon'] as const);
      const level = pick(r, ['beginner', 'advanced', 'competitive'] as const);
      const flags = pick(r, [[], [], [], ['injury'], ['pregnancy']] as const);
      const birthDate = pick(r, ['1996-01-15', '2009-12-01', '1958-06-01', '1936-02-02']);
      const today = addDays(MONDAY, Math.floor(r() * 7));
      const enduranceDays = 1 + Math.floor(r() * 6);
      const weekdays = [2, 4, 6, 7, 3, 5].slice(0, enduranceDays);
      const slots: [number, Kind, number][] = weekdays.map((w) => [
        w,
        'endurance',
        pick(r, [30, 45, 60, 90, 120]),
      ]);
      if (r() < 0.4) slots.push([1, pick(r, ['strength_gym', 'strength_home'] as const), 60]);
      const schedule =
        variant === 'flex'
          ? { mode: 'flex' as const, slots: slots.map(([, kind, minutes]) => ({ kind, minutes })) }
          : fixed(...slots);
      const inputs = runner(discipline, level, {
        schedule,
        birthDate,
        healthScreening: { flags: [...flags] },
      });
      const raceDate = addDays(today, 7 + Math.floor(r() * 350));
      const refVolume = pick(r, [0, 10, 45, 90, 150, 240, 400, 900]);
      const startGroup = pick(r, ['cautious', 'beginner', 'advanced', 'competitive'] as const);
      const req: CompetitionRequest = {
        ...request(discipline, raceDate),
        ...(variant === 'own_start'
          ? { ownStart: { weeklyMinutes: pick(r, [10, 100, 200, 300, 600]), confirmed: true } }
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
      const generated = generateCompetitionPlan(inputs, library, today, req);
      if (!generated.ok && generated.error === 'invalid_inputs') {
        errors.push(`${i}: ungültig`);
        continue;
      }
      // Ampel unabhängig vom Erzeugen: „zu kurz“/„nicht möglich“ darf nie einen Plan haben.
      const feasibility = competitionFeasibility(inputs, req, today);
      const status = feasibility.ok ? feasibility.feasibility.status : 'invalid';
      if (status === 'too_short' || status === 'not_available') {
        refused += 1;
        if (generated.ok) errors.push(`${i}: ${status} hat einen Plan erzeugt`);
        continue;
      }
      if (!generated.ok) {
        if (generated.error !== 'no_template') errors.push(`${i}: ${generated.error}`);
        continue;
      }
      plans += 1;
      variants.set(variant, (variants.get(variant) ?? 0) + 1);
      // Gruppenwechsel ab Block 2: strenger (Flag, Einsteiger) oder lockerer (Flag fällt weg, Leistungssport).
      const change = pick(r, ['flag', 'beginner', 'looser'] as const);
      const changed: PlanInputsInput =
        change === 'flag'
          ? { ...inputs, healthScreening: { flags: ['injury'] } }
          : change === 'beginner'
            ? { ...inputs, experienceLevel: 'beginner' }
            : { ...inputs, healthScreening: { flags: [] }, experienceLevel: 'competitive' };
      const { sessions, weeks, gaps } = fullPlan(
        inputs,
        req,
        today,
        variant === 'group_change'
          ? (blockNo) =>
              blockNo >= 2 ? { inputs: changed, today: addDays(today, 30) } : { inputs, today }
          : undefined,
      );
      const group = planSafetyRules(
        { experienceLevel: level, birthDate, healthScreening: { flags: [...flags] } },
        today,
      ).enduranceStartGroup;
      const groupStart = START[group];
      // Startwert der Kette unabhängig hergeleitet: Bezug (gedeckelt 2 × Gruppe, bei strengerer Gruppe ≤ Start der
      // Gruppe) bzw. eigener Startumfang (nur Fortgeschritten/Leistungssport, ≤ 2 × Gruppe) bzw. Start der Gruppe.
      const ORDER = ['cautious', 'beginner', 'advanced', 'competitive'];
      const ref = req.startReference && req.startReference.volume > 0 ? req.startReference : null;
      const stricter = ref !== null && ORDER.indexOf(group) < ORDER.indexOf(ref.startGroup);
      const initialReference = ref
        ? Math.min(ref.volume, stricter ? groupStart : 2 * groupStart)
        : 0;
      const ownAllowed = req.ownStart && group !== 'cautious' && level !== 'beginner' && !ref;
      const start = ownAllowed
        ? Math.min(req.ownStart?.weeklyMinutes ?? 0, 2 * groupStart)
        : groupStart;
      for (const e of chainViolations(sessions, start, initialReference)) errors.push(`${i}: ${e}`);
      // Start-Deckel je Einheit in Woche 0 und der ersten Belastungswoche (Einsteiger 30, vorsichtig 20), wenn die
      // Kette neu beginnt (ohne Bezug oder strengere Gruppe); nie über 240 min.
      const startCap = ({ beginner: 30, cautious: 20 } as Partial<Record<string, number>>)[group];
      const firstLoad = Math.min(
        ...sessions
          .filter((s) => s.block_no === 1 && s.week_no >= 1 && !s.is_deload)
          .map((s) => s.week_no),
      );
      if (startCap !== undefined && (ref === null || stricter)) {
        for (const s of sessions) {
          if (s.kind !== 'endurance' || s.block_no !== 1 || s.week_no > firstLoad) continue;
          if (s.estimated_minutes > startCap) {
            errors.push(
              `${i}: ${s.scheduled_on} ${s.estimated_minutes} min > Start-Deckel ${startCap}`,
            );
          }
        }
      }
      if (sessions.some((s) => s.estimated_minutes > 240))
        errors.push(`${i}: Einheit über 240 min`);
      // Plan = Vorschau der Ampel (dieselbe Kette), Woche für Woche – ohne Gruppenwechsel.
      const preview = competitionVolumePreview(inputs, req, today) ?? [];
      if (variant !== 'group_change') {
        const byWeek = enduranceByWeek(sessions);
        for (const w of preview) {
          if ((byWeek.get(w.monday) ?? 0) !== w.minutes) {
            errors.push(
              `${i}: ${w.monday} Plan ${byWeek.get(w.monday) ?? 0} ≠ Vorschau ${w.minutes}`,
            );
          }
        }
      }
      // Vortag, Renntag und Rest der Rennwoche frei.
      const raceEnd = addDays(startOfIsoWeek(raceDate), 6);
      if (
        sessions.some((s) => s.scheduled_on >= addDays(raceDate, -1) && s.scheduled_on <= raceEnd)
      ) {
        errors.push(`${i}: Einheit an einem freien Tag`);
      }
      // Jeder Block im Datenbank-Rahmen (Woche 0–6, Grenzen der Einheiten).
      for (const blockNo of new Set(sessions.map((s) => s.block_no))) {
        const block = sessions.filter((s) => s.block_no === blockNo);
        // WP2: harte Einheiten heben die Anstrengung über 4 → Rahmen des Wettkampfplans (CHECK 1–9 ab WP3).
        const check = generatedCompetitionPlanSchema.safeParse({
          ...generated.plan,
          sessions: block,
        });
        if (!check.success) errors.push(`${i}: Block ${blockNo} außerhalb der Grenzen`);
      }
      // Rhythmus phasengenau aus den Wochen-Vorgaben (auch leere Erholungswochen, N1), keine Lücke zwischen Blöcken.
      for (const e of [...rhythmViolations(weeks), ...gaps]) errors.push(`${i} (${variant}): ${e}`);
      if (variant !== 'group_change') {
        const taperStart = preview.find((w) => w.phase === 'taper')?.monday;
        const before = preview.filter((w) => taperStart && w.monday < taperStart).at(-1);
        if (before && !before.load) errors.push(`${i}: Erholungswoche direkt vor dem Tapering`);
      }
      if (isoWeekday(today) !== 1 && !sessions.every((s) => s.scheduled_on >= today)) {
        errors.push(`${i}: Einheit vor dem Planstart`);
      }
    }
    expect(plans).toBeGreaterThan(100);
    expect(refused).toBeGreaterThan(40);
    for (const v of ['plain', 'own_start', 'reference', 'flex', 'group_change']) {
      expect(variants.get(v) ?? 0, v).toBeGreaterThan(10);
    }
    expect(errors.slice(0, 10)).toEqual([]);
  }, 240_000); // unter Last (turbo parallel) deutlich langsamer als allein (~12 s)
});
