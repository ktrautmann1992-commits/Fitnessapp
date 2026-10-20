import type { LatLng } from './polyline';

/**
 * Linien-Skizze einer Strecke ohne Kartenkacheln (Etappe E4 „Meine Läufe“, Story-Bild E6): Punkte flach projiziert
 * (Längengrade × cos(mittlere Breite), fortlaufend über ±180°), seitentreu in einen Rahmen eingepasst und mittig
 * gesetzt. Für die Anzeige auf höchstens `maxPoints` Punkte ausgedünnt (Anfang und Ende bleiben). Rein.
 */

export interface SketchPoint {
  readonly x: number;
  readonly y: number;
}

export interface SketchBox {
  readonly width: number;
  readonly height: number;
  /** Rand in derselben Einheit. */
  readonly padding: number;
  /** Höchstens so viele Punkte (Standard 600). */
  readonly maxPoints?: number;
}

function thin<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max || max < 2) return [...items];
  return Array.from(
    { length: max },
    (_, k) => items[Math.round((k * (items.length - 1)) / (max - 1))] as T,
  );
}

/** Projizierte Punkte im Rahmen; [] bei weniger als 2 gültigen Punkten. */
export function sketchPoints(points: readonly LatLng[], box: SketchBox): SketchPoint[] {
  const valid = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90,
  );
  if (valid.length < 2) return [];
  const used = thin(valid, box.maxPoints ?? 600);
  const meanLat = used.reduce((sum, p) => sum + p.lat, 0) / used.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xs: number[] = [];
  const ys: number[] = [];
  let lng = (used[0] as LatLng).lng;
  used.forEach((p, i) => {
    if (i > 0) {
      let d = p.lng - (used[i - 1] as LatLng).lng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lng += d;
    }
    xs.push(lng * k);
    ys.push(-p.lat);
  });
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const innerW = Math.max(0, box.width - 2 * box.padding);
  const innerH = Math.max(0, box.height - 2 * box.padding);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale =
    spanX === 0 && spanY === 0
      ? 0
      : Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const offX = box.padding + (innerW - spanX * scale) / 2;
  const offY = box.padding + (innerH - spanY * scale) / 2;
  return xs.map((x, i) => ({
    x: offX + (x - minX) * scale,
    y: offY + ((ys[i] as number) - minY) * scale,
  }));
}

/** SVG-Pfad („M x y L x y …“, eine Nachkommastelle); '' ohne Linie. */
export function sketchPath(points: readonly SketchPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}
