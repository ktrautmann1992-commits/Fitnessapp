/**
 * Eigenschaftstest Übungs-Tausch (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.4, Etappe T1): zufällige Profile, Tage,
 * Geräte, Präferenzen (0/1/10/100, Ketten, Kreise), Day-Swaps und Regeländerungen NACH der Plan-Erstellung (strenger
 * und lockerer). Die Erwartungen sind unabhängig formuliert (Merkmale, Geräte, Schwierigkeit, Muster direkt aus den
 * Übungen) – nicht aus Zwischenwerten der Tausch-Funktionen. Dazu der Echte-Inhalte-Snapshot „wo gibt es kein
 * ‚Ab jetzt immer‘“.
 */
import { describe, expect, it } from 'vitest';

import type { Exercise } from '../content/schemas';
import type { EquipmentLocation } from '../enums';
import type { DaySwap } from './day-swaps';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { type PlanInputsInput, planInputsSchema } from './inputs';
import { type ExercisePreference, swapCandidates, upsertPreference } from './preferences';
import { type PlanSafetyRules, planSafetyRules } from './safety';
import { displaySwapRules, planFloorRules, type PlanStartGroupSource } from './start-group';
import { addDays } from '../dates';
import { daySwap, EXERCISES, LIB, PLAN_ID, planned, pref, USER_ID } from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';
import {
  displayPairs,
  prepareSessionForDisplay,
  sessionLocationInfo,
  type StoredSession,
} from './view';

