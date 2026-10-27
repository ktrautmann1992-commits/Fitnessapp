import { handle } from './equipment';
import type { ExerciseIllustration } from './poses';
import type { PoseSpec, Prop } from './rig';

/**
 * Indoor-Rudern (Sportarten Stufe 1 · Etappe R, docs/PLAN-SPORTARTEN-STUFE-1.md 2.3, Entwürfe): Ausgangsposition am
 * Rudergerät („Auslage“ – Knie gebeugt, Schienbeine fast senkrecht, Arme lang nach vorn zum Griff). Gleiche Figur und
 * Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026): Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben.
 */

/** Rudergerät von der Seite: Schiene, Sitz, Stemmbrett, Schwungrad-Gehäuse und Kette zum Griff. */
function rowingMachine(): Prop[] {
  return [
    // Schiene (flach über dem Boden) und Füße der Schiene
    {
      t: 'line',
      points: [
        [-40, 8],
        [118, 8],
      ],
      w: 5,
      role: 'furnitureLine',
    },
    { t: 'rect', at: [-42, 0], w: 6, h: 8, r: 1.5, role: 'furnitureLine' },
    // Sitz (Rollsitz unter dem Becken)
    { t: 'rect', at: [-14, 12], w: 28, h: 6, r: 3, role: 'furnitureLine' },
    // Stemmbrett schräg vor den Füßen
    {
      t: 'line',
      points: [
        [70, 8],
        [76, 30],
      ],
      w: 5,
      role: 'furnitureLine',
    },
    // Schwungrad-Gehäuse vorn
    { t: 'rect', at: [96, 0], w: 26, h: 44, r: 8, role: 'furniture' },
    { t: 'circle', at: [109, 30], r: 4, role: 'furnitureLine' },
    // Kette vom Gehäuse zum Griff
    { t: 'line', points: [[96, 34], { j: 'nearWrist' }], w: 1.8, role: 'equip', front: true },
    handle({ j: 'nearWrist' }),
  ];
}

const catchPose: PoseSpec = {
  view: 'side',
  torso: 75,
  head: 80,
  pelvis: [0, 21.5],
  near: {
    arm: { ik: [50, 40], bend: 'down', end: -10 },
    leg: { ik: [64, 18], bend: 'up', end: 80 },
  },
  far: {
    arm: { ik: [49, 40], bend: 'down', end: -10 },
    leg: { ik: [62, 18], bend: 'up', end: 80 },
  },
  props: rowingMachine(),
};

export const ROWING_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  rudergeraet: {
    pose: catchPose,
    alt: 'Ausgangsposition: auf dem Rollsitz des Rudergeräts sitzen, Füße im Stemmbrett, Knie gebeugt, Oberkörper leicht nach vorn geneigt, Griff mit langen Armen fassen.',
  },
  'rudergeraet-locker': {
    pose: catchPose,
    alt: 'Ausgangsposition: locker auf dem Rollsitz des Rudergeräts sitzen, Füße im Stemmbrett, Knie gebeugt, Griff mit langen Armen und lockeren Händen fassen.',
  },
};
