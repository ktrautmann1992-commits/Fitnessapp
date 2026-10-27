import { COMPETITION_INTENSITY, ENDURANCE_EFFORT, HYROX_PLAN } from '../constants';
import type { CautionTag, ExperienceLevel, HyroxStation } from '../enums';
import type { EnduranceWorkout } from '../plan/endurance-workouts';
import { type HardWorkoutLimits, hardSeconds, type WorkoutStep } from '../plan/intensity';
import { allowedHyroxStations, hyroxStationAmountText, hyroxStationSeconds } from './format';
import { HYROX_TEXTS_DE } from './texts';

/**
 * Kombi-Einheit Hyrox (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, Etappe H): EINE Lauf-Einheit mit Teilen im Wechsel –
 * Runden aus „ca. 1 km zügig“ und einer Station (Schritt-Typ `station`) – nach dem Muster des Koppeltrainings (brick).
 * Harte Art `hyrox_combo` (80/20, 48-h-Regel); bei Arzt-Hinweis lockere Technik-Kombi (Art `easy`). Alle Zahlen in
 * HYROX_PLAN. Reine Funktionen, feste Textbausteine, keine KI.
 */

const C = HYROX_PLAN.combo;

/**
 * Anteil der Rennmenge je Station in der Kombi: Startanteil je Level, je Belastungswoche höchstens +10 %
 * (HYROX_PLAN.combo.stationVolumeStep), gedeckelt auf `maxFraction`. `loadWeek` = Belastungswochen seit Planbeginn
 * (1 = erste). Zwei Nachbarwochen unterscheiden sich nie um mehr als den Faktor 1,1.
 */
export function hyroxComboFraction(level: ExperienceLevel, loadWeek: number): number {
  const start = C.startFraction[level];
  const steps = Math.max(0, Math.floor(loadWeek) - 1);
  return Math.min(C.maxFraction, start * (1 + C.stationVolumeStep) ** steps);
}

/** Stationen ab Versatz `offset` (Rennreihenfolge, im Kreis), ohne ausgeschlossene. */
export function rotatedStations(
  offset: number,
  excludedCautionTags: readonly CautionTag[],
): HyroxStation[] {
  const all = allowedHyroxStations(excludedCautionTags);
  if (all.length === 0) return [];
  const k = ((Math.floor(offset) % all.length) + all.length) % all.length;
  return [...all.slice(k), ...all.slice(0, k)];
}

export interface HyroxComboOptions {
  /** Gesamtdauer der Einheit in Minuten (aus der 10-%-Kette). */
  readonly minutes: number;
  readonly level: ExperienceLevel;
  readonly limits: HardWorkoutLimits;
  /** Anstrengung lockerer Teile (enduranceEffort). */
  readonly easyEffort: number;
  /** 80/20-Budget in Sekunden (nach `limits.countWorkOnly`). */
  readonly hardBudgetS: number;
  /** Belastungswoche seit Planbeginn (Menge je Station, hyroxComboFraction). */
  readonly loadWeek: number;
  /** Versatz der Stationen (Abwechslung von Woche zu Woche). */
  readonly stationOffset: number;
  /** Ausgeschlossene Merkmale (ab 65/vorsichtig: keine Burpee-Weitsprünge). */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Simulation (alle Stationen, halbe Mengen) statt normaler Kombi. */
  readonly simulation?: boolean;
}

const step = (
  part: WorkoutStep['part'],
  kind: WorkoutStep['kind'],
  seconds: number,
  effort: number,
  station?: HyroxStation,
): WorkoutStep =>
  station ? { part, kind, seconds, effort, station } : { part, kind, seconds, effort };

/** Rundet auf 10 s ab (Schritte in ganzen 10 s, mindestens 10 s). */
const floor10 = (s: number) => Math.floor(s / 10) * 10;

