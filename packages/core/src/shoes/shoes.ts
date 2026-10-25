import { z } from 'zod';

import { isoDateSchema } from '../age';
import { SHOE_MILEAGE } from '../constants';
import { addDays } from '../dates';
import type { EnduranceModality } from '../enums';
import type { EnduranceActivity } from '../routes/activities';

/**
 * Schuh-Kilometerzähler (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-10.md Abschnitt 22). Eigene Schuhe je Sportart
 * (Laufen, Gehen/Wandern, Rad), Standard-Schuh je Sportart mit Beginn-Datum, Zuordnung je Lauf und Kilometer-Summe.
 *
 * Regeln (rein, deterministisch):
 * - Ein Lauf bekommt AUTOMATISCH den Standard-Schuh seiner Sportart, der an seinem Tag galt (`shoe_defaults`: je
 *   Sportart ab `valid_from`; später geänderte Standards ändern frühere Läufe nicht). Ein ausgemusterter Schuh bekommt
 *   nach seinem Ausmusterungstag nichts mehr automatisch.
 * - Je Lauf kann die Person den Schuh ändern oder „ohne Schuh“ wählen (`shoe_assignments`, Schlüssel wie
 *   `EnduranceActivity.key`: `route:<id>` bzw. `log:<id>`; eine Strecke findet auch die Wahl ihres verknüpften
 *   Eintrags).
 * - Kilometer je Schuh = Start-Kilometer + Distanz aller ihm zugeordneten Läufe (ohne Distanz zählt 0).
 * - Hinweis „Bald wechseln“ ab 75 % der Wechsel-Grenze (Standard 800 km → 600 km), „Wechsel empfohlen“ ab der Grenze
 *   (SHOE_MILEAGE, Material-Faustregel, keine medizinische Aussage).
 * Kein Gesundheitsdatum (Ausrüstung). Gespeichert über `save_shoe_data` (Migration 20261025120400_shoes.sql).
 */

export const SHOE_SPORTS = ['run', 'walk', 'bike'] as const;
export type ShoeSport = (typeof SHOE_SPORTS)[number];
export const shoeSportSchema = z.enum(SHOE_SPORTS);

