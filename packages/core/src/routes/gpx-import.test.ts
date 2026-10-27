import { describe, expect, it } from 'vitest';

import { GPX_IMPORT, ROUTE_ELEVATION_PROFILE } from '../constants';
import { hikingTimeEstimate } from '../hiking/time';
import { toGpx } from './gpx';
import {
  decodeXmlText,
  gpxElevationProfile,
  importGpx,
  parseGpx,
  summarizeGpxPoints,
} from './gpx-import';
import { decodePolyline } from './polyline';

/** Gerade Linie nach Norden: `n` Punkte im Abstand von ca. `stepM` Metern, Höhe über `ele(i)`. */
function line(n: number, stepM: number, ele: (i: number) => number | null = () => null) {
  const dLat = stepM / 111_195;
  return Array.from({ length: n }, (_, i) => ({ lat: 47 + i * dLat, lng: 11, ele: ele(i) }));
}

function gpx(body: string, head = '<?xml version="1.0" encoding="UTF-8"?>') {
  return `${head}\n<gpx version="1.1" creator="Test" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
}

function trk(points: readonly { lat: number; lng: number; ele: number | null }[], name = 'Tour') {
  return gpx(
    `<trk><name>${name}</name><trkseg>${points
      .map((p) =>
        p.ele === null
          ? `<trkpt lat="${p.lat}" lon="${p.lng}"/>`
          : `<trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.ele}</ele><time>2026-10-01T08:00:00Z</time></trkpt>`,
      )
      .join('')}</trkseg></trk>`,
  );
}

describe('parseGpx', () => {
  it('liest Spurpunkte mit Höhe und den Namen der Spur', () => {
    const result = parseGpx(
      trk(
        line(3, 100, (i) => 500 + i),
        'Zum See &amp; zurück',
      ),
    );
    expect(result).toEqual({
      ok: true,
      name: 'Zum See & zurück',
      points: line(3, 100, (i) => 500 + i),
      skipped: 0,
    });
  });

  it('Routenpunkte (rtept), wenn keine Spur da ist; Name aus der Route, CDATA und Zeichen-Codes', () => {
    const xml = gpx(
      `<rte><name><![CDATA[Höhenweg]]> &#8211; Etappe&#x20;2</name><rtept lat='47.1' lon='11.2'><ele>1200.5</ele></rtept><rtept lat="47.11" lon="11.2"/></rte>`,
    );
    const result = parseGpx(xml);
    expect(result.ok && result.name).toBe('Höhenweg – Etappe 2');
    expect(result.ok && result.points).toEqual([
      { lat: 47.1, lng: 11.2, ele: 1200.5 },
      { lat: 47.11, lng: 11.2, ele: null },
    ]);
  });

  it('Namensraum-Präfix und Großschreibung, Kommentare werden ignoriert', () => {
    const xml =
      '<gpx:GPX xmlns:gpx="http://www.topografix.com/GPX/1/1"><!-- <trkpt lat="1" lon="1"/> --><gpx:trk><gpx:trkseg>' +
      '<gpx:trkpt lat="47" lon="11"><gpx:ele>10</gpx:ele></gpx:trkpt><gpx:trkpt lon="11" lat="47.001"/></gpx:trkseg></gpx:trk></gpx:GPX>';
    const result = parseGpx(xml);
    expect(result.ok && result.points.length).toBe(2);
    expect(result.ok && result.points[0]).toEqual({ lat: 47, lng: 11, ele: 10 });
    expect(result.ok && result.name).toBeNull();
  });

  it('Name aus den Metadaten; Steuerzeichen und Leerraum werden bereinigt; lange Namen gekürzt', () => {
    const long = 'A'.repeat(GPX_IMPORT.nameMaxLength + 20);
    const xml = gpx(
      `<metadata><name>  ${long}\u0007 </name></metadata><trk><trkseg><trkpt lat="47" lon="11"/><trkpt lat="47.01" lon="11"/></trkseg></trk>`,
    );
    const result = parseGpx(xml);
    expect(result.ok && result.name).toBe('A'.repeat(GPX_IMPORT.nameMaxLength));
  });

  it('ungültige Koordinaten werden übersprungen und gezählt; unplausible Höhen werden null', () => {
    const xml = gpx(
      '<trk><trkseg><trkpt lat="91" lon="11"/><trkpt lat="abc" lon="11"/><trkpt lat="47" lon="11"><ele>99999</ele></trkpt><trkpt lat="47.01" lon="11"><ele>-20</ele></trkpt></trkseg></trk>',
    );
    const result = parseGpx(xml);
    expect(result).toEqual({
      ok: true,
      name: null,
      points: [
        { lat: 47, lng: 11, ele: null },
        { lat: 47.01, lng: 11, ele: -20 },
      ],
      skipped: 2,
    });
  });

  it('Fehler: keine GPX-Datei, keine Punkte, zu wenige gültige Punkte, zu groß', () => {
    expect(parseGpx('{"type":"FeatureCollection"}')).toEqual({ ok: false, error: 'not_gpx' });
    expect(parseGpx(gpx('<wpt lat="47" lon="11"/>'))).toEqual({ ok: false, error: 'no_points' });
    expect(parseGpx(gpx('<trk><trkseg><trkpt lat="47" lon="11"/></trkseg></trk>'))).toEqual({
      ok: false,
      error: 'invalid_points',
    });
    expect(parseGpx(gpx('<trk><trkseg><trkpt lat="x" lon="y"/></trkseg></trk>'))).toEqual({
      ok: false,
      error: 'invalid_points',
    });
    expect(parseGpx('x'.repeat(GPX_IMPORT.maxFileChars + 1))).toEqual({
      ok: false,
      error: 'too_large',
    });
    const many = gpx(
      `<trk><trkseg>${'<trkpt lat="47" lon="11"/>'.repeat(GPX_IMPORT.maxRawPoints + 1)}</trkseg></trk>`,
    );
    expect(parseGpx(many)).toEqual({ ok: false, error: 'too_large' });
  });

  it('liest die eigene GPX-Datei der App (Export → Import) wieder ein', () => {
    const points = line(5, 200, (i) => 300 + i * 10).map((p) => ({ ...p, ele: p.ele }));
    const xml = toGpx({ name: 'Runde <1>', sport: 'walk', startedAt: null, points });
    const result = parseGpx(xml);
    expect(result.ok && result.name).toBe('Runde <1>');
    expect(result.ok && result.points.length).toBe(5);
  });
});

