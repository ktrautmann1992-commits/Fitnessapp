import { HYROX_FORMAT, HYROX_SAFETY } from '../constants';
import { type CautionTag, HYROX_STATIONS, type HyroxDivision, type HyroxStation } from '../enums';
import { HYROX_TEXTS_DE } from './texts';

/**
 * Hyrox-Rennformat (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, HYROX_FORMAT): Gewichte je Division und Geschlecht, Mengen und
 * Anteile der Rennmenge (Kombi-Einheit), Stationen ohne Sprünge. Reine Funktionen, keine KI.
 */

/** Geschlecht für die Gewichte (Rulebook kennt Frauen/Männer; „divers“ → Open-Gewicht der Frauen, vorsichtig). */
export type HyroxWeightSex = 'female' | 'male';

/**
 * Gewicht einer Station in kg je Division und Geschlecht (null = Station ohne Gewicht). Doubles und Staffel → Open
 * (Entscheidung 2: nur Angabe, gleicher Plan). Werte „unbestätigt“ (HYROX_FORMAT).
 */
export function hyroxStationWeightKg(
  station: HyroxStation,
  division: HyroxDivision,
  sex: HyroxWeightSex,
): number | null {
  const weights: Partial<
    Record<HyroxStation, Record<'open' | 'pro', Record<HyroxWeightSex, number>>>
  > = HYROX_FORMAT.weightsKg;
  const row = weights[station];
  if (!row) return null;
  return row[division === 'pro' ? 'pro' : 'open'][sex];
}

/** Gewichts-Geschlecht aus dem Profil: „männlich“ → male, sonst female (leichter, vorsichtig). */
export function hyroxWeightSex(sex: string | null | undefined): HyroxWeightSex {
  return sex === 'male' ? 'male' : 'female';
}

/** Darf die Person diese Division wählen? Unter 18 nur Open (HYROX_SAFETY, = save_competition). */
export function hyroxDivisionAllowed(division: HyroxDivision, minor: boolean): boolean {
  return !minor || (HYROX_SAFETY.minorDivisions as readonly HyroxDivision[]).includes(division);
}

/** Wählbare Divisionen (Reihenfolge wie HYROX_DIVISIONS). */
export function allowedHyroxDivisions(minor: boolean): HyroxDivision[] {
  return (['open', 'pro', 'doubles', 'relay'] as const).filter((d) =>
    hyroxDivisionAllowed(d, minor),
  );
}

/**
 * Stationen, die mit den ausgeschlossenen Merkmalen entfallen: Burpee-Weitsprünge sind Sprünge (`high_impact`) – ab 65
 * und bei vorsichtigen Plänen (HYROX_SAFETY.seniorExcludedStations).
 */
export function hyroxExcludedStations(excludedCautionTags: readonly CautionTag[]): HyroxStation[] {
  const tags: readonly CautionTag[] = HYROX_SAFETY.seniorExcludedCautionTags;
  return excludedCautionTags.some((t) => tags.includes(t))
    ? [...HYROX_SAFETY.seniorExcludedStations]
    : [];
}

/** Erlaubte Stationen in Rennreihenfolge. */
export function allowedHyroxStations(excludedCautionTags: readonly CautionTag[]): HyroxStation[] {
  const excluded = hyroxExcludedStations(excludedCautionTags);
  return HYROX_STATIONS.filter((s) => !excluded.includes(s));
}

/**
 * Menge einer Station für einen Anteil der Rennmenge (0–1), gerundet: Meter ab 200 auf 50 m, sonst auf 5 m;
 * Wiederholungen auf 5 – immer mindestens 5.
 */
export function hyroxStationAmount(station: HyroxStation, fraction: number): number {
  const s = HYROX_FORMAT.stations[station];
  const raw = s.amount * Math.max(0, fraction);
  const step = s.unit === 'm' && raw >= 200 ? 50 : 5;
  return Math.max(5, Math.round(raw / step) * step);
}

/** Text „25 Wall Balls“ bzw. „250 m SkiErg“. */
export function hyroxStationAmountText(station: HyroxStation, fraction: number): string {
  const amount = hyroxStationAmount(station, fraction);
  const name = HYROX_TEXTS_DE.stations[station];
  return HYROX_FORMAT.stations[station].unit === 'reps'
    ? `${amount} ${name}`
    : `${amount} m ${name}`;
}

/** Anteil der Rennmenge, der zu `seconds` Stations-Zeit passt (Umkehrung der Kombi-Schritte, für den Timer). */
export function hyroxFractionForSeconds(station: HyroxStation, seconds: number): number {
  return seconds / HYROX_FORMAT.stations[station].estimatedFullS;
}

/** Sekunden einer Station für einen Anteil der Rennmenge (auf 10 s gerundet, mindestens `minS`). */
export function hyroxStationSeconds(station: HyroxStation, fraction: number, minS: number): number {
  const full = HYROX_FORMAT.stations[station].estimatedFullS;
  return Math.max(minS, Math.round((full * fraction) / 10) * 10);
}

/** Ansage im Timer (zum Sprechen): „Station: 25 Wall Balls“ bzw. „Station: 250 Meter SkiErg“ (Menge aus der Dauer). */
export function hyroxStationCue(station: HyroxStation, seconds: number): string {
  const amount = hyroxStationAmount(station, hyroxFractionForSeconds(station, seconds));
  const name = HYROX_TEXTS_DE.stations[station];
  return HYROX_FORMAT.stations[station].unit === 'reps'
    ? `Station: ${amount} ${name}`
    : `Station: ${amount} Meter ${name}`;
}
