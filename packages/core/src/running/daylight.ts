import { DAYLIGHT } from '../constants';
import { isoDateInTimeZone } from '../dates';

/**
 * Sonnenauf- und -untergang und Hinweis „Es wird dunkel“ für Einheiten draußen (Lauf-Paket 2,
 * docs/PLAN-LAUF-PAKET-2.md 7). Rechenweg der NOAA (GML „General Solar Position Calculations“): Bruchjahr γ,
 * Zeitgleichung und Deklination als Fourier-Näherung, Stundenwinkel für den Zenit 90,833° bzw. 96° (bürgerliche
 * Dämmerung). Ganz auf dem Gerät, ohne Netz, aus grob gerundeter Position (DAYLIGHT.positionRoundingDeg). Rein.
 */

export interface LatLngLike {
  readonly lat: number;
  readonly lng: number;
}

export interface SunTimes {
  /** Zeitpunkte in ms seit 1970 (UTC); null = an diesem Tag nicht (Polartag/-nacht). */
  readonly dawn: number | null;
  readonly sunrise: number | null;
  readonly sunset: number | null;
  readonly dusk: number | null;
  /** Ganzer Tag hell bzw. dunkel (nördlich/südlich der Polarkreise). */
  readonly polar: 'day' | 'night' | null;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Position auf DAYLIGHT.positionRoundingDeg runden (grob; reicht für Minuten-Genauigkeit). */
export function roundPosition(p: LatLngLike): LatLngLike {
  const step = DAYLIGHT.positionRoundingDeg;
  const r = (v: number) => Math.round(Math.round(v / step) * step * 1000) / 1000;
  return { lat: r(p.lat), lng: r(p.lng) };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Sonnenzeiten eines Kalendertags (JJJJ-MM-TT, Zeiten in UTC) an einer Position. */
export function sunTimes(date: string, position: LatLngLike): SunTimes {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const midnight = Date.UTC(y, m - 1, d);
  const doy = Math.round((midnight - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const daysInYear = isLeapYear(y) ? 366 : 365;
  // Bruchjahr zur Mittagszeit (NOAA: γ = 2π/365 · (Tag − 1 + (Stunde − 12)/24)).
  const g = ((2 * Math.PI) / daysInYear) * (doy - 1);
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const lat = rad(position.lat);
  const hourAngle = (zenithDeg: number): number | 'day' | 'night' => {
    const x =
      Math.cos(rad(zenithDeg)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
    if (x > 1) return 'night';
    if (x < -1) return 'day';
    return deg(Math.acos(x));
  };
  const at = (minutes: number) => midnight + Math.round(minutes * 60_000);
  const times = (zenithDeg: number) => {
    const ha = hourAngle(zenithDeg);
    if (typeof ha !== 'number') return { rise: null, set: null, polar: ha };
    return {
      rise: at(720 - 4 * (position.lng + ha) - eqTimeMin),
      set: at(720 - 4 * (position.lng - ha) - eqTimeMin),
      polar: null,
    };
  };
  const sun = times(DAYLIGHT.zenithDeg);
  const civil = times(DAYLIGHT.civilZenithDeg);
  return {
    dawn: civil.rise,
    sunrise: sun.rise,
    sunset: sun.set,
    dusk: civil.set,
    polar: sun.polar,
  };
}

/** Hinweis vor bzw. beim Start einer Einheit draußen. */
export type DarknessHint =
  /** Dunkel (vor der Morgen- bzw. nach der Abenddämmerung, oder Polarnacht). */
  | { readonly kind: 'dark'; readonly sunrise: number | null }
  /** Dämmerung am Morgen: Sonnenaufgang steht bevor. */
  | { readonly kind: 'dawn'; readonly sunrise: number }
  /** Sonne ist untergegangen, Dämmerung bis `dusk`. */
  | { readonly kind: 'dusk'; readonly dusk: number }
  /** Sonnenuntergang in höchstens DAYLIGHT.leadMin Minuten. */
  | { readonly kind: 'sunset_soon'; readonly sunset: number; readonly minutes: number };

/**
 * Hinweis für „jetzt“ an der (gerundeten) Position; Tag = Kalendertag in Europe/Berlin (DACH). Hell und Sonnen-
 * untergang später als `leadMin` → null (kein Hinweis). Ohne Position → null.
 */
export function darknessHint(input: {
  readonly now: number;
  readonly position: LatLngLike | null;
  readonly leadMin?: number;
}): DarknessHint | null {
  const { now, position } = input;
  if (!position || !Number.isFinite(now)) return null;
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return null;
  if (Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180) return null;
  const lead = input.leadMin ?? DAYLIGHT.leadMin;
  const t = sunTimes(isoDateInTimeZone(new Date(now).toISOString()), roundPosition(position));
  if (t.polar === 'night') return { kind: 'dark', sunrise: null };
  if (t.polar === 'day' || t.sunrise === null || t.sunset === null) return null;
  const dawn = t.dawn ?? t.sunrise;
  const dusk = t.dusk ?? t.sunset;
  if (now < dawn || now >= dusk) {
    return { kind: 'dark', sunrise: now < dawn ? t.sunrise : null };
  }
  if (now < t.sunrise) return { kind: 'dawn', sunrise: t.sunrise };
  if (now >= t.sunset) return { kind: 'dusk', dusk };
  const minutes = Math.ceil((t.sunset - now) / 60_000);
  return minutes <= lead ? { kind: 'sunset_soon', sunset: t.sunset, minutes } : null;
}