describe('decodeXmlText', () => {
  it('entfernt Tags im Text und unbekannte Codes bleiben stehen', () => {
    expect(decodeXmlText('<b>Weg</b> &unknown; &#0;')).toBe('Weg &unknown;');
  });
});

describe('summarizeGpxPoints', () => {
  it('Bergtour: Distanz, Anstieg, Abstieg, höchster Punkt, Profil, Gehzeit danach berechenbar', () => {
    // 10 km, 500 m hinauf und wieder hinunter (Punkte alle 50 m).
    const points = line(201, 50, (i) => 1000 + (i <= 100 ? i * 5 : (200 - i) * 5));
    const result = summarizeGpxPoints(points, 'Gipfel');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.distanceM).toBeGreaterThan(9_990);
    expect(result.distanceM).toBeLessThanOrEqual(10_000);
    expect(result.ascentM).toBeGreaterThan(480);
    expect(result.ascentM).toBeLessThanOrEqual(500);
    expect(result.descentM).toBeGreaterThan(480);
    expect(result.maxAltitudeM).toBeGreaterThan(1480);
    expect(result.maxAltitudeM).toBeLessThanOrEqual(1500);
    expect(result.elevationProfile.length).toBeGreaterThan(2);
    expect(result.elevationProfile.length).toBeLessThanOrEqual(ROUTE_ELEVATION_PROFILE.maxPoints);
    // Gerade Linie → stark vereinfacht, Anfang und Ende bleiben.
    const decoded = decodePolyline(result.polyline);
    expect(decoded?.length).toBe(result.pointCount);
    expect(result.pointCount).toBeLessThanOrEqual(GPX_IMPORT.maxStoredPoints);
    const time = hikingTimeEstimate({
      distanceM: result.distanceM,
      gainM: result.ascentM,
      lossM: result.descentM,
    });
    // 10 km ÷ 4 = 150 min; 500/300 + 500/500 h = 160 min → 160 + 75 = 235 → gerundet 235.
    expect(time?.minutes).toBeGreaterThanOrEqual(225);
    expect(time?.minutes).toBeLessThanOrEqual(240);
  });

  it('ohne Höhen: keine Höhenwerte, kein Profil', () => {
    const result = summarizeGpxPoints(line(20, 100), null);
    expect(result.ok && [result.ascentM, result.descentM, result.maxAltitudeM]).toEqual([
      null,
      null,
      null,
    ]);
    expect(result.ok && result.elevationProfile).toEqual([]);
  });

  it('Grenzen: zu kurz, zu lang, Sprung (kaputte Koordinaten), zu wenige Punkte', () => {
    expect(summarizeGpxPoints(line(2, 50), null)).toEqual({ ok: false, error: 'too_short' });
    expect(summarizeGpxPoints(line(2, GPX_IMPORT.minDistanceM + 1), null).ok).toBe(true);
    expect(summarizeGpxPoints(line(9, 40_000), null)).toEqual({ ok: false, error: 'too_long' });
    expect(
      summarizeGpxPoints(
        [
          { lat: 47, lng: 11, ele: null },
          { lat: 0, lng: 0, ele: null },
        ],
        null,
      ),
    ).toEqual({ ok: false, error: 'invalid_points' });
    expect(summarizeGpxPoints([{ lat: 47, lng: 11, ele: null }], null)).toEqual({
      ok: false,
      error: 'invalid_points',
    });
  });

  it('sehr viele Punkte: Linie höchstens maxStoredPoints, Profil höchstens 300 Stützpunkte', () => {
    // Zickzack, damit die Vereinfachung nicht alles wegnimmt.
    const points = Array.from({ length: 20_000 }, (_, i) => ({
      lat: 47 + i * 0.0001,
      lng: 11 + (i % 2) * 0.0001,
      ele: 500 + (i % 50),
    }));
    const result = summarizeGpxPoints(points, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pointCount).toBeLessThanOrEqual(GPX_IMPORT.maxStoredPoints);
    expect(result.elevationProfile.length).toBe(ROUTE_ELEVATION_PROFILE.maxPoints);
  });
});

describe('importGpx', () => {
  it('Datei → Strecke; Fehler aus dem Lesen werden durchgereicht', () => {
    const ok = importGpx(trk(line(30, 100, (i) => 400 + i)));
    expect(ok.ok && ok.name).toBe('Tour');
    expect(ok.ok && ok.distanceM).toBeGreaterThan(2_800);
    expect(importGpx('kein xml')).toEqual({ ok: false, error: 'not_gpx' });
  });

  it('Profil steigt nie in der Distanz zurück', () => {
    const profile = gpxElevationProfile(line(50, 30, (i) => 100 + i));
    for (let i = 1; i < profile.length; i += 1) {
      expect((profile[i] as [number, number])[0]).toBeGreaterThanOrEqual(
        (profile[i - 1] as [number, number])[0],
      );
    }
  });
});