function assemble(
  minutes: number,
  warmS: number,
  coolS: number,
  block: readonly WorkoutStep[],
  easyEffort: number,
): WorkoutStep[] | null {
  const mainS = minutes * 60 - warmS - coolS;
  const used = block.reduce((sum, s) => sum + s.seconds, 0);
  const filler = mainS - used;
  if (filler < 0) return null;
  const warmEffort = Math.min(2, easyEffort);
  return [
    step('warmup', 'easy', warmS, warmEffort),
    ...(filler >= 10 ? [step('main', 'easy', filler, easyEffort)] : []),
    ...block,
    step('cooldown', 'easy', coolS + (filler > 0 && filler < 10 ? filler : 0), warmEffort),
  ];
}

/**
 * Harte Kombi bzw. Simulation mit genau `minutes` Minuten (Schritte-Summe = Dauer). null = passt nicht (zu kurz, Budget,
 * harte Einheiten nicht erlaubt, Anstrengung unter der harten Schwelle) → der Aufrufer plant anders.
 */
export function hyroxComboWorkout(options: HyroxComboOptions): EnduranceWorkout | null {
  const { minutes, limits, easyEffort } = options;
  if (!limits.allowed || minutes < C.minMinutes) return null;
  const S = HYROX_PLAN.simulation;
  const simulation = options.simulation === true;
  // Simulation kontrolliert (Anstrengung 5, zählt nicht ins 80/20-Budget), sonst zügig-hart.
  const effort = simulation
    ? Math.min(S.effort, limits.effortCap)
    : Math.min(C.effort, limits.effortCap);
  if (!simulation && effort < COMPETITION_INTENSITY.hardEffortMin) return null;
  const stations = rotatedStations(
    simulation ? 0 : options.stationOffset,
    options.excludedCautionTags,
  );
  if (stations.length === 0) return null;
  const fraction = simulation
    ? S.stationFraction
    : hyroxComboFraction(options.level, options.loadWeek);
  const mainS = minutes * 60 - C.warmupS - C.cooldownS;
  const maxRounds = simulation ? Math.min(S.rounds, stations.length) : C.maxRounds;
  const budget = Math.max(0, options.hardBudgetS);
  const roundsFor = (runS: number) => {
    let block: WorkoutStep[] = [];
    for (let r = 0; r < maxRounds; r += 1) {
      const station = stations[r % stations.length] as HyroxStation;
      const next = [
        ...block,
        step('main', 'work', runS, effort),
        step(
          'main',
          'station',
          hyroxStationSeconds(station, fraction, C.minStationS),
          effort,
          station,
        ),
      ];
      const used = next.reduce((sum, s) => sum + s.seconds, 0);
      if (used > mainS || hardSeconds(next, limits.countWorkOnly) > budget) break;
      block = next;
    }
    return block;
  };
  // Lauf-Abschnitt ca. 1 km; passen nicht genug Runden, ca. 500 m (Simulation immer halb).
  const fractions = simulation ? [S.runFraction] : C.runSegmentFractions;
  let block: WorkoutStep[] = [];
  let runFraction = fractions[0] ?? 1;
  for (const f of fractions) {
    runFraction = f;
    block = roundsFor(floor10(C.runSegmentS[options.level] * f));
    if (block.length / 2 >= (simulation ? maxRounds : C.minRounds)) break;
  }
  const rounds = block.length / 2;
  // Simulation nur vollständig (alle erlaubten Stationen), sonst normale Kombi.
  if (simulation && rounds < maxRounds) {
    return hyroxComboWorkout({ ...options, simulation: false });
  }
  if (rounds < C.minRounds) return null;
  const steps = assemble(minutes, C.warmupS, C.cooldownS, block, easyEffort);
  if (!steps) return null;
  const T = HYROX_TEXTS_DE.combo;
  const parts = stationParts(block, fraction);
  return {
    type: 'hyrox_combo',
    name_de: simulation ? T.simulationName : T.name,
    warmup_de: T.warmup,
    main_de: simulation
      ? T.simulation(parts)
      : T.main(rounds, runFraction >= 1 ? '1 km' : `${Math.round(runFraction * 1000)} m`, parts),
    cooldown_de: T.cooldown,
    steps,
    effort_target: effort,
  };
}

/** Stations-Texte einer Folge („25 Wall Balls, 250 m SkiErg“). */
function stationParts(block: readonly WorkoutStep[], fraction: number): string {
  return block
    .filter((s) => s.kind === 'station' && s.station)
    .map((s) => hyroxStationAmountText(s.station as HyroxStation, fraction))
    .join(', ');
}

