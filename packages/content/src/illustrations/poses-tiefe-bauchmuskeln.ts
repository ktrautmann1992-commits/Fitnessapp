import type { ExerciseIllustration } from './poses';
import type { PoseSpec, SidePose } from './rig';

/**
 * Ausgangspositionen der Übungen für die tiefe Bauchmuskulatur (Gründer-Auftrag 15.11.2026, Kraft-Ausdauer auf Zeit,
 * docs/PLAN-WORKOUTS.md Abschnitt 10): Bauchatmung und Bauchnabel einziehen, Dead Bug mit gestreckten Beinen,
 * Bärenstand, Schulter-Tippen, Fersen seitlich tippen, Seitstütz mit Hüftheben. Gleiche Figur und Regeln wie poses.ts
 * (Gründer-Entscheidung B, 21.10.2026): Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben. Endpositionen in
 * poses-end.ts.
 */

/** Vierfüßlerstand (wie poses.ts). */
const quadruped: PoseSpec = {
  view: 'side',
  torso: 16,
  head: 16,
  near: { arm: [-90, -90, 0], leg: [-90, 180, 180] },
  far: { arm: [-88, -92, 0], leg: [-92, 180, 180] },
};

/** Bärenstand: wie Vierfüßlerstand, Knie schweben knapp über dem Boden, Zehen aufgestellt. */
const bear: PoseSpec = {
  view: 'side',
  torso: 10,
  head: 8,
  near: { arm: [-90, -90, 0], leg: [-93, -174, -70] },
  far: { arm: [-88, -92, 0], leg: [-95, -173, -70] },
};

/** Hoher Liegestütz (wie poses.ts). */
const pushUp: PoseSpec = {
  view: 'side',
  torso: 20,
  head: 18,
  near: { arm: [-90, -90, 0], leg: [200, 200, -75] },
  far: { arm: [-87, -91, 0], leg: [201, 200, -75] },
};

/** Rückenlage, Kopf rechts, Knie gebeugt, Füße flach am Boden (wie poses.ts). */
function supineKneesBent(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  extra: Partial<PoseSpec> = {},
): PoseSpec {
  return {
    view: 'side',
    torso: 0,
    head: 2,
    pelvis: [0, 10],
    near: { arm: arms.near, leg: { ik: [-30, 3.5], bend: 'up', end: 180 } },
    far: { arm: arms.far, leg: { ik: [-32, 3.5], bend: 'up', end: 180 } },
    ...extra,
  };
}

export const DEEP_CORE_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  'tiefe-bauchatmung-rueckenlage': {
    pose: supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
    alt: 'Ausgangsposition: Rückenlage, Knie gebeugt, Füße hüftbreit aufgestellt, Arme locker neben dem Körper.',
  },
  'bauchnabel-einziehen-vierfuessler': {
    pose: quadruped,
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade, Blick zum Boden.',
  },
  'dead-bug-gestreckt': {
    pose: {
      view: 'side',
      torso: 0,
      head: 2,
      near: { arm: [90, 90, 90], leg: [92, 92, 20] },
      far: { arm: [91, 90, 90], leg: [94, 94, 20] },
    },
    alt: 'Ausgangsposition: Rückenlage, Arme senkrecht nach oben, Beine gestreckt zur Decke, unterer Rücken am Boden.',
  },
  'baerenstand-halten': {
    pose: bear,
    alt: 'Ausgangsposition: Bärenstand – Hände unter den Schultern, Knie unter der Hüfte knapp über dem Boden, Zehen aufgestellt, Rücken gerade.',
  },
  'baerenstand-schulter-tippen': {
    pose: bear,
    alt: 'Ausgangsposition: Bärenstand – Hände unter den Schultern, Knie schweben knapp über dem Boden, Rücken gerade.',
  },
  'stuetz-schulter-tippen': {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände unter den Schultern, Körper vom Kopf bis zu den Fersen gerade.',
  },
  'fersen-tippen-seitlich': {
    pose: supineKneesBent({ near: [192, 186, 186], far: [191, 185, 185] }, { torso: 16, head: 26 }),
    alt: 'Ausgangsposition: Rückenlage, Knie gebeugt, Füße aufgestellt, Kopf und Schultern leicht abgehoben, Arme lang Richtung Füße.',
  },
  'seitstuetz-hueftheben': {
    pose: {
      view: 'front',
      torso: 17,
      head: 17,
      near: { arm: [88, 90, 90], leg: [197, 197, 200] },
      far: { arm: [-90, -62, -40], armScale: [1, 0.3], leg: [197, 197, 200] },
    },
    alt: 'Ausgangsposition: Seitstütz von vorn – Ellbogen unter der Schulter, Beine gestreckt, Hüfte angehoben, Körper vom Kopf bis zu den Füßen gerade, oberer Arm nach oben gestreckt.',
  },
};
