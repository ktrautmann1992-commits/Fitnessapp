import { barbellEnd, handle, rack, step } from './equipment';
import type { ExerciseIllustration } from './poses';
import type { Limb, PoseSpec, Prop } from './rig';

/**
 * Ausgangspositionen der Übungen für Workouts im WOD-Stil (docs/PLAN-WORKOUTS.md W-O6): Box-Sprung, Seilspringen,
 * Double-Unders, Thruster mit Langhantel. Gleiche Figur und Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026):
 * Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben. Box als einfacher Kasten, Springseil als Linie.
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

const armsDown = { near: [-86, -88] as Limb, far: [-95, -93] as Limb };
/** Oberarme am Körper, Unterarme leicht nach vorn-unten: Griffe des Springseils auf Hüfthöhe. */
const armsRope = { near: [-80, -40] as Limb, far: [-84, -44] as Limb };
const armsFrontRack = { near: [-70, 100, 100] as Limb, far: [-73, 98, 100] as Limb };

/** Springseil: von den Griffen hinter dem Körper bis knapp über den Boden hinter den Fersen. */
const rope: Prop[] = [
  handle({ j: 'nearWrist' }),
  {
    t: 'line',
    points: [{ j: 'nearWrist' }, [-2, 66], [-12, 44], [-17, 22], [-16, 7], [-9, 2], [2, 1.5]],
    w: 1.5,
    role: 'equip',
    front: false,
  },
];

export const WOD_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  'box-sprung': {
    pose: stand(armsDown, [step(28, 80, 36)]),
    alt: 'Ausgangsposition: aufrecht etwa eine Fußlänge vor einer stabilen Box stehen, Füße hüftbreit, Arme seitlich am Körper.',
  },
  seilspringen: {
    pose: stand(armsRope, rope),
    alt: 'Ausgangsposition: aufrecht stehen, die Griffe des Springseils locker auf Hüfthöhe, Ellbogen nah am Körper, das Seil liegt hinter den Fersen.',
  },
  'double-unders': {
    pose: stand(armsRope, rope),
    alt: 'Ausgangsposition: aufrecht und locker stehen, die Griffe des Springseils auf Hüfthöhe, das Seil hinter den Fersen – bereit für den ersten Sprung.',
  },
  'thruster-langhantel': {
    pose: stand(armsFrontRack, [
      ...rack(-44, 104),
      ...barbellEnd({ j: 'nearWrist', dx: 1, dy: 3 }),
    ]),
    alt: 'Ausgangsposition: aufrecht stehen, die Langhantel liegt auf den vorderen Schultern, Ellbogen vorn, Füße schulterbreit; dahinter das Rack.',
  },
};
