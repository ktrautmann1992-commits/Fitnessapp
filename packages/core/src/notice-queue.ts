/**
 * Hinweis-Zeile statt Hinweis-Stapel („App verschlanken“, Gründer-Freigabe 26.10.2026, docs/PLAN-DASHBOARD.md 11.3).
 * Reine Vorrang-Regel – die App zeigt nur an:
 *
 * 1. **Sperrend** (`blocking`): Arzt-/Einwilligungs-Hinweise, Plan abgelaufen bzw. strengere Regeln, fremde Daten,
 *    Plan muss neu erstellt werden. Stehen IMMER vollständig oben, nie zugeklappt.
 * 2. **Handeln** (`action`): Entwurf, Konflikt, Sitzung abgelaufen, offline, Wettkampf passt nicht, Tausch-Rückmeldung.
 * 3. **Info** (`info`): Testinhalte, Zeit zum Messen, Einladungen, Tages-Check, Plan-Hinweise.
 * 4. **Erfolg** (`success`): „Gespeichert“ u. ä. – Rückmeldung auf eine eigene Aktion: steht immer kurz sichtbar
 *    (`success`, nie hinter dem Zähler), bis die Person sie schließt bzw. die Seite verlässt.
 *
 * Gibt es keinen sperrenden Hinweis, steht der wichtigste übrige Hinweis vollständig da (`lead`); alle weiteren liegen
 * hinter „+N weitere Hinweise“ (`rest`, aufklappbar). Gibt es sperrende, liegen ALLE übrigen dahinter – so steht oben
 * nie mehr als nötig. Gleiche Stufe → Reihenfolge der Eingabe (stabil). Ein einzelner übriger Hinweis wird nie
 * versteckt (ein Zähler „+1“ für nur einen Hinweis spart nichts).
 */

export const NOTICE_LEVELS = ['blocking', 'action', 'info', 'success'] as const;
export type NoticeLevel = (typeof NOTICE_LEVELS)[number];

export interface QueuedNotice {
  readonly id: string;
  readonly level: NoticeLevel;
}

export interface NoticeQueue<T extends QueuedNotice> {
  /** Sperrende Hinweise – immer sichtbar, in Eingabe-Reihenfolge. */
  readonly blocking: readonly T[];
  /** Wichtigster übriger Hinweis, vollständig sichtbar (null, wenn sperrende da sind oder keiner übrig ist). */
  readonly lead: T | null;
  /** Hinter „+N weitere Hinweise“ (nach Stufe sortiert). */
  readonly rest: readonly T[];
  /** Erfolgs-Rückmeldungen – immer sichtbar (zählen nicht zum Zähler). */
  readonly success: readonly T[];
}

/**
 * Hinweise ordnen. `null`/`undefined`/`false` (nicht angezeigte Hinweise) fallen weg; doppelte IDs zählen einmal
 * (der erste gewinnt).
 */
export function noticeQueue<T extends QueuedNotice>(
  items: readonly (T | null | undefined | false)[],
): NoticeQueue<T> {
  const seen = new Set<string>();
  const present: T[] = [];
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    present.push(item);
  }
  const rank = (level: NoticeLevel) => NOTICE_LEVELS.indexOf(level);
  const sorted = present
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.level) - rank(b.item.level) || a.index - b.index)
    .map((x) => x.item);
  const blocking = sorted.filter((x) => x.level === 'blocking');
  const success = sorted.filter((x) => x.level === 'success');
  const others = sorted.filter((x) => x.level !== 'blocking' && x.level !== 'success');
  if (blocking.length > 0) {
    // Nur ein einziger übriger Hinweis → nicht verstecken.
    return others.length === 1
      ? { blocking, lead: others[0] ?? null, rest: [], success }
      : { blocking, lead: null, rest: others, success };
  }
  return { blocking, lead: others[0] ?? null, rest: others.slice(1), success };
}
