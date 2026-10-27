/**
 * Begleit-Seite (/begleitung): Zustand → Texte (rein, testbar). Regeln aus packages/core (live/): Alter der Position,
 * Dauer, Uhrzeit. Angezeigt werden NUR Anzeigename, Sportart, Startzeit, „zuletzt aktualisiert vor …“ und die letzte
 * Position (CLAUDE.md) – keine Gesundheitsdaten, keine Pace, keine Spur.
 */
import {
  LIVE_EMERGENCY_HINT,
  liveAgoText,
  liveClockText,
  liveDurationText,
  liveMapUrl,
  type LiveSport,
  type LiveStaleness,
  positionStaleness,
} from '@fitnessapp/core';

import type { LiveApiBody } from './handler';

export const LIVE_SPORT_LABELS: Record<LiveSport, string> = {
  run: 'Laufen',
  bike: 'Rad',
  walk: 'Gehen',
};

export const LIVE_TEXTS = {
  title: 'Live-Begleitung',
  loading: 'Live-Begleitung wird geladen …',
  /** Abgelaufen, beendet und ungültig – dieselbe Meldung (Tokens lassen sich nicht ausprobieren). */
  gone: 'Diese Live-Begleitung ist beendet.',
  goneHint: 'Der Link zeigt keinen Standort mehr. Bei Sorge ruf die Person direkt an.',
  rateLimited: 'Zu viele Abfragen in kurzer Zeit – die Seite versucht es gleich wieder.',
  error: 'Gerade keine Verbindung zum Server – neuer Versuch in Kürze.',
  unavailable: 'Die Live-Begleitung ist gerade nicht verfügbar.',
  noPosition: 'Noch keine Position – sie erscheint, sobald das Handy GPS-Empfang hat.',
  paused: 'Pausiert',
  openMap: 'In Karten-App öffnen',
  mapFailed: 'Die Karte lädt gerade nicht. Die Position kannst du in einer Karten-App öffnen.',
  callHint: 'Bei Sorge anrufen.',
  emergency: LIVE_EMERGENCY_HINT,
  notEmergencyService: 'Die Live-Begleitung ist kein Notruf-Ersatz.',
  privacy:
    'Du siehst nur die letzte Position – keine Strecke, keine Gesundheitsdaten. Bitte den Link nicht weiterleiten.',
  demo: 'Demo mit ausgedachten Daten – so sieht die Seite für deine Kontakte aus.',
  accuracy: (m: number) => `Genauigkeit ca. ${m} m`,
} as const;

export interface LiveScreen {
  readonly kind: 'loading' | 'open' | 'closed' | 'gone' | 'rate_limited' | 'error' | 'unavailable';
  readonly heading: string;
  readonly sport: string | null;
  readonly since: string | null;
  readonly updated: string | null;
  readonly staleness: LiveStaleness | null;
  readonly warning: string | null;
  readonly paused: boolean;
  readonly position: { lat: number; lon: number; accuracyM: number | null } | null;
  readonly mapUrl: string | null;
}

const base: Omit<LiveScreen, 'kind' | 'heading'> = {
  sport: null,
  since: null,
  updated: null,
  staleness: null,
  warning: null,
  paused: false,
  position: null,
  mapUrl: null,
};

/**
 * Texte für die Seite. `body` = letzte Antwort (null = lädt), `now` = Zeit des Servers (Antwort + vergangene Zeit),
 * damit „vor 20 s“ nicht von einer falsch gehenden Uhr des Kontakts abhängt.
 */
export function liveScreen(body: LiveApiBody | null, now: number): LiveScreen {
  if (body === null) return { ...base, kind: 'loading', heading: LIVE_TEXTS.loading };
  switch (body.state) {
    case 'invalid':
      return { ...base, kind: 'gone', heading: LIVE_TEXTS.gone };
    case 'rate_limited':
      return { ...base, kind: 'rate_limited', heading: LIVE_TEXTS.rateLimited };
    case 'error':
      return { ...base, kind: 'error', heading: LIVE_TEXTS.error };
    case 'unavailable':
      return { ...base, kind: 'unavailable', heading: LIVE_TEXTS.unavailable };
    case 'arrived':
    case 'ended': {
      const at = liveClockText(body.ended_at);
      return {
        ...base,
        kind: 'closed',
        heading:
          body.state === 'arrived'
            ? `${body.display_name} ist angekommen (${at})`
            : `${body.display_name} hat die Live-Begleitung beendet (${at})`,
        sport: LIVE_SPORT_LABELS[body.sport],
        since: `Gestartet um ${liveClockText(body.started_at)}`,
      };
    }
    case 'active':
    case 'paused': {
      const startedMs = Date.parse(body.started_at);
      const p = body.position;
      const ageS = p ? Math.max(0, (now - Date.parse(p.recorded_at)) / 1000) : null;
      const staleness = p ? positionStaleness(p.recorded_at, now) : null;
      return {
        ...base,
        kind: 'open',
        heading:
          body.state === 'paused'
            ? `${body.display_name} macht gerade Pause`
            : `${body.display_name} ist unterwegs`,
        sport: LIVE_SPORT_LABELS[body.sport],
        since: `läuft seit ${liveDurationText((now - startedMs) / 1000)} (Start ${liveClockText(startedMs)})`,
        updated: ageS === null ? null : `zuletzt aktualisiert ${liveAgoText(ageS)}`,
        staleness,
        warning:
          ageS !== null && staleness !== 'fresh'
            ? `Seit ${liveDurationText(ageS)} keine neue Position – evtl. Funkloch oder Akku leer.`
            : p === null
              ? LIVE_TEXTS.noPosition
              : null,
        paused: body.state === 'paused',
        position: p ? { lat: p.lat, lon: p.lon, accuracyM: p.accuracy_m } : null,
        mapUrl: p ? liveMapUrl(p.lat, p.lon) : null,
      };
    }
  }
}
