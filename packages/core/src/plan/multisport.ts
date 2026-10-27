import { COMPETITION_TRIATHLON, ENDURANCE_MODALITY_ROW } from '../constants';
import type { EnduranceModality } from '../enums';
import type { CompetitionPhase } from './competition-schema';
import type { EnduranceVariant } from './endurance';
import type { WorkoutStep, WorkoutType } from './intensity';

/**
 * Rad und Triathlon im Wettkampfplan (docs/PLAN-PHASE-10.md Abschnitt 9, Etappe WP5; W-G2): Sportart je Tag beim
 * Triathlon (Disziplinen im Wechsel), Koppeltraining Rad → Lauf als EINE Einheit mit zwei Teilen, Minuten je
 * Disziplin (die Koppeleinheit zählt in beide) und der Sicherheitshinweis zum Freiwasser. Reine Funktionen, feste
 * deutsche Textbausteine (W-G8), keine KI. Alle Zahlen in constants.ts (COMPETITION_TRIATHLON,
 * COMPETITION_BIKE_WORKOUTS) – VOR LIVEGANG FACHLICH PRÜFEN.
 */

/** Sportart einer Ausdauer-Einheit im Wettkampfplan. */
export type Sport = 'swim' | 'bike' | 'run';
/** Sportart eines Tages beim Triathlon: eine Disziplin oder Koppeltraining (Rad → Lauf). */
export type DaySport = Sport | 'brick';

/**
 * Sportart einer Einheit im Wochenbau (weekWorkouts): die drei Triathlon-Sportarten und – Sportarten Stufe 1 · Etappe R
 * – Rudern (eigene Texte und Arten, nie Teil des Triathlons).
 */
export type WorkoutSport = Sport | 'row';

/** Sportart einer Variante (Gehen zählt als Laufen – „Lauf-Disziplin“, auch im Geh-Lauf-Wechsel). */
export function sportOfVariant(variant: EnduranceVariant): WorkoutSport {
  if (variant === 'easy_bike' || variant === 'ergometer') return 'bike';
  if (variant === 'easy_swim') return 'swim';
  if (variant === 'easy_row') return 'row';
  return 'run';
}

/**
 * Sportart einer gespeicherten Modalität (walk → Laufen) für die Triathlon-Minuten. Rudern (`row`) gehört zu keiner
 * Triathlon-Disziplin → null (zählt in sportMinutes nicht; Ruder-Tage gibt es nur im Plan ohne Disziplin).
 */
export function sportOfModality(modality: EnduranceModality | null): Sport | null {
  if (modality === 'bike') return 'bike';
  if (modality === 'swim') return 'swim';
  if (modality === 'run' || modality === 'walk') return 'run';
  return null;
}

/**
 * Feste Textbausteine Rad, Schwimmen und Koppeltraining (W-G8) – PRODUKTENTSCHEIDUNG, fachliche Prüfung vor
 * Veröffentlichung. Laufen: WORKOUT_TEXTS_DE (endurance-workouts.ts).
 */
