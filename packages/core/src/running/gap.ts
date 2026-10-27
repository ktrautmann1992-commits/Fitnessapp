import { GAP_MINETTI } from '../constants';
import type { PaceSegment } from '../routes/run-insights';

/**
 * Bergbereinigtes Tempo (GAP, Lauf-Paket 2, docs/PLAN-LAUF-PAKET-2.md 5): Wie schnell wäre der Lauf bei gleicher
 * Anstrengung auf flacher Strecke gewesen? Grundlage ist das gespeicherte Höhenprofil [Distanz m, Höhe dm] und die
 * Energiekosten-Kurve von Minetti (GAP_MINETTI). Nur Laufen; ohne Profil kein GAP. Rein, deterministisch.
 */

/** Energiekosten des Laufens in J/(kg·m) bei Steigung `grade` (Anteil, begrenzt auf ±GAP_MINETTI.maxGrade). */
export function runningEnergyCost(grade: number): number {
  const g = Math.max(
    -GAP_MINETTI.maxGrade,
    Math.min(GAP_MINETTI.maxGrade, Number.isFinite(grade) ? grade : 0),
  );
  // Horner-Schema über die Koeffizienten (höchste Potenz zuerst).
  return GAP_MINETTI.coefficients.reduce((acc, c) => acc * g + c, 0);
}

/** Faktor gegenüber flach: C(i) / C(0) (> 1 bergauf, < 1 leicht bergab). */
export function gradeCostFactor(grade: number): number {
  return runningEnergyCost(grade) / runningEnergyCost(0);
}

/** Ein Stück des Profils mit gleichmäßiger Steigung. */
interface GradePiece {
  readonly fromM: number;
  readonly toM: number;
  readonly grade: number;
}

/** Profil in Stücke von mind. GAP_MINETTI.minSegmentM Metern zerlegen (der Rest geht ins letzte Stück). */
export function gradePieces(
  profile: readonly (readonly number[])[] | null | undefined,
): GradePiece[] {
  const pts = (profile ?? []).filter(
    (p): p is [number, number] => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (pts.length < 2) return [];
  const pieces: { fromM: number; toM: number; fromH: number; toH: number }[] = [];
  let anchor = pts[0] as [number, number];
  for (let i = 1; i < pts.length; i += 1) {
    const p = pts[i] as [number, number];
    if (p[0] - anchor[0] >= GAP_MINETTI.minSegmentM) {
      pieces.push({ fromM: anchor[0], toM: p[0], fromH: anchor[1] / 10, toH: p[1] / 10 });
      anchor = p;
    }
  }
  const last = pts.at(-1) as [number, number];
  if (last[0] > anchor[0]) {
    const prev = pieces.at(-1);
    if (prev) {
      prev.toM = last[0];
      prev.toH = last[1] / 10;
    } else {
      pieces.push({ fromM: anchor[0], toM: last[0], fromH: anchor[1] / 10, toH: last[1] / 10 });
    }
  }
  return pieces
    .filter((p) => p.toM > p.fromM)
    .map((p) => ({ fromM: p.fromM, toM: p.toM, grade: (p.toH - p.fromH) / (p.toM - p.fromM) }));
}

/**
 * „Flache“ Meter zwischen `fromM` und `toM`: Σ Teilstück × C(i)/C(0). Teile ohne Profil zählen flach (Faktor 1);
 * `covered` = Anteil mit Profil.
 */
function equivalentFlatM(
  pieces: readonly GradePiece[],
  fromM: number,
  toM: number,
): { flatM: number; covered: number } {
  let flat = 0;
  let covered = 0;
  for (const p of pieces) {
    const a = Math.max(fromM, p.fromM);
    const b = Math.min(toM, p.toM);
    if (b > a) {
      flat += (b - a) * gradeCostFactor(p.grade);
      covered += b - a;
    }
  }
  const length = toM - fromM;
  return { flatM: flat + (length - covered), covered: length > 0 ? covered / length : 0 };
}

export interface GapResult {
  /** Bergbereinigte Ø-Pace in s/km. */
  readonly gapS: number;
  /** Tatsächliche Ø-Pace in s/km. */
  readonly paceS: number;
  /** GAP je Abschnitt (gleiche Reihenfolge wie die Abschnitte; null = Abschnitt ohne Profil). */
  readonly perSegment: readonly (number | null)[];
}

/**
 * GAP eines Laufs: Bewegungszeit ÷ flache Distanz (Profil auf die Bewegungsdistanz bezogen). null ohne Profil, unter
 * GAP_MINETTI.minDistanceM oder wenn weniger als die Hälfte der Strecke ein Profil hat.
 */
export function gradeAdjustedPace(input: {
  readonly distanceM: number;
  readonly movingS: number;
  readonly profile: readonly (readonly number[])[] | null | undefined;
  readonly segments?: readonly PaceSegment[];
}): GapResult | null {
  const { distanceM, movingS } = input;
  if (!(Number.isFinite(distanceM) && distanceM >= GAP_MINETTI.minDistanceM)) return null;
  if (!(Number.isFinite(movingS) && movingS > 0)) return null;
  const pieces = gradePieces(input.profile);
  if (pieces.length === 0) return null;
  const total = equivalentFlatM(pieces, 0, distanceM);
  if (total.covered < 0.5 || total.flatM <= 0) return null;
  const perSegment = (input.segments ?? []).map((s) => {
    const part = equivalentFlatM(pieces, s.fromM, s.toM);
    if (part.covered < 0.5 || part.flatM <= 0) return null;
    const seconds = (s.secondsPerKm * (s.toM - s.fromM)) / 1000;
    return Math.round((seconds / part.flatM) * 1000);
  });
  return {
    gapS: Math.round((movingS / total.flatM) * 1000),
    paceS: Math.round((movingS / distanceM) * 1000),
    perSegment,
  };
}
