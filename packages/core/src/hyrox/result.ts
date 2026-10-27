import { CARDIO_LOG_LIMITS, FREE_SESSION, HYROX_RESULT_LIMITS } from '../constants';
import { HYROX_SPLIT_SEGMENTS, type HyroxSplitSegment } from '../enums';
import {
  freeSessionLogFromInput,
  freeSessionPayloadIssue,
  type FreeSessionInput,
} from '../log/free-session';
import { type HyroxSplit, type SessionLogPayload, sessionLogPayloadSchema } from '../log/schemas';

/**
 * Ergebnis eines Hyrox-Rennens (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, Etappe H): freie Ausdauer-Einheit „Hyrox-Rennen“
 * (Lauf) mit Gesamtzeit und optional bis zu 17 Teilzeiten (8 Lauf, 8 Stationen, Roxzone, hyrox_splits). Privat, nur der
 * eigene Verlauf – keine Ranglisten, kein Vergleich. Reine Funktionen.
 */

/** Zeit-Text „1:23:45“ bzw. „4:05“ in eine Sekundenzahl (h:mm:ss, mm:ss oder ss). null = ungültig. */
export function parseRaceTime(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p)))
    return null;
  const nums = parts.map((p) => Number(p));
  const [h, m, s] =
    nums.length === 3 ? nums : nums.length === 2 ? [0, nums[0], nums[1]] : [0, 0, nums[0]];
  if ((nums.length >= 2 && (s as number) > 59) || (nums.length === 3 && (m as number) > 59)) {
    return null;
  }
  return (h as number) * 3600 + (m as number) * 60 + (s as number);
}

/** Sekunden als „1:23:45“ (ab 1 h) bzw. „23:45“. */
export function formatRaceTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export type HyroxResultError =
  | 'total_invalid'
  | 'split_invalid'
  | 'splits_exceed_total'
  | 'date_future'
  | 'date_too_old'
  | 'notes_too_long'
  | 'invalid';

/** Teilzeiten aus der Eingabe (Abschnitt → Text, leer = ohne Angabe) in Rennreihenfolge. */
export function hyroxSplitsFromInput(
  input: Partial<Record<HyroxSplitSegment, string>>,
):
  | { readonly ok: true; readonly splits: HyroxSplit[] }
  | { readonly ok: false; readonly invalid: HyroxSplitSegment[] } {
  const splits: HyroxSplit[] = [];
  const invalid: HyroxSplitSegment[] = [];
  const L = HYROX_RESULT_LIMITS.splitS;
  for (const segment of HYROX_SPLIT_SEGMENTS) {
    const text = input[segment]?.trim() ?? '';
    if (text === '') continue;
    const seconds = parseRaceTime(text);
    if (seconds === null || seconds < L.min || seconds > L.max) invalid.push(segment);
    else splits.push({ segment, duration_s: seconds });
  }
  return invalid.length > 0 ? { ok: false, invalid } : { ok: true, splits };
}

export interface HyroxResultInput extends Pick<
  FreeSessionInput,
  'id' | 'writeId' | 'performedOn' | 'today' | 'now' | 'notes'
> {
  /** Gesamtzeit in Sekunden (Pflicht). */
  readonly totalS: number | null;
  readonly splits: readonly HyroxSplit[];
  /** Anstrengung 0–10 (freiwillig). */
  readonly sessionRpe: number | null;
}

/**
 * Eintrag „Hyrox-Rennen“ für save_session_log: freie Lauf-Einheit (Distanz 8 km Lauf-Anteil), Dauer = Gesamtzeit in
 * Sekunden, `hyrox_splits` (auch leer). Summe der Teilzeiten höchstens die Gesamtzeit (wie der Server).
 */
export function hyroxResultLogFromInput(
  input: HyroxResultInput,
):
  | { readonly ok: true; readonly payload: SessionLogPayload }
  | { readonly ok: false; readonly errors: readonly HyroxResultError[] } {
  const total = input.totalS;
  const D = CARDIO_LOG_LIMITS.durationS;
  if (total === null || !Number.isInteger(total) || total < D.min || total > D.max) {
    return { ok: false, errors: ['total_invalid'] };
  }
  const sum = input.splits.reduce((acc, s) => acc + s.duration_s, 0);
  if (sum > total) return { ok: false, errors: ['splits_exceed_total'] };
  const base = freeSessionLogFromInput({
    id: input.id,
    writeId: input.writeId,
    kind: 'endurance',
    performedOn: input.performedOn,
    today: input.today,
    exercises: [],
    cardio: {
      modality: 'run',
      hours: Math.floor(total / 3600),
      minutes: Math.max(1, Math.floor((total % 3600) / 60)),
      distanceKm: 8,
      elevationM: null,
    },
    sessionRpe: input.sessionRpe,
    notes: input.notes,
    now: input.now,
  });
  if (!base.ok) {
    const errors: HyroxResultError[] = [];
    for (const e of base.errors) {
      if (e === 'date_future' || e === 'date_too_old' || e === 'notes_too_long') errors.push(e);
    }
    return { ok: false, errors: errors.length > 0 ? errors : ['invalid'] };
  }
  const cardio = base.payload.cardio;
  if (!cardio) return { ok: false, errors: ['invalid'] };
  const payload: SessionLogPayload = {
    ...base.payload,
    name_de: FREE_SESSION.names.hyroxRace,
    cardio: { ...cardio, duration_s: total },
    hyrox_splits: [...input.splits],
  };
  if (
    !sessionLogPayloadSchema.safeParse(payload).success ||
    freeSessionPayloadIssue(payload, input.today) !== null
  ) {
    return { ok: false, errors: ['invalid'] };
  }
  return { ok: true, payload };
}

/** Summen der Teilzeiten (Anzeige im eigenen Verlauf): Laufen, Stationen, Roxzone, ohne Angabe. */
export function hyroxSplitSummary(
  splits: readonly HyroxSplit[],
  totalS: number,
): {
  readonly runS: number;
  readonly stationS: number;
  readonly roxzoneS: number;
  readonly unassignedS: number;
} {
  let runS = 0;
  let stationS = 0;
  let roxzoneS = 0;
  for (const s of splits) {
    if (s.segment.startsWith('run_')) runS += s.duration_s;
    else if (s.segment === 'roxzone') roxzoneS += s.duration_s;
    else stationS += s.duration_s;
  }
  return {
    runS,
    stationS,
    roxzoneS,
    unassignedS: Math.max(0, totalS - runS - stationS - roxzoneS),
  };
}