export const MULTISPORT_TEXTS_DE = {
  bike: {
    names: {
      easy: 'Lockere Ausfahrt',
      recovery: 'Erholungsausfahrt',
      long: 'Lange Ausfahrt',
      fartlek: 'Fahrtspiel auf dem Rad',
      tempo: 'Sweet-Spot auf dem Rad',
      race_pace: 'Renntempo auf dem Rad',
    },
    warmupEasy: '5 Minuten locker einrollen.',
    warmupHard: '10 Minuten locker einrollen, dann 2–3 kurze zügige Antritte.',
    cooldownEasy: '5 Minuten locker ausrollen, leicht dehnen.',
    cooldownHard: '5 Minuten locker ausrollen.',
    main: {
      easy: 'Gleichmäßig locker fahren, leichter Gang, runder Tritt.',
      recovery: 'Ganz locker rollen – lieber zu leicht als zu schwer.',
      long: 'Gleichmäßig locker fahren, regelmäßig trinken und etwas essen; die zweite Hälfte nicht schneller.',
      fartlek: (reps: number) =>
        `${reps} × 1 Minute zügig treten, dazwischen je 2 Minuten locker rollen.`,
      tempo: (minutes: number) =>
        `2 × ${minutes / 2} Minuten zügig knapp unter der Schwelle („Sweet-Spot“, nur kurze Sätze möglich), dazwischen 5 Minuten locker rollen.`,
      race_pace: (reps: number, minutes: number) =>
        `${reps} × ${minutes} Minuten im geplanten Renntempo, dazwischen je 2 Minuten locker rollen.`,
    },
    alternative: 'Ausweichen: Ergometer oder Rollentrainer mit derselben Anstrengung.',
  },
  /**
   * Indoor-Rudern (Sportarten Stufe 1 · Etappe R, docs/PLAN-SPORTARTEN-STUFE-1.md 2.3): locker mit Schlagzahl 18–22,
   * Erholung, lang, Fahrtspiel, Tempo, Intervalle (4–8 × 500 m, 30/30, 3–5 × 1000 m), Technik. Zahlen aus
   * ENDURANCE_MODALITY_ROW und ROW_WORKOUTS.
   */
  row: {
    names: {
      easy: 'Lockeres Rudern',
      recovery: 'Erholungsrudern',
      long: 'Langes Rudern',
      fartlek: 'Fahrtspiel auf dem Rudergerät',
      tempo: 'Tempo-Rudern',
      intervals: 'Ruder-Intervalle',
      technique: 'Rudertechnik',
    },
    warmupEasy: `5 Minuten locker rudern, Schlagzahl ${ENDURANCE_MODALITY_ROW.easyStrokeRate.min}–${ENDURANCE_MODALITY_ROW.easyStrokeRate.max}.`,
    warmupHard:
      '10 Minuten locker rudern, dann 3 × 10 Schläge zügig mit je 1 Minute locker dazwischen.',
    cooldownEasy: '5 Minuten ganz locker ausrudern, dann Beine, Hüfte und Rücken leicht dehnen.',
    cooldownHard: '5 Minuten ganz locker ausrudern.',
    main: {
      easy: `Gleichmäßig locker rudern, Schlagzahl ${ENDURANCE_MODALITY_ROW.easyStrokeRate.min}–${ENDURANCE_MODALITY_ROW.easyStrokeRate.max}: kraftvoll mit den Beinen abdrücken, ruhig nach vorne zurückrollen.`,
      recovery: 'Ganz locker rudern, niedrige Schlagzahl – lieber zu leicht als zu schwer.',
      long: `Gleichmäßig locker rudern, Schlagzahl ${ENDURANCE_MODALITY_ROW.easyStrokeRate.min}–${ENDURANCE_MODALITY_ROW.easyStrokeRate.max}, zwischendurch trinken; die zweite Hälfte nicht schneller.`,
      fartlek: (reps: number) => `${reps} × 1 Minute zügig rudern, dazwischen je 2 Minuten locker.`,
      tempo: (minutes: number) =>
        `2 × ${minutes / 2} Minuten zügig rudern (nur kurze Sätze möglich), dazwischen 3 Minuten locker.`,
      intervals500: (reps: number) =>
        `${reps} × 500 m schnell (etwa 2 Minuten), dazwischen je 1:30 Minuten locker rudern. Nie „alles geben“.`,
      intervals1000: (reps: number) =>
        `${reps} × 1000 m zügig (etwa 4 Minuten), dazwischen je 3 Minuten locker rudern. Gleichmäßiger Split.`,
      intervals30: (reps: number) =>
        `${reps} × 30 Sekunden zügig, 30 Sekunden locker – im Wechsel, ohne Pause dazwischen.`,
      technique:
        'Technikübungen im Wechsel mit lockerem Rudern: nur Arme, dann Arme und Rumpf, dann ganzer Schlag; Pause am Ende des Durchzugs. Ruhig zurückrollen.',
    },
    technique: `Ablauf: Beine – Rumpf – Arme, zurück Arme – Rumpf – Beine. Dämpfer ${ENDURANCE_MODALITY_ROW.damper.min}–${ENDURANCE_MODALITY_ROW.damper.max} (höher ist nicht „mehr Training“). Rücken lang, Schultern locker, Griff locker.`,
    alternative: 'Ausweichen: Rad-Ergometer oder zügiges Gehen mit derselben Anstrengung.',
  },
  swim: {
    names: {
      easy: 'Lockeres Schwimmen',
      recovery: 'Lockeres Schwimmen',
      technique: 'Schwimmtechnik',
    },
    warmup: '5 Minuten locker einschwimmen.',
    cooldown: '5 Minuten locker ausschwimmen.',
    main: {
      easy: 'Im Becken gleichmäßig locker schwimmen, kurze Pausen am Beckenrand sind erlaubt.',
      technique:
        'Im Becken: Technikübungen (z. B. Abschlagschwimmen, Seitlage, Beine mit Brett) im Wechsel mit lockerem Kraulen; ruhig ausatmen, lang gleiten.',
    },
  },
  brick: {
    name: 'Koppeltraining Rad → Lauf',
    warmup: '5 Minuten locker einrollen.',
    cooldown: '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
    main: (bikeMinutes: number, runMinutes: number) =>
      `Teil 1: ${bikeMinutes} Minuten locker Rad fahren. Teil 2: direkt danach Laufschuhe an und ${runMinutes} Minuten locker laufen – die ersten Minuten fühlen sich schwer an, das ist normal.`,
  },
  /**
   * Sicherheitshinweis Freiwasser (Plan 9): erscheint bei JEDER Schwimm-Einheit des Wettkampfplans und in der Ampel
   * beim Triathlon (Hinweis `open_water_safety`). Orientierung: Baderegeln der DLRG (nie allein, nur an bewachten bzw.
   * erlaubten Stellen) – vor Livegang prüfen.
   */
  openWater:
    'Freiwasser nur mit Sicherheit: nie allein schwimmen, immer mit Begleitung (am Ufer oder im Boot), Neoprenanzug, auffällige Badekappe und Schwimmboje, nur an erlaubten und bewachten Stellen. Im Zweifel im Becken trainieren.',
} as const;

