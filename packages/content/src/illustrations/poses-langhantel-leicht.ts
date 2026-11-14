import { barbellEnd, step } from './equipment';
import type { ExerciseIllustration } from './poses';
import type { Limb, PoseSpec, Prop, SidePose } from './rig';

/**
 * Ausgangspositionen der Übungen für die Langhantel-Gruppenworkouts „Barbell Burn“ (Gründer-Auftrag 14.11.2026,
 * docs/PLAN-BARBELL-BURN.md): leichte Langhantel OHNE Rack (die Stange wird über den Kopf auf die Schultern gehoben),
 * flaches Stepbrett zum Liegen, Crunch. Gleiche Figur und Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026):
 * Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben. Endpositionen in poses-end.ts.
 */

const LEGS = { near: [-88, -91, 0] as Limb, far: [-93, -89, 0] as Limb };

function stand(arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    near: { arm: arms.near, leg: LEGS.near },
    far: { arm: arms.far, leg: LEGS.far },
    props,
  };
}

/** Stand mit leicht gebeugten Knien (Kreuzheben-Ausgangsposition). */
function standSoftKnees(arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    head: 90,
    near: { arm: arms.near, leg: [-80, -96, 0] },
    far: { arm: arms.far, leg: [-83, -94, 0] },
    props,
  };
}

/** Rückenlage auf dem flachen Stepbrett (Kopf rechts), Knie gebeugt, Füße flach am Boden. */
function onStep(arms: { near: SidePose['arm']; far: SidePose['arm'] }, props: Prop[]): PoseSpec {
  return {
    view: 'side',
    torso: 0,
    head: 0,
    pelvis: [0, 24],
    near: { arm: arms.near, leg: { ik: [-34, 3.5], bend: 'up', end: 180 } },
    far: { arm: arms.far, leg: { ik: [-36, 3.5], bend: 'up', end: 180 } },
    props: [step(-20, 62, 14), ...props],
  };
}

/** Langhantel auf dem oberen Rücken (Hände greifen die Stange neben den Schultern). */
const armsBackSquat = { near: [-125, 72, 80] as Limb, far: [-128, 70, 80] as Limb };
const barOnBack = barbellEnd({ j: 'neck', dx: -6, dy: -5 });
/** Langhantel vor den Oberschenkeln an gestreckten Armen. */
const armsBarThighs = { near: [-82, -86, -88] as Limb, far: [-85, -88, -88] as Limb };
const barAtWrist = barbellEnd({ j: 'nearWrist', dy: -1 });
/** Langhantel auf den vorderen Schultern (Ellbogen vorn). */
const armsFrontRack = { near: [-70, 100, 100] as Limb, far: [-73, 98, 100] as Limb };

export const LIGHT_BARBELL_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  'aufwaerm-kombi-langhantel': {
    pose: standSoftKnees(armsBarThighs, barAtWrist),
    alt: 'Ausgangsposition: aufrecht stehen, Knie locker, leichte Langhantel mit gestreckten Armen vor den Oberschenkeln, Füße hüftbreit.',
  },
  'kniebeuge-langhantel-leicht': {
    pose: stand(armsBackSquat, barOnBack),
    alt: 'Ausgangsposition: aufrecht stehen, leichte Langhantel auf dem oberen Rücken, Hände greifen die Stange, Füße etwas weiter als hüftbreit.',
  },
  'bankdruecken-step-langhantel': {
    pose: onStep({ near: [90, 90, 90], far: [91, 90, 90] }, barbellEnd({ j: 'nearWrist', dy: 1 })),
    alt: 'Ausgangsposition: auf einem flachen Stepbrett liegen, Füße am Boden, leichte Langhantel mit gestreckten Armen über der Brust.',
  },
  'umsetzen-druecken-langhantel-leicht': {
    pose: standSoftKnees(armsBarThighs, barAtWrist),
    alt: 'Ausgangsposition: hüftbreit stehen, Knie locker, leichte Langhantel im Obergriff mit gestreckten Armen vor den Oberschenkeln.',
  },
  'stirndruecken-langhantel': {
    pose: onStep({ near: [90, 90, 90], far: [91, 90, 90] }, barbellEnd({ j: 'nearWrist', dy: 1 })),
    alt: 'Ausgangsposition: auf einem flachen Stepbrett liegen, Füße am Boden, leichte Langhantel mit schmalem Griff und gestreckten Armen über der Brust.',
  },
  'bizepscurl-langhantel': {
    pose: stand(
      { near: [-88, -88, -88], far: [-93, -92, -90] },
      barbellEnd({ j: 'nearWrist', dy: 1 }),
    ),
    alt: 'Ausgangsposition: aufrecht stehen, Langhantel im Untergriff an gestreckten Armen vor den Oberschenkeln.',
  },
  'ausfallschritt-rueckwaerts-langhantel': {
    pose: stand(armsBackSquat, barOnBack),
    alt: 'Ausgangsposition: aufrecht stehen, leichte Langhantel auf dem oberen Rücken, Füße hüftbreit.',
  },
  'schulterdruecken-langhantel-leicht': {
    pose: stand(armsFrontRack, barbellEnd({ j: 'nearWrist', dx: 1, dy: 3 })),
    alt: 'Ausgangsposition: aufrecht stehen, leichte Langhantel liegt auf den vorderen Schultern, Griff etwas weiter als schulterbreit, Füße hüftbreit.',
  },
  crunch: {
    pose: {
      view: 'side',
      torso: 0,
      head: 4,
      pelvis: [0, 10],
      // Hände an den Schläfen, Ellbogen zeigen zur Seite – von der Seite verkürzt (armScale).
      near: {
        arm: [70, -10, -10],
        armScale: [0.5, 0.5],
        leg: { ik: [-30, 3.5], bend: 'up', end: 180 },
      },
      far: {
        arm: [72, -8, -10],
        armScale: [0.5, 0.5],
        leg: { ik: [-32, 3.5], bend: 'up', end: 180 },
      },
    },
    alt: 'Ausgangsposition: Rückenlage am Boden, Knie gebeugt, Füße aufgestellt, Fingerspitzen locker an den Schläfen.',
  },
};
