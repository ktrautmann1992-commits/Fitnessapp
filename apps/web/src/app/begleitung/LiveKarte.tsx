'use client';

import { useEffect, useRef, useState } from 'react';

import {
  accuracyRing,
  MAP_ATTRIBUTION,
  MAP_TIMEOUT_MS,
  MAPLIBRE_CSS,
  MAPLIBRE_CSS_SRI,
  MAPLIBRE_JS,
  MAPLIBRE_JS_SRI,
  OPENFREEMAP_STYLE,
} from '@/lib/live/map';

import styles from './begleitung.module.css';

/** Nur die Teile von maplibre-gl, die die Seite nutzt (Bibliothek kommt per <script> vom CDN). */
interface GeoSource {
  setData(data: unknown): void;
}
interface MapInstance {
  on(event: 'load' | 'error', handler: () => void): void;
  addSource(id: string, source: unknown): void;
  addLayer(layer: unknown): void;
  getSource(id: string): GeoSource | undefined;
  jumpTo(options: { center: [number, number] }): void;
  remove(): void;
}
interface MapLibre {
  Map: new (options: Record<string, unknown>) => MapInstance;
}
declare global {
  interface Window {
    maplibregl?: MapLibre;
  }
}

let loader: Promise<MapLibre> | null = null;

/** Bibliothek einmal laden (Skript + Stil mit Prüfsumme, ohne Cookies/Referer). */
function loadMapLibre(): Promise<MapLibre> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loader) return loader;
  loader = new Promise<MapLibre>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = MAPLIBRE_CSS;
    css.integrity = MAPLIBRE_CSS_SRI;
    css.crossOrigin = 'anonymous';
    css.referrerPolicy = 'no-referrer';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.integrity = MAPLIBRE_JS_SRI;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.async = true;
    script.onload = () =>
      window.maplibregl ? resolve(window.maplibregl) : reject(new Error('maplibre'));
    script.onerror = () => {
      loader = null;
      reject(new Error('maplibre'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

const pointData = (lat: number, lon: number, accuracyM: number | null) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [accuracyRing(lat, lon, accuracyM)] },
    },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } },
  ],
});

/**
 * Karte mit EINEM Punkt (letzte Position) und Genauigkeitskreis. Fällt die Karte aus, bleibt der Link „In Karten-App
 * öffnen“ (von der Seite) – hier nur der Hinweis.
 */
export function LiveKarte({
  lat,
  lon,
  accuracyM,
  stale,
  failedText,
}: {
  lat: number;
  lon: number;
  accuracyM: number | null;
  /** Alte Position: Punkt grau statt blau. */
  stale: boolean;
  failedText: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const ready = useRef(false);
  const latest = useRef({ lat, lon, accuracyM });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!ready.current) setFailed(true);
    }, MAP_TIMEOUT_MS);
    loadMapLibre()
      .then((lib) => {
        if (cancelled || !box.current) return;
        const start = latest.current;
        const instance = new lib.Map({
          container: box.current,
          style: OPENFREEMAP_STYLE,
          center: [start.lon, start.lat],
          zoom: 15,
          attributionControl: { compact: false, customAttribution: MAP_ATTRIBUTION },
          cooperativeGestures: true,
        });
        map.current = instance;
        instance.on('error', () => {
          if (!ready.current) setFailed(true);
        });
        instance.on('load', () => {
          ready.current = true;
          const now = latest.current;
          instance.addSource('position', {
            type: 'geojson',
            data: pointData(now.lat, now.lon, now.accuracyM),
          });
          instance.addLayer({
            id: 'genauigkeit',
            type: 'fill',
            source: 'position',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': '#1f5bff', 'fill-opacity': 0.15 },
          });
          instance.addLayer({
            id: 'punkt',
            type: 'circle',
            source: 'position',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 8,
              'circle-color': '#1f5bff',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
            },
          });
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  // Neue Position: Punkt versetzen und Karte mitführen (keine Linie, keine früheren Punkte).
  useEffect(() => {
    latest.current = { lat, lon, accuracyM };
    const instance = map.current;
    if (!instance || !ready.current) return;
    instance.getSource('position')?.setData(pointData(lat, lon, accuracyM));
    instance.jumpTo({ center: [lon, lat] });
  }, [lat, lon, accuracyM]);

  if (failed) {
    return (
      <p className={styles.hinweis} role="status">
        {failedText}
      </p>
    );
  }
  return (
    <div
      ref={box}
      className={`${styles.karte} ${stale ? styles['karte--alt'] : ''}`}
      role="img"
      aria-label="Karte mit der letzten Position"
      data-testid="begleitung-karte"
    />
  );
}
