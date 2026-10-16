import { describe, expect, it } from 'vitest';

import { escapeXml, gpxFileName, toGpx } from './gpx';

/**
 * Kleine Prüfung auf wohlgeformtes XML (ohne externe Bibliothek): Tags paarweise geschachtelt, Attribute in
 * Anführungszeichen, nur die fünf vordefinierten Entitäten, kein rohes „<“ oder „&“ im Text.
 */
function assertWellFormed(xml: string): string[] {
  const body = xml.replace(/^<\?xml [^?]*\?>\n/, '');
  const stack: string[] = [];
  const order: string[] = [];
  const token =
    /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<&]*(?:&(?:amp|lt|gt|quot|apos);[^"<&]*)*")*)\s*(\/?)>|([^<]+)/g;
  let consumed = 0;
  for (const m of body.matchAll(token)) {
    if (m.index !== consumed) throw new Error(`ungültig bei ${consumed}`);
    consumed += m[0].length;
    const [, close, name, , selfClose, text] = m;
    if (text !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos);)/.test(text)) throw new Error('rohes &');
      if (stack.length === 0 && text.trim() !== '') throw new Error('Text außerhalb');
      continue;
    }
    if (close) {
      if (stack.pop() !== name) throw new Error(`falsches Ende ${name}`);
    } else {
      order.push(name as string);
      if (!selfClose) stack.push(name as string);
    }
  }
  if (consumed !== body.length) throw new Error('Rest nicht lesbar');
  if (stack.length !== 0) throw new Error('nicht geschlossen');
  return order;
}

const base = {
  name: 'Runde am Rhein',
  sport: 'run' as const,
  startedAt: '2026-10-16T07:00:00Z',
  points: [
    { lat: 50.9413, lng: 6.9583, ele: 53.25 },
    { lat: 50.94135, lng: 6.95831, ele: null },
    { lat: 50.9414, lng: 6.9584 },
  ],
};

describe('toGpx', () => {
  it('GPX 1.1: Namensraum, Version, Reihenfolge der Elemente laut Schema (metadata, trk: name, desc, type, trkseg)', () => {
    const xml = toGpx({ ...base, note: 'locker' });
    expect(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Alpha5" xmlns="http://www.topografix.com/GPX/1/1"',
      ),
    ).toBe(true);
    const order = assertWellFormed(xml);
    expect(order.slice(0, 8)).toEqual([
      'gpx',
      'metadata',
      'name',
      'time',
      'trk',
      'name',
      'desc',
      'type',
    ]);
    expect(order.filter((t) => t === 'trkpt')).toHaveLength(3);
    expect(xml).toContain('<trkpt lat="50.9413" lon="6.9583"><ele>53.3</ele></trkpt>');
    expect(xml).toContain('<trkpt lat="50.94135" lon="6.95831"/>');
    expect(xml).toContain('<type>running</type>');
  });

  it('Name und Notiz sauber escaped; unerlaubte Steuerzeichen entfernt', () => {
    const xml = toGpx({
      ...base,
      name: `<Tom & "Jerry's"> Runde\u0000\u0007`,
      note: ']]> <!-- & -->',
    });
    assertWellFormed(xml);
    expect(xml).toContain('<name>&lt;Tom &amp; &quot;Jerry&apos;s&quot;&gt; Runde</name>');
    expect(xml).toContain('<desc>]]&gt; &lt;!-- &amp; --&gt;</desc>');
    expect(xml).not.toContain('\u0000');
  });

  it('0, 1, 2 Punkte; ohne Beginn keine Zeit; Punkte mit Zeit', () => {
    for (const n of [0, 1, 2]) {
      const xml = toGpx({ ...base, startedAt: null, points: base.points.slice(0, n) });
      const order = assertWellFormed(xml);
      expect(order.filter((t) => t === 'trkpt')).toHaveLength(n);
      expect(order).not.toContain('time');
    }
    const timed = toGpx({
      ...base,
      points: [{ lat: 1, lng: 2, ele: 3, time: '2026-10-16T07:00:01Z' }],
    });
    expect(timed).toContain(
      '<trkpt lat="1" lon="2"><ele>3</ele><time>2026-10-16T07:00:01Z</time></trkpt>',
    );
  });

  it('Rad/Gehen: passende Art; Zahlen ohne Exponent', () => {
    expect(toGpx({ ...base, sport: 'bike' })).toContain('<type>cycling</type>');
    expect(toGpx({ ...base, sport: 'walk' })).toContain('<type>walking</type>');
    const tiny = toGpx({ ...base, points: [{ lat: 0.0000001, lng: -0.0000004 }] });
    expect(tiny).toContain('<trkpt lat="0" lon="0"/>');
    expect(tiny).not.toMatch(/e-/);
  });

  it('escapeXml: alle fünf Zeichen, einzelne Ersatzzeichen (Surrogates) entfernt', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
    expect(escapeXml('a\ud800b')).toBe('ab');
    expect(escapeXml('🏃')).toBe('🏃');
  });

  it('Dateiname ohne Namen oder Ort der Strecke', () => {
    expect(gpxFileName('2026-10-16')).toBe('alpha5-strecke-2026-10-16.gpx');
  });

  it('Wächter S1 N4: NaN/Infinity/außerhalb des Bereichs übersprungen, Höhe unplausibel weggelassen, nie Exponent', () => {
    const xml = toGpx({
      ...base,
      points: [
        { lat: Number.NaN, lng: 6.9 },
        { lat: 50, lng: Number.POSITIVE_INFINITY },
        { lat: 91, lng: 6.9 },
        { lat: 50, lng: -180.5 },
        { lat: 50.9, lng: 6.9, ele: 1e21 },
        { lat: -0.0000001, lng: 179.9999999, ele: Number.NaN },
        { lat: 1e-7, lng: 2, ele: -12.25 },
      ],
    });
    const order = assertWellFormed(xml);
    expect(order.filter((t) => t === 'trkpt')).toHaveLength(3);
    expect(xml).not.toMatch(/NaN|Infinity|e\+|e-/);
    expect(xml).toContain('<trkpt lat="50.9" lon="6.9"/>');
    expect(xml).toContain('<trkpt lat="0" lon="180"/>');
    expect(xml).toContain('<trkpt lat="0" lon="2"><ele>-12.3</ele></trkpt>');
  });
});