/**
 * Lockere „Technik-Kombi“ (Arzt-Hinweis, HYROX_SAFETY): Art `easy`, alle Teile höchstens ENDURANCE_EFFORT.easyMax,
 * Stationen mit kleinem Anteil (HYROX_PLAN.technique). null = zu kurz → lockerer Lauf.
 */
export function hyroxTechniqueCombo(options: {
  readonly minutes: number;
  readonly level: ExperienceLevel;
  readonly easyEffort: number;
  readonly stationOffset: number;
  readonly excludedCautionTags: readonly CautionTag[];
  /** Plan mit „nur Gehen“ (Flag, ab 65): Text „zügig gehen“ statt „locker laufen“. */
  readonly walk?: boolean;
}): EnduranceWorkout | null {
  const T = HYROX_PLAN.technique;
  if (options.minutes < C.minMinutes) return null;
  const effort = Math.min(options.easyEffort, ENDURANCE_EFFORT.easyMax);
  const stations = rotatedStations(options.stationOffset, options.excludedCautionTags);
  if (stations.length === 0) return null;
  const warmS = C.warmupS;
  const coolS = C.cooldownS;
  const mainS = options.minutes * 60 - warmS - coolS;
  const runS = C.runSegmentS[options.level];
  let block: WorkoutStep[] = [];
  let rounds = 0;
  for (let r = 0; r < T.maxRounds; r += 1) {
    const station = stations[r % stations.length] as HyroxStation;
    const next = [
      ...block,
      step('main', 'easy', runS, effort),
      step(
        'main',
        'station',
        hyroxStationSeconds(station, T.stationFraction, C.minStationS),
        effort,
        station,
      ),
    ];
    if (next.reduce((sum, s) => sum + s.seconds, 0) > mainS) break;
    block = next;
    rounds += 1;
  }
  if (rounds < T.minRounds) return null;
  const steps = assemble(options.minutes, warmS, coolS, block, effort);
  if (!steps) return null;
  const texts = HYROX_TEXTS_DE.combo;
  return {
    type: 'easy',
    name_de: texts.techniqueName,
    warmup_de: texts.techniqueWarmup,
    main_de: texts.technique(rounds, stationParts(block, T.stationFraction), options.walk === true),
    cooldown_de: texts.cooldown,
    steps,
    effort_target: effort,
  };
}

/** Hat die Einheit Stations-Schritte (Kombi oder Technik-Kombi)? */
export function hasStationSteps(steps: readonly WorkoutStep[] | null | undefined): boolean {
  return (steps ?? []).some((s) => s.kind === 'station');
}

/**
 * Minuten einer Kombi je Bereich (Plan 2.1: „Minuten zählen in beide Bereiche“ wie beim Koppeltraining): Lauf = alle
 * Schritte außer Stationen (inkl. Ein-/Auslaufen), Stationen = Summe der Stations-Schritte. Sekunden.
 */
export function hyroxComboSplit(steps: readonly WorkoutStep[]): {
  readonly runS: number;
  readonly stationS: number;
} {
  let runS = 0;
  let stationS = 0;
  for (const s of steps) {
    if (s.kind === 'station') stationS += s.seconds;
    else runS += s.seconds;
  }
  return { runS, stationS };
}

/**
 * Schon-Modus (Plan 2.1): Kombi → nur der Lauf-Teil. Stations-Schritte entfallen, die Lauf-Abschnitte bleiben (zügige
 * Abschnitte höchstens locker, wenn `easy`). Ergebnis-Dauer = Summe der verbleibenden Schritte.
 */
export function hyroxComboRunOnly(
  steps: readonly WorkoutStep[],
  options: { readonly easy?: boolean; readonly easyEffort?: number } = {},
): WorkoutStep[] {
  const easyEffort = options.easyEffort ?? ENDURANCE_EFFORT.easyMax;
  return steps
    .filter((s) => s.kind !== 'station')
    .map((s) =>
      options.easy && s.effort > easyEffort
        ? { ...s, kind: 'easy' as const, effort: easyEffort }
        : s,
    );
}
