import { boundingBox, type LatLng } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';

import {
  MAP_ATTRIBUTION,
  MAP_TIMEOUT_MS,
  MAPLIBRE_CSS,
  MAPLIBRE_CSS_SRI,
  MAPLIBRE_JS,
  MAPLIBRE_JS_SRI,
  OPENFREEMAP_STYLE,
} from './route-map-html';

/**
 * Karte des Rundkurs-Vorschlags (docs/PLAN-RUNDKURS.md): wie route-map-html.ts (maplibre-gl in WebView bzw.
 * abgeschottetem iframe, Kacheln OpenFreeMap, Attribution immer sichtbar), aber mit MEHREREN Runden – die gewählte
 * kräftig in ihrer Farbe, die anderen dünn und grau – und dem Startpunkt. Optional „Startpunkt antippen“: ein Tipp auf
 * die Karte schickt die Stelle an die App (`{ pick: [lat, lng] }`). Ins HTML gelangen NUR Zahlen und geprüfte Farben.
 * Attribution zusätzlich „Routing: openrouteservice.org“ (Nutzungsbedingungen von ORS).
 */

/** Farben der Runden A, B, C (gut unterscheidbar, auch für Rot-Grün-Schwäche: Blau, Orange, Violett). */
export const LOOP_COLORS = ['#1F5BFF', '#EA580C', '#7A3FD1'] as const;
export const LOOP_ROUTING_ATTRIBUTION = 'Routing: openrouteservice.org';

export type LoopMapMessage =
  | { readonly kind: 'loaded' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'pick'; readonly point: LatLng };

/** Nachricht der Karte prüfen (aus iframe-postMessage bzw. WebView-Text). */
export function parseLoopMapMessage(value: unknown): LoopMapMessage | null {
  let v = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (typeof v !== 'object' || v === null) return null;
  const m = (v as { alpha5Loop?: unknown }).alpha5Loop;
  if (m === 'loaded' || m === 'failed') return { kind: m };
  if (typeof m === 'object' && m !== null) {
    const pick = (m as { pick?: unknown }).pick;
    if (
      Array.isArray(pick) &&
      pick.length === 2 &&
      typeof pick[0] === 'number' &&
      typeof pick[1] === 'number' &&
      Math.abs(pick[0]) <= 90 &&
      Math.abs(pick[1]) <= 180
    ) {
      return { kind: 'pick', point: { lat: pick[0], lng: pick[1] } };
    }
  }
  return null;
}

const num = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(6)) : 0);
const valid = (p: LatLng) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export interface LoopMapLine {
  readonly points: readonly LatLng[];
  readonly color: string;
}

/**
 * HTML der Karte. `lines`: Runden (Reihenfolge = Zeichenreihenfolge), `selected`: Index der gewählten (oben, kräftig);
 * `start`: Startpunkt; `pickable`: Tipp setzt den Startpunkt. Ohne Linien zeigt die Karte den Start (Zoom 14) –
 * ohne Start und Linien null.
 */
export function loopMapHtml(input: {
  lines: readonly LoopMapLine[];
  selected: number | null;
  start: LatLng | null;
  pickable: boolean;
  label: string;
}): string | null {
  const lines = input.lines
    .map((l) => ({
      color: HEX.test(l.color) ? l.color : brandColors.blau,
      points: l.points.filter(valid),
    }))
    .filter((l) => l.points.length >= 2);
  const start = input.start && valid(input.start) ? input.start : null;
  const all = [...lines.flatMap((l) => l.points), ...(start ? [start] : [])];
  const bbox = boundingBox(all);
  if (!bbox) return null;
  const [south, west, north, east] = bbox;
  const features = lines.map((l, i) => ({
    type: 'Feature',
    properties: { color: l.color, sel: i === input.selected ? 1 : 0 },
    geometry: { type: 'LineString', coordinates: l.points.map((p) => [num(p.lng), num(p.lat)]) },
  }));
  // Gewählte Runde zuletzt zeichnen (oben).
  features.sort((a, b) => a.properties.sel - b.properties.sel);
  const data = JSON.stringify({ type: 'FeatureCollection', features });
  const startJson = JSON.stringify(start ? [num(start.lng), num(start.lat)] : null);
  const view =
    lines.length > 0
      ? `bounds: ${JSON.stringify([
          [num(west), num(south)],
          [num(east), num(north)],
        ])}, fitBoundsOptions: { padding: { top: 28, right: 28, bottom: 64, left: 28 }, maxZoom: 16 }`
      : `center: ${startJson}, zoom: 14`;
  const safeLabel = input.label.replace(/[<>&"']/g, '');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${MAPLIBRE_CSS}" integrity="${MAPLIBRE_CSS_SRI}" crossorigin="anonymous">
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${brandColors.eisblau}}</style>
</head><body>
<div id="map" role="img" aria-label="${safeLabel}"></div>
<script src="${MAPLIBRE_JS}" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"></script>
<script>
(function () {
  var done = false;
  function post(message) {
    try {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ alpha5Loop: message }));
      else if (window.parent) window.parent.postMessage({ alpha5Loop: message }, '*');
    } catch (e) {}
  }
  function finish(message) { if (!done) { done = true; post(message); } }
  setTimeout(function () { finish('failed'); }, ${MAP_TIMEOUT_MS});
  try {
    if (!window.maplibregl) { finish('failed'); return; }
    var data = ${data};
    var start = ${startJson};
    var map = new maplibregl.Map({
      container: 'map',
      style: '${OPENFREEMAP_STYLE}',
      ${view},
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: '${MAP_ATTRIBUTION} · ${LOOP_ROUTING_ATTRIBUTION}' }));
    map.on('load', function () {
      map.addSource('loops', { type: 'geojson', data: data });
      map.addLayer({ id: 'casing', type: 'line', source: 'loops', filter: ['==', ['get', 'sel'], 1], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 9 } });
      map.addLayer({ id: 'loops', type: 'line', source: 'loops', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
        'line-color': ['case', ['==', ['get', 'sel'], 1], ['get', 'color'], '${brandColors.grau}'],
        'line-width': ['case', ['==', ['get', 'sel'], 1], 5, 3],
        'line-opacity': ['case', ['==', ['get', 'sel'], 1], 1, 0.55]
      } });
      if (start) {
        map.addSource('start', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: start } } });
        map.addLayer({ id: 'start', type: 'circle', source: 'start', paint: { 'circle-radius': 8, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF', 'circle-color': '#1E9E5A' } });
      }
      finish('loaded');
    });
    ${
      input.pickable
        ? `map.on('click', function (e) { post({ pick: [Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6))] }); });`
        : ''
    }
    map.on('error', function () { if (!map.loaded()) finish('failed'); });
  } catch (e) { finish('failed'); }
})();
</script>
</body></html>`;
}
