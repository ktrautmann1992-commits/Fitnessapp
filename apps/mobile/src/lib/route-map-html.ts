import { type LatLng, boundingBox } from '@fitnessapp/core';
import { brandColors } from '@fitnessapp/ui';

/**
 * Karte einer gespeicherten Strecke (Etappe E3-Entscheidung, docs/PLAN-EINKAUFEN-AUSDAUER.md 5): maplibre-gl in einer
 * WebView (iPhone/Android) bzw. einem abgeschotteten iframe (Browser) – KEIN natives Karten-Modul, damit der EAS-Build
 * mit Expo SDK 57 / neuer Architektur sicher bleibt. Kacheln in der Testphase von OpenFreeMap (kostenlos, ohne
 * Schlüssel, docs/PLAN-PHASE-10.md 11.1), Attribution „© OpenStreetMap-Mitwirkende“ immer sichtbar. Die Bibliothek
 * kommt fest versioniert mit Prüfsumme (SRI) vom CDN jsDelivr. Ins HTML gelangen NUR Zahlen (Koordinaten der
 * gespeicherten, vereinfachten Linie) – kein Name, keine Notiz. Jede Kachel-Anfrage verrät dem Kartenanbieter den
 * Ausschnitt (Datenschutzerklärung, vor Livegang eigener Kachel-Server, Plan 11.1).
 */

export const MAPLIBRE_VERSION = '5.6.0';
export const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
export const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
/** SRI-Prüfsummen der Dateien aus dem npm-Paket maplibre-gl@5.6.0 (jsDelivr liefert sie unverändert aus). */
export const MAPLIBRE_JS_SRI =
  'sha384-GfxBM9x46BaAFxtCq39Fxir8fNZ4VDnwgfi6Kzi5/F1tAFsm0amuuV8kd+Pxzuf/';
export const MAPLIBRE_CSS_SRI =
  'sha384-Nq6PQ+9vJPvw7U/VfDELyrWoGQMsy0gi6QShhaSrGzkpF5KkM40csg2leky+YMTd';
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_ATTRIBUTION = '© OpenStreetMap-Mitwirkende';
/** Nach so vielen ms ohne fertige Karte → „Karte lädt nicht“ (Zahlen bleiben sichtbar). */
export const MAP_TIMEOUT_MS = 15_000;

/** Nachricht aus der Karte an die App. */
export type MapMessage = 'loaded' | 'failed';

export function isMapMessage(value: unknown): value is MapMessage {
  return value === 'loaded' || value === 'failed';
}

const num = (n: number) => (Number.isFinite(n) ? Number(n.toFixed(6)) : 0);

/** HTML der Karte; null bei weniger als 2 gültigen Punkten. */
export function routeMapHtml(points: readonly LatLng[], label: string): string | null {
  const valid = points.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180,
  );
  const bbox = boundingBox(valid);
  if (valid.length < 2 || !bbox) return null;
  const [south, west, north, east] = bbox;
  // Nur Zahlen ins Skript (JSON) – nichts, was als HTML/Skript gelesen werden könnte.
  const coords = JSON.stringify(valid.map((p) => [num(p.lng), num(p.lat)]));
  const bounds = JSON.stringify([
    [num(west), num(south)],
    [num(east), num(north)],
  ]);
  const safeLabel = label.replace(/[<>&"']/g, '');
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
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
      else if (window.parent) window.parent.postMessage({ alpha5Map: message }, '*');
    } catch (e) {}
  }
  function finish(message) { if (!done) { done = true; post(message); } }
  setTimeout(function () { finish('failed'); }, ${MAP_TIMEOUT_MS});
  try {
    if (!window.maplibregl) { finish('failed'); return; }
    var coords = ${coords};
    var map = new maplibregl.Map({
      container: 'map',
      style: '${OPENFREEMAP_STYLE}',
      bounds: ${bounds},
      fitBoundsOptions: { padding: 32, maxZoom: 16 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: '${MAP_ATTRIBUTION}' }));
    map.on('load', function () {
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 8 } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '${brandColors.blau}', 'line-width': 5 } });
      map.addSource('ends', { type: 'geojson', data: { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: coords[0] } },
        { type: 'Feature', properties: { kind: 'finish' }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } }
      ] } });
      map.addLayer({ id: 'ends', type: 'circle', source: 'ends', paint: {
        'circle-radius': 7, 'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF',
        'circle-color': ['match', ['get', 'kind'], 'start', '#1E9E5A', '${brandColors.schwarz}']
      } });
      finish('loaded');
    });
    map.on('error', function () { if (!map.loaded()) finish('failed'); });
  } catch (e) { finish('failed'); }
})();
</script>
</body></html>`;
}
