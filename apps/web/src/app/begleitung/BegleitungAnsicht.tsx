'use client';

import { LIVE_COMPANION, parseLiveFragment, type LiveFragment } from '@fitnessapp/core';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { demoLiveView, DEMO_STARTED_MIN_AGO } from '@/lib/live/demo';
import type { LiveApiBody } from '@/lib/live/handler';
import { LIVE_TEXTS, liveScreen } from '@/lib/live/view-model';

import styles from './begleitung.module.css';
import { LiveKarte } from './LiveKarte';

const abonnieren = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** Zustand der letzten Antwort + Abstand der Server-Uhr zur Uhr dieses Geräts. */
interface Loaded {
  readonly body: LiveApiBody;
  readonly offsetMs: number;
}

/** Abfrage alle 20 s, im Hintergrund-Tab pausiert (Akku, Kosten). „Beendet“ fragt nicht weiter nach. */
function usePolling(fragment: LiveFragment | null): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const demoStart = useRef<number | null>(null);

  useEffect(() => {
    if (fragment === null) return;
    let timer: number | undefined;
    let stopped = false;
    let busy = false;

    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        if (fragment.kind === 'demo') {
          demoStart.current ??= Date.now() - DEMO_STARTED_MIN_AGO * 60_000;
          setLoaded({ body: demoLiveView(demoStart.current, Date.now()), offsetMs: 0 });
          return;
        }
        const response = await fetch('/api/begleitung', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: fragment.token }),
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        const body = (await response.json()) as LiveApiBody;
        const server = 'server_time' in body ? Date.parse(body.server_time) : Number.NaN;
        setLoaded({ body, offsetMs: Number.isFinite(server) ? server - Date.now() : 0 });
        if (body.state === 'invalid') stopped = true;
      } catch {
        setLoaded((prev) =>
          prev && prev.body.state !== 'error' ? prev : { body: { state: 'error' }, offsetMs: 0 },
        );
      } finally {
        busy = false;
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      if (stopped) return;
      timer = window.setTimeout(() => void tick(), LIVE_COMPANION.viewPollS * 1000);
    };
    const tick = async () => {
      if (document.visibilityState === 'visible') await load();
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !stopped) void tick();
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fragment]);

  return loaded;
}

/** Sekundentakt für „zuletzt aktualisiert vor …“. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Begleit-Seite im Browser der Vertrauensperson. Liest das Token aus dem Fragment (#t=…; nie an einen Server
 * geschickt außer im Körper der eigenen Abfrage), zeigt Name, Sportart, Startzeit, „zuletzt aktualisiert vor …“ und
 * EINEN Punkt auf der Karte. Abgeschlossen: nur Status ohne Karte. Ungültig/abgelaufen: eine einzige Meldung.
 */
export function BegleitungAnsicht() {
  // Auf dem Server (und vor dem ersten Rendern im Browser) gibt es kein Fragment: undefined = „lädt“.
  const hash = useSyncExternalStore(
    abonnieren,
    () => window.location.hash,
    () => undefined,
  );
  // undefined = noch nicht geprüft, null = kein gültiges Token im Link.
  const fragment = useMemo(
    () => (hash === undefined ? undefined : parseLiveFragment(hash)),
    [hash],
  );

  const loaded = usePolling(fragment ?? null);
  const now = useNow();

  const screen =
    fragment === null
      ? liveScreen({ state: 'invalid' }, now)
      : liveScreen(loaded?.body ?? null, now + (loaded?.offsetMs ?? 0));

  return (
    <section
      className={styles.ansicht}
      aria-live="polite"
      data-testid="begleitung"
      data-state={screen.kind}
    >
      {fragment?.kind === 'demo' ? (
        <p className={styles.demo} data-testid="begleitung-demo">
          {LIVE_TEXTS.demo}
        </p>
      ) : null}
      <h1 className={styles.titel} data-testid="begleitung-titel">
        {screen.heading}
      </h1>
      {screen.kind === 'gone' ? <p className={styles.text}>{LIVE_TEXTS.goneHint}</p> : null}
      {screen.sport || screen.since ? (
        <p className={styles.zeile}>
          {screen.sport ? (
            <span className={styles.sportart} data-testid="begleitung-sportart">
              {screen.sport}
            </span>
          ) : null}
          {screen.paused ? <span className={styles.pause}>{LIVE_TEXTS.paused}</span> : null}
          {screen.since ? <span data-testid="begleitung-seit">{screen.since}</span> : null}
        </p>
      ) : null}
      {screen.updated ? (
        <p className={styles.aktualisiert} data-testid="begleitung-aktualisiert">
          {screen.updated}
        </p>
      ) : null}
      {screen.warning ? (
        <p className={styles.warnung} role="status" data-testid="begleitung-warnung">
          {screen.warning}
        </p>
      ) : null}
      {screen.position ? (
        <>
          <LiveKarte
            lat={screen.position.lat}
            lon={screen.position.lon}
            accuracyM={screen.position.accuracyM}
            stale={screen.staleness !== 'fresh'}
            failedText={LIVE_TEXTS.mapFailed}
          />
          {screen.position.accuracyM !== null ? (
            <p className={styles.klein}>{LIVE_TEXTS.accuracy(screen.position.accuracyM)}</p>
          ) : null}
          {screen.mapUrl ? (
            <a
              className={styles.knopf}
              href={screen.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              data-testid="begleitung-kartenapp"
            >
              {LIVE_TEXTS.openMap}
            </a>
          ) : null}
        </>
      ) : null}
      <aside className={styles.notfall} data-testid="begleitung-notfall">
        <p>
          <strong>{LIVE_TEXTS.callHint}</strong> {LIVE_TEXTS.emergency}
        </p>
        <p className={styles.klein}>{LIVE_TEXTS.notEmergencyService}</p>
      </aside>
      {screen.kind === 'open' ? <p className={styles.klein}>{LIVE_TEXTS.privacy}</p> : null}
    </section>
  );
}
