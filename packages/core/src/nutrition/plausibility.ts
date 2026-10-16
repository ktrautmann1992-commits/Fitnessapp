import { ageInYears, isoDateSchema } from '../age';
import { KATCH_MCARDLE, MEAL_PLAN_DAY_KCAL_CHECK, MIFFLIN_ST_JEOR } from '../constants';
import type { Sex } from '../enums';
import type { HealthFlag } from '../health-screening';
import { latestBodyValues } from './body-data';
import { bmrForFloor, fatFreeMassFromBodyFat, isBodyFatUsable } from './energy';
import { bmrIntakeFloorKcal } from './limits';
import type { MealPlanPayload } from './meal-plan-payload';
import { measuredOnForEngine } from './person';
import type { BodyMetricsRowInput } from './schemas';

/**
 * Mindest-Plausibilität der Tageskalorien (Etappe N7 Teil 2, Gründer-Entscheidung G-W3, `MEAL_PLAN_DAY_KCAL_CHECK`):
 * dieselbe Rechnung, die `save_meal_plan` auf dem Server in SQL ausführt (`private.meal_plan_day_kcal_floor`,
 * db-sync.test.ts gleicht Konstanten und Formel ab; pgTAP prüft die Grenzfälle mit Werten aus dieser Datei).
 *
 * Grundumsatz für die Schutzgrenzen wie `dayEnergy(...).bmrForFloor` (energy.ts, `bmrForFloor`): max(Mifflin-St Jeor für die Grenzen
 * – divers/keine Angabe mit dem männlichen Offset –, Katch-McArdle nur mit Körperfett ≤ 90 Tage) ×
 * Mindestfaktor (`bmrIntakeFloorKcal` aus limits.ts – die Schutzgrenzen-Konstante liegt nur dort). Körperdaten wie die Engine: je Feld der neueste Wert (`latestBodyValues`), Messdaten
 * nach „heute“ zählen als heute (`measuredOnForEngine`). Kein Grundumsatz (null) wie Modus `no_targets` der Engine:
 * ohne gültige Einwilligung, bei Schwangerschaft (neuester Gesundheits-Check) oder ohne Größe bzw. Gewicht.
 *
 * Bewusst KEINE Zod-Prüfung des Alters wie in `bmrMifflinStJeor` (dort höchstens `NUTRITION_MAX_AGE_YEARS`): Der
 * Server rechnet für jede gespeicherte Person; die Engine selbst plant für ein unplausibles Alter gar nicht erst.
 * Gesundheitsdaten: nie loggen; der Server meldet eine Ablehnung ohne Werte.
 */

export interface ServerDayKcalFloorInput {
  readonly birthDate: string;
  readonly sex: Sex | null;
  /** „Heute“ (Server: Europe/Berlin). */
  readonly today: string;
  /** Tag des Essensplans. */
  readonly date: string;
  readonly healthDataConsent: boolean;
  /** Flags des neuesten Gesundheits-Checks; null = keiner. */
  readonly healthFlags: readonly HealthFlag[] | null;
  readonly bodyMetricsRows: readonly BodyMetricsRowInput[];
}

/** Grundumsatz für die Schutzgrenzen an `date` aus den gespeicherten Angaben; null = keine Prüfung (no_targets). */
export function serverDayKcalFloor(input: ServerDayKcalFloorInput): number | null {
  if (!input.healthDataConsent) return null;
  if (input.healthFlags?.includes('pregnancy') === true) return null;
  const today = isoDateSchema.parse(input.today);
  const date = isoDateSchema.parse(input.date);
  const body = latestBodyValues(
    input.bodyMetricsRows.map((row) => ({
      ...row,
      measuredOn: measuredOnForEngine(row.measuredOn, today),
    })),
  );
  if (body.height === null || body.weight === null) return null;
  const weightKg = body.weight.value;
  const heightCm = body.height.value;
  const ageYears = date < input.birthDate ? 0 : ageInYears(input.birthDate, date);
  const f = MIFFLIN_ST_JEOR;
  const offset =
    input.sex === 'male'
      ? f.sexOffset.male
      : input.sex === 'female'
        ? f.sexOffset.female
        : f.limitsSexOffsetUnknown;
  const mifflin = f.kgFactor * weightKg + f.cmFactor * heightCm - f.ageFactor * ageYears + offset;
  const katch =
    body.bodyFat !== null && isBodyFatUsable(body.bodyFat, date)
      ? KATCH_MCARDLE.intercept +
        KATCH_MCARDLE.ffmFactor * fatFreeMassFromBodyFat(weightKg, body.bodyFat.value)
      : null;
  return bmrIntakeFloorKcal(bmrForFloor(mifflin, katch));
}

/**
 * Tage (ab `today`), die der Server ablehnt: Status in `checkedDayStatuses` und Tagessumme + Rundungs-Spielraum unter
 * dem Grundumsatz. `floorFor` liefert den Grundumsatz je Tag (null = keine Prüfung). Ergebnis sortiert, ohne Werte.
 */
export function mealPlanDaysBelowFloor(
  payload: Pick<MealPlanPayload, 'items'>,
  floorFor: (date: string) => number | null,
  today: string,
): string[] {
  const from = isoDateSchema.parse(today);
  const checked: readonly string[] = MEAL_PLAN_DAY_KCAL_CHECK.checkedDayStatuses;
  const days = new Map<string, { kcal: number; checked: boolean }>();
  for (const item of payload.items) {
    if (item.date < from) continue;
    const day = days.get(item.date) ?? { kcal: 0, checked: false };
    day.kcal += item.kcal;
    day.checked ||= checked.includes(item.day_status);
    days.set(item.date, day);
  }
  return [...days.entries()]
    .filter(([date, day]) => {
      if (!day.checked) return false;
      const floor = floorFor(date);
      return floor !== null && day.kcal + MEAL_PLAN_DAY_KCAL_CHECK.roundingToleranceKcal < floor;
    })
    .map(([date]) => date)
    .sort();
}