/** Sicherheitshinweise einer Ausdauer-Einheit (App: Einheiten-Karte, Trainingsmodus). Schwimmen → Freiwasser. */
export type SessionSafetyNotice = 'open_water';

/**
 * Hinweise, die zu einer Einheit IMMER angezeigt werden: Schwimmen (jede Schwimm-Einheit, mit und ohne Wettkampf) →
 * Freiwasser-Hinweis (`MULTISPORT_TEXTS_DE.openWater`).
 */
export function sessionSafetyNotices(session: {
  readonly kind: string;
  readonly endurance_modality: EnduranceModality | null;
}): SessionSafetyNotice[] {
  return session.kind === 'endurance' && session.endurance_modality === 'swim'
    ? ['open_water']
    : [];
}

/**
 * Aufteilung des Koppeltrainings (COMPETITION_TRIATHLON.brick): Lauf-Teil = floor(`runShare` × Dauer), begrenzt auf
 * `runMinMinutes`–`runMaxMinutes`; Rad-Teil = Rest. Summe = Dauer.
 */
export function brickSplit(minutes: number): { readonly bike: number; readonly run: number } {
  const B = COMPETITION_TRIATHLON.brick;
  const run = Math.min(
    B.runMaxMinutes,
    Math.max(B.runMinMinutes, Math.floor(minutes * B.runShare)),
  );
  return { bike: minutes - run, run };
}

/**
 * Minuten je Disziplin (Plan 9: „Koppeleinheit zählt in beide Disziplinen-Minuten“): Rad, Schwimmen, Laufen (Gehen zählt
 * als Laufen); das Koppeltraining zählt mit dem Rad-Teil zu Rad und mit dem Lauf-Teil zu Laufen (brickSplit). Nur
 * Ausdauer, ohne gestrichene. Die Summe aller drei ist genau die Summe der Ausdauer-Minuten – darauf wirkt die
 * 10-%-Regel.
 */
