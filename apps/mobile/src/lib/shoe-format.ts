import {
  isoDateSchema,
  type ShoeDraft,
  type ShoeSport,
  type ShoeStatus,
  SHOE_MILEAGE,
} from '@fitnessapp/core';

import { t } from '@/i18n';
import { isoFromDateParts } from '@/lib/format';

const S = t.shoes;

/**
 * Anzeige und Formular des Schuh-Kilometerzählers. Rechnet keine Regeln (die stehen in packages/core) – nur Texte und
 * das Umwandeln der Eingabefelder. Rein, getestet.
 */

/** Kilometer ganzzahlig mit Tausender-Punkt: 412,4 → „412“, 1203 → „1.203“. */
export function shoeKmText(km: number): string {
  return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Hinweis in Zeichen und Wort, z. B. „! Bald wechseln“. */
export function shoeStatusText(status: ShoeStatus): string {
  const s = S.status[status];
  return `${s.symbol} ${s.label}`;
}

/** „Schuh: Pegasus 41 (412 km)“ bzw. „Schuh: keiner“. */
export function shoeChipText(name: string | null, km: number): string {
  return name === null ? S.chip.none : S.chip.label(name, shoeKmText(km));
}

export interface ShoeForm {
  readonly name: string;
  readonly brand: string;
  readonly sport: ShoeSport;
  readonly startKm: string;
  readonly replaceKm: string;
  readonly since: { day: string; month: string; year: string };
  readonly makeDefault: boolean;
}

export type ShoeFormErrors = Partial<
  Record<'name' | 'brand' | 'startKm' | 'replaceKm' | 'since', string>
>;

const wholeNumber = (text: string): number | null => {
  const trimmed = text.trim().replace(/\./g, '');
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
};

/** Formular → Entwurf (packages/core prüft danach erneut); Fehler je Feld auf Deutsch. */
export function shoeDraftFromForm(
  form: ShoeForm,
  id: string,
  today: string,
): { ok: true; draft: ShoeDraft } | { ok: false; errors: ShoeFormErrors } {
  const errors: ShoeFormErrors = {};
  const M = SHOE_MILEAGE;
  const name = form.name.trim();
  if (name.length === 0 || name.length > M.nameMaxLength) errors.name = S.form.nameError;
  const brand = form.brand.trim();
  if (brand.length > M.brandMaxLength) errors.brand = S.form.brandError;
  const startKm = form.startKm.trim() === '' ? 0 : wholeNumber(form.startKm);
  if (startKm === null || startKm > M.startKmMax) errors.startKm = S.form.startKmError;
  const replaceKm = form.replaceKm.trim() === '' ? null : wholeNumber(form.replaceKm);
  if (
    form.replaceKm.trim() !== '' &&
    (replaceKm === null || replaceKm < M.replaceKmLimits.min || replaceKm > M.replaceKmLimits.max)
  ) {
    errors.replaceKm = S.form.replaceKmError;
  }
  const since = isoFromDateParts(form.since.day, form.since.month, form.since.year);
  if (since === null || !isoDateSchema.safeParse(since).success || since > today) {
    errors.since = S.form.dateError;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      id,
      sport: form.sport,
      name,
      brand: brand === '' ? null : brand,
      startKm: startKm ?? 0,
      // Standard-Grenze nicht als eigene Grenze speichern.
      replaceKm: replaceKm === M.replaceKm ? null : replaceKm,
      inUseSince: since as string,
      makeDefault: form.makeDefault,
    },
  };
}
