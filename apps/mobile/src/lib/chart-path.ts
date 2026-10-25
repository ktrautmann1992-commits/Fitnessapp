/**
 * Pfade für Diagramme (gemeinsam für Lauf-Auswertung und Kraft-Entwicklung, damit die Kurven gleich aussehen).
 * Nur Geometrie, keine Fachlogik.
 */
export type Pt = { x: number; y: number };

/** Glatte Kurve ohne Überschwingen (monotone kubische Interpolation nach Fritsch–Carlson). */
export function monotonePath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  const f = (v: number) => v.toFixed(1);
  const p = (i: number) => pts[i] as Pt;
  if (n === 2) return `M${f(p(0).x)} ${f(p(0).y)}L${f(p(1).x)} ${f(p(1).y)}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const d = Math.max(1e-6, p(i + 1).x - p(i).x);
    dx.push(d);
    m.push((p(i + 1).y - p(i).y) / d);
  }
  const tan: number[] = [m[0] as number];
  for (let i = 1; i < n - 1; i += 1) {
    const a = m[i - 1] as number;
    const b = m[i] as number;
    tan.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  tan.push(m[n - 2] as number);
  for (let i = 0; i < n - 1; i += 1) {
    const mi = m[i] as number;
    if (mi === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = (tan[i] as number) / mi;
    const b = (tan[i + 1] as number) / mi;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tan[i] = k * a * mi;
      tan[i + 1] = k * b * mi;
    }
  }
  let d = `M${f(p(0).x)} ${f(p(0).y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = (dx[i] as number) / 3;
    d += `C${f(p(i).x + h)} ${f(p(i).y + (tan[i] as number) * h)} ${f(p(i + 1).x - h)} ${f(
      p(i + 1).y - (tan[i + 1] as number) * h,
    )} ${f(p(i + 1).x)} ${f(p(i + 1).y)}`;
  }
  return d;
}