export function sportMinutes(
  sessions: readonly {
    readonly kind: string;
    readonly endurance_modality: EnduranceModality | null;
    readonly estimated_minutes: number;
    readonly workout_type?: WorkoutType | null;
    readonly status?: string;
  }[],
): Record<Sport, number> {
  const out: Record<Sport, number> = { swim: 0, bike: 0, run: 0 };
  for (const s of sessions) {
    if (s.kind !== 'endurance' || s.status === 'skipped') continue;
    if (s.workout_type === 'brick') {
      const split = brickSplit(s.estimated_minutes);
      out.bike += split.bike;
      out.run += split.run;
      continue;
    }
    const sport = sportOfModality(s.endurance_modality);
    if (sport) out[sport] += s.estimated_minutes;
  }
  return out;
}

/**
 * Sportart je Schritt einer Koppeleinheit (Timer, Anzeige): Schritte bis zum Ende des Rad-Teils (brickSplit) = Rad,
 * danach Laufen. Andere Arten: null (eine Sportart, die der Einheit).
 */
export function brickStepSports(
  steps: readonly WorkoutStep[],
  minutes: number,
): readonly Sport[] | null {
  const bikeS = brickSplit(minutes).bike * 60;
  let at = 0;
  return steps.map((st) => {
    const sport: Sport = at < bikeS ? 'bike' : 'run';
    at += st.seconds;
    return sport;
  });
}

/** Ein Tag der Woche für die Verteilung der Sportarten (nur geplante Ausdauer-Tage, in Datumsreihenfolge). */
export interface SportDay {
  readonly date: string;
  readonly minutes: number;
}

/**
 * Sportart je Tag beim Triathlon (COMPETITION_TRIATHLON): der Tag der langen Einheit ist Rad (lange Ausfahrt), die
 * übrigen Tage der Reihe nach nach `dayPattern` (Schwimmen, Laufen, Rad, …). In Aufbau und Spitze (nicht in einer
 * Erholungswoche, nicht in Woche 0, nicht bei „nur Gehen“) wird der längste Rad-Tag ohne lange Ausfahrt mit mindestens
 * `brick.minMinutes` zum Koppeltraining (also erst ab 4 Tagen; der einzige Lauf-Tag bleibt ein Lauf).
 * Ergebnis in der Reihenfolge von `days`.
 */
export function triathlonWeekSports(
  days: readonly SportDay[],
  longDate: string | null,
  options: {
    readonly phase: CompetitionPhase;
    readonly recoveryWeek: boolean;
    readonly weekZero: boolean;
    /** „Nur Gehen“ (Flag, ab 65) bzw. keine harten Einheiten: kein Koppeltraining. */
    readonly brickAllowed: boolean;
  },
): DaySport[] {
  const T = COMPETITION_TRIATHLON;
  const order = days.map((d, i) => ({ d, i })).sort((a, b) => (a.d.date < b.d.date ? -1 : 1));
  const out: DaySport[] = days.map(() => 'run');
  let k = 0;
  for (const { d, i } of order) {
    if (d.date === longDate) {
      out[i] = 'bike';
      continue;
    }
    out[i] = T.dayPattern[k % T.dayPattern.length] as Sport;
    k += 1;
  }
  const brickPhase = (T.brick.phases as readonly CompetitionPhase[]).includes(options.phase);
  if (
    options.brickAllowed &&
    brickPhase &&
    !options.recoveryWeek &&
    !options.weekZero &&
    days.length >= T.minEnduranceDays
  ) {
    // Nur ein Rad-Tag ohne lange Ausfahrt (Koppeltraining ist überwiegend Rad) – nie der einzige Lauf-Tag.
    const candidate = order
      .filter(
        ({ d, i }) => out[i] === 'bike' && d.date !== longDate && d.minutes >= T.brick.minMinutes,
      )
      .sort((a, b) => b.d.minutes - a.d.minutes || (a.d.date < b.d.date ? -1 : 1))[0];
    if (candidate) out[candidate.i] = 'brick';
  }
  return out;
}

/**
 * Passt die Modalität zur Art (= CHECK planned_sessions_multisport, WP5)? Koppeltraining nur als Rad-Einheit (der
 * Lauf-Teil steckt in den Schritten), Schwimmtechnik nur beim Schwimmen; alle anderen Arten frei.
 */
export function workoutModalityFits(
  type: WorkoutType | null | undefined,
  modality: EnduranceModality | null,
): boolean {
  if (type === 'brick') return modality === 'bike';
  if (type === 'technique') return modality === 'swim';
  return true;
}