/** Deterministischer Zufall (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Screening = PlanInputsInput['healthScreening'];
const SCREENINGS: Screening[] = [
  null,
  { flags: [] },
  { flags: ['pregnancy', 'conservative_plan'] },
  { flags: ['injury', 'conservative_plan'] },
  { flags: ['medication', 'conservative_plan'] },
];
const BIRTH_DATES = ['2009-06-01', '1996-01-15', '1961-10-06', '1958-03-01'];
const LEVELS = ['beginner', 'advanced', 'competitive'] as const;
type HomeItem = {
  equipmentId: 'resistance_bands' | 'pull_up_bar' | 'dumbbells' | 'flat_bench';
  weightsKg: number[];
};
const EQUIPMENT: HomeItem[][] = [
  [],
  [{ equipmentId: 'resistance_bands', weightsKg: [] }],
  [{ equipmentId: 'pull_up_bar', weightsKg: [] }],
  [{ equipmentId: 'dumbbells', weightsKg: [4, 8, 12] }],
  [...FULL_HOME],
];
const DAYS: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  7: [1, 2, 3, 4, 5, 6, 7],
};
const ALL_IDS = [...EXERCISES.keys()].sort();

const pick = <T>(rnd: () => number, list: readonly T[]): T =>
  list[Math.floor(rnd() * list.length)] as T;

function randomPreferences(rnd: () => number, inPlan: readonly string[]): ExercisePreference[] {
  const count = pick(rnd, [0, 1, 3, 10, 100]);
  // Eine Präferenz je Übung und Ort (Primärschlüssel, später in der Datenbank) – upsertPreference.
  let prefs: ExercisePreference[] = [];
  const pool = [...inPlan, ...ALL_IDS];
  for (let i = 0; i < count; i++) {
    const id = pick(rnd, pool);
    const location: EquipmentLocation = rnd() < 0.5 ? 'home' : 'gym';
    const replacement = rnd() < 0.5 ? pick(rnd, pool) : null;
    prefs = upsertPreference(
      prefs,
      pref(
        id,
        location,
        rnd() < 0.5 ? 'dislike' : 'not_feasible',
        replacement === id ? null : replacement,
      ),
    );
  }
  // Kreis A→B, B→A
  if (rnd() < 0.3 && inPlan.length >= 2) {
    const [a, b] = [inPlan[0] as string, inPlan[1] as string];
    if (a !== b) {
      for (const p of [
        pref(a, 'home', 'dislike', b),
        pref(b, 'home', 'dislike', a),
        pref(a, 'gym', 'dislike', b),
        pref(b, 'gym', 'dislike', a),
      ]) {
        prefs = upsertPreference(prefs, p);
      }
    }
  }
  return prefs;
}

const allowedBy = (e: Exercise, rules: Pick<PlanSafetyRules, 'excludedCautionTags'>) =>
  !e.caution_tags.some((t) => rules.excludedCautionTags.includes(t));
const sharesPrimary = (a: Exercise, b: Exercise) =>
  a.primary_muscles.some((m) => b.primary_muscles.includes(m));

describe('Eigenschaftstest Übungs-Tausch (7.4)', () => {
  it('Sicherheit, Machbarkeit, Schwierigkeit, Muster, Zuordnung und Leer-Zustände über 160 Zufallsfälle', () => {
    const rnd = random(20261010);
    let checkedExercises = 0;
    let appliedDaySwaps = 0;
    let swappedExercises = 0;
    for (let run = 0; run < 160; run++) {
      const days = pick(rnd, [1, 2, 3, 4, 7]);
      const homeEquipment = pick(rnd, EQUIPMENT);
      const birthDate = pick(rnd, BIRTH_DATES);
      const screening = pick(rnd, SCREENINGS);
      const level = pick(rnd, LEVELS);
      const where = pick(rnd, ['home', 'gym', 'both'] as const);
      const inputs = person({
        experienceLevel: level,
        birthDate,
        healthScreening: screening,
        homeEquipment,
        trainingLocation: where === 'both' ? 'gym' : where,
        sessionsPerWeek: days,
        preferredDays: rnd() < 0.5 ? DAYS[days] : (DAYS[days] ?? []).slice(1),
        ...(where === 'both'
          ? {
              schedule: {
                mode: 'flex' as const,
                slots: Array.from({ length: Math.min(days, 4) }, (_, i) => ({
                  kind: i % 2 === 0 ? ('strength_gym' as const) : ('strength_home' as const),
                  minutes: 45,
                })),
              },
            }
          : {}),
      });
      const generated = generateTrainingPlan(inputs, LIB, MONDAY);
      if (!generated.ok) continue;
      const schedule = planInputsSchema.parse(inputs).schedule;
      const plan: PlanStartGroupSource = {
        uses_health_data: screening !== null,
        medical_notice: (screening?.flags.length ?? 0) > 0,
        created_at: `${MONDAY}T08:00:00Z`,
        inputs: { experienceLevel: level },
      };
      // Regeländerung nach der Erstellung: strenger oder lockerer (neuer Check, anderes Flag).
      const currentInputs =
        rnd() < 0.5 ? inputs : { ...inputs, healthScreening: pick(rnd, SCREENINGS) };
      // K6: gelegentlich zwei Jahre später (Altersübergang 17 → 19 bzw. 64 → 66).
      const rulesDate = rnd() < 0.3 ? addDays(MONDAY, 730) : MONDAY;
      const rules = planSafetyRules(currentInputs, rulesDate);
      const swapRules = displaySwapRules(plan, birthDate, rules);
      const floor = planFloorRules(plan, birthDate);
      const stored: StoredSession[] = generated.plan.sessions.map((s, i) => ({
        ...s,
        id: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
        status: 'planned',
        original_date: null,
      }));
      const inPlan = [...new Set(stored.flatMap((s) => s.exercises.map((e) => e.exercise_id)))];
      // K6/S-8: gelegentlich eine Übung „archiviert“ – nur noch zum Nachschlagen, nie Ersatz bzw. Kandidat.
      const archived = rnd() < 0.3 ? pick(rnd, ALL_IDS) : null;
      const engine = new Map([...EXERCISES].filter(([id]) => id !== archived));
      const prefs = randomPreferences(rnd, inPlan);
      const homeProfile = equipmentProfile('home', homeEquipment);
      const gymProfile = equipmentProfile('gym', homeEquipment);

      for (const session of stored) {
        if (session.kind !== 'strength') continue;
        const info = sessionLocationInfo(session, schedule, { library: EXERCISES, homeProfile });
        const profile = info.location === 'home' ? homeProfile : gymProfile;
        const swaps: DaySwap[] =
          rnd() < 0.5 && session.exercises.length > 0
            ? [
                daySwap(
                  1 + Math.floor(rnd() * session.exercises.length),
                  pick(rnd, session.exercises).exercise_id,
                  pick(rnd, ALL_IDS),
                  { sessionId: session.id },
                ),
              ].filter((s) => s.alternativeId !== s.storedExerciseId)
            : [];
        const ctx = {
          rules,
          previousStartGroup: 'beginner' as const,
          library: EXERCISES,
          substituteLibrary: engine,
          profile,
        };
        const safe = prepareSessionForDisplay(session, ctx);
        const safePairs = displayPairs(session, safe);
        // K6: in der Hälfte der Fälle ein gültiger Day-Swap (Kandidat für (S, X) ohne Präferenzen).
        if (rnd() < 0.5 && safePairs.length > 0) {
          const target = pick(rnd, safePairs);
          const candidates = swapCandidates(target, {
            library: engine,
            lookup: EXERCISES,
            profile,
            swapRules,
            preferences: [],
            location: info.location,
            inSession: new Set(safePairs.map((p) => p.shown.exercise_id)),
            mode: 'today',
          }).candidates;
          if (candidates.length > 0) {
            swaps.push(
              daySwap(target.storedOrderNo, target.stored.exercise_id, pick(rnd, candidates).id, {
                sessionId: session.id,
              }),
            );
          }
        }
        const shown = prepareSessionForDisplay(session, {
          ...ctx,
          swap: {
            swapRules,
            preferences: prefs,
            location: info.location,
            ambiguousLocation: info.ambiguous,
            daySwaps: { swaps, today: MONDAY, planId: PLAN_ID, ownerUserId: USER_ID },
          },
        });
        appliedDaySwaps += shown.daySwapped?.length ?? 0;
        const label = `Lauf ${run}, ${session.name_de}`;
        const locations = info.ambiguous ? ['home', 'gym'] : [info.location];
        const prefsHere = prefs.filter((p) => locations.includes(p.location));
        const orderNos = shown.storedOrderNos ?? [];

        // Zuordnung: streng steigend, jede gespeicherte Übung genau einmal angezeigt oder ausgeblendet.
        expect(orderNos, label).toHaveLength(shown.session.exercises.length);
        expect(
          [...orderNos].sort((a, b) => a - b),
          label,
        ).toEqual(orderNos);
        expect(new Set(orderNos).size, label).toBe(orderNos.length);
        expect(
          orderNos.length + shown.hidden.length + (shown.hiddenByPreference?.length ?? 0),
          label,
        ).toBe(session.exercises.length);
        // Sicherheits-Ausblendungen unverändert (Präferenzen ändern `hidden` nie).
        expect(shown.hidden, label).toEqual(safe.hidden);
        // Leer nie stumm.
        if (session.exercises.length > 0 && shown.session.exercises.length === 0) {
          expect(
            shown.emptyByPreference || shown.libraryMissing || shown.hidden.length > 0,
            label,
          ).toBe(true);
        }
        // Keine Doppelung durch einen Tausch.
        const ids = shown.session.exercises.map((e) => e.exercise_id);
        const safeIds = safe.session.exercises.map((e) => e.exercise_id);
        if (new Set(safeIds).size === safeIds.length) {
          expect(new Set(ids).size, label).toBe(ids.length);
        }

        shown.session.exercises.forEach((e, i) => {
          checkedExercises += 1;
          const orderNo = orderNos[i] as number;
          const s = EXERCISES.get(
            session.exercises.find((x) => x.order_no === orderNo)!.exercise_id,
          )!;
          const xDraft = safePairs.find((p) => p.storedOrderNo === orderNo)?.shown;
          expect(xDraft, label).toBeDefined();
          const x = EXERCISES.get(xDraft!.exercise_id)!;
          const shownEx = EXERCISES.get(e.exercise_id)!;
          // Eine Präferenz auf eine archivierte angezeigte Übung wird bewusst ignoriert (S-8, Wächter S6/T1-K8).
          const prefApplies = e.exercise_id !== archived;
          // Nie eine Übung mit „Hier nicht machbar“ am Ort.
          expect(
            prefApplies &&
              prefsHere.some((p) => p.exercise_id === e.exercise_id && p.kind === 'not_feasible'),
            `${label}: ${e.exercise_id} not_feasible`,
          ).toBe(false);
          // „Mag ich nicht“ nur, wenn ohne Kandidat behalten.
          if (prefApplies && prefsHere.some((p) => p.exercise_id === e.exercise_id)) {
            expect(
              shown.keptDisliked?.some((k) => k.storedOrderNo === orderNo),
              label,
            ).toBe(true);
          }
          if (shownEx.id === x.id) {
            expect(allowedBy(shownEx, rules), label).toBe(true);
            return;
          }
          swappedExercises += 1;
          expect(shownEx.id, `${label}: archiviert`).not.toBe(archived);
          // Getauscht (Präferenz oder Day-Swap): alle Regeln S-1 bis S-5 unabhängig geprüft.
          expect(allowedBy(shownEx, rules), `${label}: aktuelle Regeln`).toBe(true);
          expect(allowedBy(shownEx, floor), `${label}: Untergrenze des Plans`).toBe(true);
          expect(
            shownEx.equipment_ids.every((id) => profile.available.has(id)),
            `${label}: machbar`,
          ).toBe(true);
          expect(shownEx.difficulty, `${label}: Schwierigkeit`).toBeLessThanOrEqual(
            Math.min(s.difficulty, x.difficulty),
          );
          expect(shownEx.load_type === 'time', `${label}: Halten/Wdh.`).toBe(
            s.load_type === 'time',
          );
          if (x.movement_pattern === s.movement_pattern) {
            // Kette über eine Präferenz-Übung P (Muster von S) bleibt im Muster von S.
            expect(shownEx.movement_pattern, `${label}: Muster`).toBe(s.movement_pattern);
          } else {
            expect([s.movement_pattern, x.movement_pattern], `${label}: Muster`).toContain(
              shownEx.movement_pattern,
            );
            expect(sharesPrimary(shownEx, s), `${label}: Hauptmuskel`).toBe(true);
          }
        });
      }
    }
    expect(checkedExercises).toBeGreaterThan(500);
    expect(swappedExercises).toBeGreaterThan(50);
    expect(appliedDaySwaps).toBeGreaterThan(20);
  }, 60_000); // viele Pläne: unter Last (turbo parallel) länger als der Standard von 5 s
});

describe('Echte Inhalte: wo „Ab jetzt immer“ nicht angeboten wird (Snapshot, 7.4)', () => {
  it('jede Übung jeder Vorlage, je Ort, mit und ohne Arzt-Hinweis-Untergrenze', () => {
    const exerciseIds = [
      ...new Set(
        LIB.templates.flatMap((t) =>
          t.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)),
        ),
      ),
    ].sort();
    const plan = (medical: boolean): PlanStartGroupSource => ({
      uses_health_data: true,
      medical_notice: medical,
      created_at: `${MONDAY}T08:00:00Z`,
      inputs: { experienceLevel: 'beginner' },
    });
    const current = planSafetyRules(person(), MONDAY);
    const settings = [
      ['Zuhause ohne Geräte', equipmentProfile('home', [])],
      ['Zuhause mit Geräten', equipmentProfile('home', FULL_HOME)],
      ['Studio', equipmentProfile('gym', [])],
    ] as const;
    const lines: string[] = [];
    for (const id of exerciseIds) {
      for (const [label, profile] of settings) {
        // Nur dort, wo die Übung selbst angezeigt würde (machbar am Ort).
        if (!EXERCISES.get(id)!.equipment_ids.every((e) => profile.available.has(e))) continue;
        for (const medical of [false, true]) {
          const result = swapCandidates(
            { stored: planned(id), shown: planned(id) },
            {
              library: EXERCISES,
              profile,
              swapRules: displaySwapRules(plan(medical), '1996-01-15', current),
              preferences: [],
              location: profile.location,
              inSession: new Set(),
              mode: 'always',
            },
          );
          if (!result.alwaysAllowed) {
            lines.push(`${id} | ${label} | ${medical ? 'mit Arzt-Hinweis' : 'ohne Flag'}`);
          }
        }
      }
    }
    expect(lines).toMatchSnapshot();
  }, 30_000);
});
