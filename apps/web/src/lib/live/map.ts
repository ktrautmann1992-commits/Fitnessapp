/**
 * Karte der Begleit-Seite: dieselbe Lösung wie die Strecken-Karte der App (apps/mobile/src/lib/route-map-html.ts –
 * Abgleich in map.test.ts): maplibre-gl fest versioniert mit Prüfsumme (SRI) vom CDN jsDelivr, Kacheln von
 * OpenFreeMap (ohne Schlüssel, ohne Cookies), Attribution „© OpenStreetMap-Mitwirkende“ immer sichtbar. Gezeigt wird
 * EIN Punkt mit Genauigkeitskreis – keine Linie, keine Spur.
 */

export const MAPLIBRE_VERSION = '5.6.0';
export const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
export const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
export const MAPLIBRE_JS_SRI =
  'sha384-GfxBM9x46BaAFxtCq39Fxir8fNZ4VDnwgfi6Kzi5/F1tAFsm0amuuV8kd+Pxzuf/';
export const MAPLIBRE_CSS_SRI =
  'sha384-Nq6PQ+9vJPvw7U/VfDELyrWoGQMsy0gi6QShhaSrGzkpF5KkM40csg2leky+YMTd';
export const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_ATTRIBUTION = '© OpenStreetMap-Mitwirkende';
/** Nach so vielen ms ohne fertige Karte → „Karte lädt nicht“ (Texte bleiben sichtbar). */
export const MAP_TIMEOUT_MS = 15_000;

/** Kreis (Genauigkeit) als GeoJSON-Ring: `steps` Punkte, Radius in Metern (mindestens 5 m sichtbar). */
export function accuracyRing(
  lat: number,
  lon: number,
  radiusM: number | null,
  steps = 48,
): [number, number][] {
  const r = Math.max(5, Math.min(5000, radiusM ?? 0));
  const dLat = r / 111_320;
  const dLon = r / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([
      Number((lon + dLon * Math.cos(a)).toFixed(6)),
      Number((lat + dLat * Math.sin(a)).toFixed(6)),
    ]);
  }
  return ring;
}
