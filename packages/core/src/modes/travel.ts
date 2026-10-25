import { z } from 'zod';

import { isoDateSchema } from '../age';
import { TRAVEL_MODE } from '../constants';
import { addDays, daysBetween } from '../dates';
import { TRAVEL_EQUIPMENT_OPTIONS, type TravelEquipment } from '../enums';

/**
 * Reise-Modus (docs/PLAN-TRAINING-MODI.md 4, Gründer-Freigabe 25.10.2026). Zeitraum + Geräte unterwegs (nur
 * Körpergewicht / Kurzhanteln / Hotel-Gym / Widerstandsband) + optional kürzere Einheiten. Der gespeicherte Plan
 * bleibt unverändert: Die Anzeige der Tage im Zeitraum wird mit den Reise-Geräten neu zusammengesetzt (gleiche
 * Ersatz-Kette wie beim Erzeugen) und nach dem letzten Tag gilt automatisch wieder der normale Plan.
 *
 * Kein Gesundheitsdatum (nur Zeitraum und Geräte). Trotzdem nur für die Person selbst (RLS), im Export enthalten.
 */

const timestamp = z.iso.datetime({ offset: true });
const minutesSchema = z.union([z.literal(20), z.literal(30), z.literal(45), z.literal(60)]);

/** Gespeicherter Reise-Zeitraum (Tabelle `travel_modes`, ohne user_id). */
export const travelModeSchema = z
  .strictObject({
    id: z.uuid(),
    starts_on: isoDateSchema,
    ends_on: isoDateSchema,
    equipment: z.enum(TRAVEL_EQUIPMENT_OPTIONS),
    /** Kürzere Einheiten (Minuten) oder null = Dauer wie geplant. */
    max_minutes: minutesSchema.nullable(),
    created_at: timestamp,
  })
  .refine((t) => t.ends_on >= t.starts_on, {
    path: ['ends_on'],
    message: 'Das Ende darf nicht vor dem Beginn liegen.',
  })
  .refine((t) => daysBetween(t.starts_on, t.ends_on) + 1 <= TRAVEL_MODE.maxDays, {
    path: ['ends_on'],
    message: `Höchstens ${TRAVEL_MODE.maxDays} Tage.`,
  });
export type TravelMode = z.output<typeof travelModeSchema>;

/**
 * Eingabe der App: Beginn ab heute (höchstens TRAVEL_MODE.maxStartAheadDays im Voraus), Ende ≥ Beginn, höchstens
 * TRAVEL_MODE.maxDays Tage.
 */
export function travelModeInputSchema(today: string) {
  return z
    .strictObject({
      starts_on: isoDateSchema,
      ends_on: isoDateSchema,
      equipment: z.enum(TRAVEL_EQUIPMENT_OPTIONS),
      max_minutes: minutesSchema.nullable(),
    })
    .refine((t) => t.starts_on >= today, {
      path: ['starts_on'],
      message: 'Der Beginn liegt in der Vergangenheit.',
    })
    .refine((t) => t.starts_on <= addDays(today, TRAVEL_MODE.maxStartAheadDays), {
      path: ['starts_on'],
      message: 'Der Beginn liegt zu weit in der Zukunft.',
    })
    .refine((t) => t.ends_on >= t.starts_on, {
      path: ['ends_on'],
      message: 'Das Ende darf nicht vor dem Beginn liegen.',
    })
    .refine((t) => daysBetween(t.starts_on, t.ends_on) + 1 <= TRAVEL_MODE.maxDays, {
      path: ['ends_on'],
      message: `Höchstens ${TRAVEL_MODE.maxDays} Tage.`,
    });
}
export type TravelModeInput = z.output<ReturnType<typeof travelModeInputSchema>>;

export function parseTravelModes(rows: readonly unknown[]): TravelMode[] {
  return rows
    .flatMap((row) => {
      const parsed = travelModeSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.id.localeCompare(b.id));
}

/** Geräte-IDs einer Auswahl (TRAVEL_MODE.equipment). */
export function travelEquipmentIds(equipment: TravelEquipment): readonly string[] {
  return TRAVEL_MODE.equipment[equipment];
}

/** Wirksamer Reise-Zeitraum an einem Tag (bei Überschneidung der zuletzt angelegte); null = keiner. */
export function travelModeOn<T extends TravelMode>(modes: readonly T[], date: string): T | null {
  const matching = modes
    .filter((m) => m.starts_on <= date && date <= m.ends_on)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  return matching[0] ?? null;
}

/** Laufender oder nächster Zeitraum ab heute (Banner „Reise-Modus bis …“ bzw. „ab …“); null = keiner. */
export function currentOrNextTravelMode<T extends TravelMode>(
  modes: readonly T[],
  today: string,
): T | null {
  const active = travelModeOn(modes, today);
  if (active) return active;
  return (
    [...modes].filter((m) => m.starts_on > today).sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ??
    null
  );
}

/** Überschneidet sich ein neuer Zeitraum mit einem bestehenden (ohne `ignoreId`)? */
export function travelOverlaps(
  modes: readonly TravelMode[],
  next: Pick<TravelMode, 'starts_on' | 'ends_on'>,
  ignoreId: string | null = null,
): boolean {
  return modes.some(
    (m) => m.id !== ignoreId && m.starts_on <= next.ends_on && next.starts_on <= m.ends_on,
  );
}

/** Was die Anzeige an einem Reisetag braucht (JSON-fähig bis auf das Set). */
export interface TravelOnDay {
  readonly equipment: TravelEquipment;
  readonly available: ReadonlySet<string>;
  readonly maxMinutes: number | null;
  readonly until: string;
}

export function travelOnDay(modes: readonly TravelMode[], date: string): TravelOnDay | null {
  const mode = travelModeOn(modes, date);
  if (!mode) return null;
  return {
    equipment: mode.equipment,
    available: new Set(travelEquipmentIds(mode.equipment)),
    maxMinutes: mode.max_minutes,
    until: mode.ends_on,
  };
}

/** Vorzeitig beenden: Ende = gestern (ab heute normaler Plan); ein künftiger Zeitraum wird ganz entfernt (null). */
export function endTravelMode(mode: TravelMode, today: string): TravelMode | null {
  if (mode.starts_on >= today) return null;
  if (mode.ends_on < today) return mode;
  return { ...mode, ends_on: addDays(today, -1) };
}

/** Neuen Zeitraum bauen (ID und Zeitstempel vom Aufrufer). */
export function newTravelMode(
  input: TravelModeInput,
  meta: { readonly id: string; readonly createdAt: string },
): TravelMode {
  return travelModeSchema.parse({
    id: meta.id,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    equipment: input.equipment,
    max_minutes: input.max_minutes,
    created_at: meta.createdAt,
  });
}