const S = SHOE_MILEAGE;
const uuid = z.uuid();
const activityKeySchema = z
  .string()
  .regex(/^(route|log):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

/** Ein Schuh (Spalten wie public.shoes ohne user_id und Zeitstempel). */
export const shoeSchema = z
  .strictObject({
    id: uuid,
    sport: shoeSportSchema,
    name: z.string().trim().min(1).max(S.nameMaxLength),
    brand: z.string().trim().min(1).max(S.brandMaxLength).nullable(),
    start_km: z.number().int().min(0).max(S.startKmMax),
    /** Eigene Wechsel-Grenze; null = Standard (SHOE_MILEAGE.replaceKm). */
    replace_km: z.number().int().min(S.replaceKmLimits.min).max(S.replaceKmLimits.max).nullable(),
    in_use_since: isoDateSchema,
    retired_on: isoDateSchema.nullable(),
  })
  .refine((s) => s.retired_on === null || s.retired_on >= s.in_use_since, {
    path: ['retired_on'],
    message: 'retired_before_start',
  });
export type Shoe = z.infer<typeof shoeSchema>;

/** Standard-Schuh einer Sportart ab einem Tag (null = ab dann kein Standard). */
export const shoeDefaultSchema = z.strictObject({
  sport: shoeSportSchema,
  valid_from: isoDateSchema,
  shoe_id: uuid.nullable(),
});
export type ShoeDefault = z.infer<typeof shoeDefaultSchema>;

/** Wahl je Lauf (null = ausdrücklich ohne Schuh). */
export const shoeAssignmentSchema = z.strictObject({
  activity_key: activityKeySchema,
  shoe_id: uuid.nullable(),
});
export type ShoeAssignment = z.infer<typeof shoeAssignmentSchema>;

/**
 * Alles zu den Schuhen einer Person – so wird es gespeichert (save_shoe_data ersetzt den ganzen Stand; die Datenbank
 * prüft dieselben Regeln, db-sync.test.ts).
 */
export const shoeDataSchema = z
  .strictObject({
    shoes: z.array(shoeSchema).max(S.maxShoes),
    defaults: z.array(shoeDefaultSchema).max(S.maxShoes * 20),
    assignments: z.array(shoeAssignmentSchema).max(S.maxAssignments),
  })
  .refine((d) => new Set(d.shoes.map((s) => s.id)).size === d.shoes.length, {
    path: ['shoes'],
    message: 'duplicate_shoe',
  })
  .refine(
    (d) => new Set(d.defaults.map((x) => `${x.sport}|${x.valid_from}`)).size === d.defaults.length,
    { path: ['defaults'], message: 'duplicate_default' },
  )
  .refine((d) => new Set(d.assignments.map((a) => a.activity_key)).size === d.assignments.length, {
    path: ['assignments'],
    message: 'duplicate_assignment',
  })
  .refine(
    (d) =>
      d.defaults.every(
        (x) => x.shoe_id === null || d.shoes.some((s) => s.id === x.shoe_id && s.sport === x.sport),
      ),
    { path: ['defaults'], message: 'default_shoe_unknown' },
  )
  .refine(
    (d) =>
      d.assignments.every((a) => a.shoe_id === null || d.shoes.some((s) => s.id === a.shoe_id)),
    { path: ['assignments'], message: 'assignment_shoe_unknown' },
  );
export type ShoeData = z.infer<typeof shoeDataSchema>;

export const EMPTY_SHOE_DATA: ShoeData = { shoes: [], defaults: [], assignments: [] };

/** Gespeicherten Stand an der Grenze lesen; ungültig → leer (nie ein halber Stand). */
export function parseShoeData(raw: unknown): ShoeData | null {
  const parsed = shoeDataSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Welche Schuhe passen zu einer Ausdauer-Art? Laufen/Gehen: Lauf- und Wanderschuhe; Rad: Radschuhe; Schwimmen: keine. */
export function shoeSportsFor(sport: EnduranceModality): readonly ShoeSport[] {
  if (sport === 'run' || sport === 'walk') return ['run', 'walk'];
  if (sport === 'bike') return ['bike'];
  return [];
}

/** Standard-Schuh einer Sportart an einem Tag (letzter Eintrag mit valid_from ≤ Tag), sonst null. */
export function defaultShoeOn(data: ShoeData, sport: ShoeSport, day: string): string | null {
  let best: ShoeDefault | null = null;
  for (const d of data.defaults) {
    if (d.sport !== sport || d.valid_from > day) continue;
    if (best === null || d.valid_from > best.valid_from) best = d;
  }
  return best?.shoe_id ?? null;
}

/** Aktueller Standard-Schuh je Sportart (heute). */
export function currentDefaultShoe(data: ShoeData, sport: ShoeSport, today: string): Shoe | null {
  const id = defaultShoeOn(data, sport, today);
  const shoe = id === null ? null : (data.shoes.find((s) => s.id === id) ?? null);
  return shoe && (shoe.retired_on === null || shoe.retired_on >= today) ? shoe : null;
}

export type ShoeSource = 'chosen' | 'default' | 'none';

export interface ActivityShoe {
  readonly shoe: Shoe | null;
  /** `chosen` = ausdrücklich gewählt (auch „ohne Schuh“), `default` = automatisch, `none` = kein Standard. */
  readonly source: ShoeSource;
}

/** Ausdrückliche Wahl zu einer Aktivität: zuerst ihr Schlüssel, dann (Strecke) der verknüpfte Eintrag. */
function chosenFor(
  data: ShoeData,
  activity: Pick<EnduranceActivity, 'key' | 'logId' | 'routeId'>,
): ShoeAssignment | null {
  const keys = [activity.key];
  if (activity.routeId !== null) keys.push(`route:${activity.routeId}`);
  if (activity.logId !== null) keys.push(`log:${activity.logId}`);
  for (const key of keys) {
    const found = data.assignments.find((a) => a.activity_key === key);
    if (found) return found;
  }
  return null;
}

/** Schuh eines Laufs: Wahl der Person, sonst der Standard der Sportart an diesem Tag. */
export function shoeForActivity(
  data: ShoeData,
  activity: Pick<EnduranceActivity, 'key' | 'logId' | 'routeId' | 'sport' | 'day'>,
): ActivityShoe {
  const chosen = chosenFor(data, activity);
  if (chosen) {
    return {
      shoe:
        chosen.shoe_id === null ? null : (data.shoes.find((s) => s.id === chosen.shoe_id) ?? null),
      source: 'chosen',
    };
  }
  const sport = activity.sport;
  if (sport !== 'run' && sport !== 'walk' && sport !== 'bike')
    return { shoe: null, source: 'none' };
  const id = defaultShoeOn(data, sport, activity.day);
  const shoe = id === null ? null : (data.shoes.find((s) => s.id === id) ?? null);
  if (!shoe || (shoe.retired_on !== null && activity.day > shoe.retired_on)) {
    return { shoe: null, source: 'none' };
  }
  return { shoe, source: 'default' };
}

export type ShoeStatus = 'ok' | 'soon' | 'replace';

/** Wechsel-Grenze und Hinweis-Grenze (km) eines Schuhs. */
export function shoeLimits(shoe: Pick<Shoe, 'replace_km'>): { warnKm: number; replaceKm: number } {
  const replaceKm = shoe.replace_km ?? S.replaceKm;
  return { warnKm: Math.round(replaceKm * S.warnShare), replaceKm };
}

/** Hinweis-Stufe: unter 75 % „ok“, ab 75 % „Bald wechseln“, ab der Grenze „Wechsel empfohlen“. */
export function shoeStatus(km: number, shoe: Pick<Shoe, 'replace_km'>): ShoeStatus {
  const { warnKm, replaceKm } = shoeLimits(shoe);
  if (km >= replaceKm) return 'replace';
  if (km >= warnKm) return 'soon';
  return 'ok';
}

export interface ShoeMileage {
  readonly shoe: Shoe;
  /** Start-Kilometer + Läufe, auf 0,1 km. */
  readonly km: number;
  /** Nur die Läufe in der App (ohne Start-Kilometer). */
  readonly appKm: number;
  readonly activityCount: number;
  readonly lastUsed: string | null;
  readonly status: ShoeStatus;
  readonly warnKm: number;
  readonly replaceKm: number;
  /** Anteil an der Wechsel-Grenze für den Balken (0–1). */
  readonly share: number;
  readonly retired: boolean;
  /** Aktueller Standard seiner Sportart? */
  readonly isDefault: boolean;
}

const round1 = (km: number) => Math.round(km * 10) / 10;

/**
 * Kilometer je Schuh aus allen Aktivitäten (EnduranceActivity, ohne Doppelzählung). Reihenfolge: aktive vor
 * ausgemusterten, dann Sportart (Laufen, Gehen, Rad), dann Name.
 */
export function shoeMileage(
  data: ShoeData,
  activities: readonly EnduranceActivity[],
  today: string,
): ShoeMileage[] {
  const meters = new Map<string, number>();
  const counts = new Map<string, number>();
  const last = new Map<string, string>();
  for (const activity of activities) {
    const { shoe } = shoeForActivity(data, activity);
    if (!shoe) continue;
    meters.set(shoe.id, (meters.get(shoe.id) ?? 0) + (activity.distanceM ?? 0));
    counts.set(shoe.id, (counts.get(shoe.id) ?? 0) + 1);
    const prev = last.get(shoe.id);
    if (prev === undefined || activity.day > prev) last.set(shoe.id, activity.day);
  }
  const order = (s: Shoe) => SHOE_SPORTS.indexOf(s.sport);
  return data.shoes
    .map((shoe): ShoeMileage => {
      const appKm = round1((meters.get(shoe.id) ?? 0) / 1000);
      const km = round1(shoe.start_km + appKm);
      const { warnKm, replaceKm } = shoeLimits(shoe);
      const retired = shoe.retired_on !== null && shoe.retired_on <= today;
      return {
        shoe,
        km,
        appKm,
        activityCount: counts.get(shoe.id) ?? 0,
        lastUsed: last.get(shoe.id) ?? null,
        status: shoeStatus(km, shoe),
        warnKm,
        replaceKm,
        share: Math.min(1, km / replaceKm),
        retired,
        isDefault: !retired && currentDefaultShoe(data, shoe.sport, today)?.id === shoe.id,
      };
    })
    .sort(
      (a, b) =>
        Number(a.retired) - Number(b.retired) ||
        order(a.shoe) - order(b.shoe) ||
        a.shoe.name.localeCompare(b.shoe.name, 'de'),
    );
}

/** Frühester Tag, ab dem Läufe für Schuhe zählen können (für das Nachladen älterer Einträge); null ohne Schuhe. */
export function shoeHistoryStart(data: ShoeData): string | null {
  const days = [
    ...data.shoes.map((s) => s.in_use_since),
    ...data.defaults.filter((d) => d.shoe_id !== null).map((d) => d.valid_from),
  ];
  return days.length === 0 ? null : days.reduce((a, b) => (a < b ? a : b));
}

// ---------------------------------------------------------------------------------------------------------
// Änderungen (rein): jede gibt einen neuen, gültigen Stand zurück
// ---------------------------------------------------------------------------------------------------------

export interface ShoeDraft {
  readonly id: string;
  readonly sport: ShoeSport;
  readonly name: string;
  readonly brand: string | null;
  readonly startKm: number;
  readonly replaceKm: number | null;
  readonly inUseSince: string;
  /** Als Standard seiner Sportart ab `inUseSince` setzen. */
  readonly makeDefault: boolean;
}

export type ShoeChangeResult =
  | { readonly ok: true; readonly data: ShoeData }
  | { readonly ok: false; readonly error: 'invalid' | 'too_many' | 'not_found' };

function checked(data: ShoeData): ShoeChangeResult {
  const parsed = shoeDataSchema.safeParse(data);
  if (parsed.success) return { ok: true, data: parsed.data };
  const tooMany = parsed.error.issues.some((i) => i.code === 'too_big' && i.path[0] === 'shoes');
  return { ok: false, error: tooMany ? 'too_many' : 'invalid' };
}

/** Standard einer Sportart ab einem Tag setzen (ersetzt einen Eintrag am selben Tag). */
export function setDefaultShoe(
  data: ShoeData,
  sport: ShoeSport,
  shoeId: string | null,
  from: string,
): ShoeChangeResult {
  return checked({
    ...data,
    defaults: [
      ...data.defaults.filter((d) => !(d.sport === sport && d.valid_from === from)),
      { sport, valid_from: from, shoe_id: shoeId },
    ].sort((a, b) => a.sport.localeCompare(b.sport) || a.valid_from.localeCompare(b.valid_from)),
  });
}

/** Neuen Schuh anlegen bzw. bestehenden ändern; `makeDefault` = Standard seiner Sportart ab „In Gebrauch seit“. */
export function saveShoe(data: ShoeData, draft: ShoeDraft): ShoeChangeResult {
  const existing = data.shoes.find((s) => s.id === draft.id);
  const shoe = {
    id: draft.id,
    sport: draft.sport,
    name: draft.name.trim(),
    brand: draft.brand === null || draft.brand.trim() === '' ? null : draft.brand.trim(),
    start_km: draft.startKm,
    replace_km: draft.replaceKm,
    in_use_since: draft.inUseSince,
    retired_on: existing?.retired_on ?? null,
  };
  // Sportart geändert: alte Standard-Einträge dieses Schuhs gelten nicht mehr (der Standard gehört zur Sportart).
  const defaults =
    existing && existing.sport !== shoe.sport
      ? data.defaults.map((d) => (d.shoe_id === shoe.id ? { ...d, shoe_id: null } : d))
      : data.defaults;
  const next: ShoeData = {
    ...data,
    shoes: existing ? data.shoes.map((s) => (s.id === shoe.id ? shoe : s)) : [...data.shoes, shoe],
    defaults,
  };
  if (!draft.makeDefault) return checked(next);
  const first = checked(next);
  if (!first.ok) return first;
  return setDefaultShoe(first.data, shoe.sport, shoe.id, shoe.in_use_since);
}

/**
 * Schuh ausmustern (ab `day`) bzw. wieder aktivieren (`day` null). War er der aktuelle Standard, gilt ab dem Tag danach
 * kein Standard mehr – die App bietet an, einen neuen zu wählen.
 */
export function retireShoe(data: ShoeData, shoeId: string, day: string | null): ShoeChangeResult {
  const shoe = data.shoes.find((s) => s.id === shoeId);
  if (!shoe) return { ok: false, error: 'not_found' };
  const retiredOn = day === null ? null : day < shoe.in_use_since ? shoe.in_use_since : day;
  const next: ShoeData = {
    ...data,
    shoes: data.shoes.map((s) => (s.id === shoeId ? { ...s, retired_on: retiredOn } : s)),
  };
  if (retiredOn !== null && defaultShoeOn(data, shoe.sport, retiredOn) === shoeId) {
    const after = addDays(retiredOn, 1);
    // Nur wenn ab dem Tag danach nicht schon ein anderer Standard eingetragen ist.
    if (defaultShoeOn(data, shoe.sport, after) === shoeId) {
      return setDefaultShoe(next, shoe.sport, null, after);
    }
  }
  return checked(next);
}

/** Schuh löschen: seine Wahl je Lauf entfällt (zurück auf automatisch), Standard-Einträge werden zu „kein Standard“. */
export function deleteShoe(data: ShoeData, shoeId: string): ShoeChangeResult {
  if (!data.shoes.some((s) => s.id === shoeId)) return { ok: false, error: 'not_found' };
  return checked({
    shoes: data.shoes.filter((s) => s.id !== shoeId),
    defaults: data.defaults.map((d) => (d.shoe_id === shoeId ? { ...d, shoe_id: null } : d)),
    assignments: data.assignments.filter((a) => a.shoe_id !== shoeId),
  });
}

/**
 * Schuh eines Laufs wählen: `shoeId` = dieser Schuh, null = „ohne Schuh“, `'auto'` = zurück auf den Standard. Die Wahl
 * hängt am Schlüssel der Aktivität; ältere Wahlen über den verknüpften Eintrag werden ersetzt.
 */
export function assignShoe(
  data: ShoeData,
  activity: Pick<EnduranceActivity, 'key' | 'logId' | 'routeId'>,
  shoeId: string | null | 'auto',
): ShoeChangeResult {
  const keys = new Set([activity.key]);
  if (activity.routeId !== null) keys.add(`route:${activity.routeId}`);
  if (activity.logId !== null) keys.add(`log:${activity.logId}`);
  const others = data.assignments.filter((a) => !keys.has(a.activity_key));
  if (shoeId !== null && shoeId !== 'auto' && !data.shoes.some((s) => s.id === shoeId)) {
    return { ok: false, error: 'not_found' };
  }
  return checked({
    ...data,
    assignments:
      shoeId === 'auto' ? others : [...others, { activity_key: activity.key, shoe_id: shoeId }],
  });
}
