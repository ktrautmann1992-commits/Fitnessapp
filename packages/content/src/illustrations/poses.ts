import {
  backWall,
  band,
  barbellEnd,
  bench,
  benchEnd,
  cableTower,
  chair,
  dumbbellEnd,
  dumbbellSide,
  handle,
  kettlebell,
  mat,
  pullUpBar,
  rack,
  sofa,
  step,
  table,
  wall,
} from './equipment';
import { CALISTHENICS_ILLUSTRATIONS } from './poses-calisthenics';
import type { Limb, PoseSpec, Prop, SidePose } from './rig';

/**
 * Gelenkwinkel je Übung: Ausgangsposition (Gründer-Entscheidung B, 21.10.2026). Jede Übung aus content/exercises hat
 * genau einen Eintrag (Test in illustrations.test.ts). Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben
 * (siehe rig.ts). `alt` ist der deutsche Alternativtext und beschreibt genau, was das Bild zeigt.
 *
 * Bei Halteübungen (Unterarmstütz, Seitstütz, Glute-Bridge-Halten) zeigt das Bild die gehaltene Position.
 */
export interface ExerciseIllustration {
  readonly pose: PoseSpec;
  readonly alt: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Grundhaltungen
// ---------------------------------------------------------------------------------------------------------------

const legsStand: Pick<PoseSpec, 'near' | 'far'> = {
  near: { arm: [-86, -88], leg: [-88, -91, 0] },
  far: { arm: [-95, -93], leg: [-93, -89, 0] },
};

function stand(
  arms: { near: Limb; far: Limb } = { near: [-86, -88], far: [-95, -93] },
  props: Prop[] = [],
  extra: Partial<PoseSpec> = {},
): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    near: { arm: arms.near, leg: legsStand.near.leg },
    far: { arm: arms.far, leg: legsStand.far.leg },
    props,
    ...extra,
  };
}

/** Stand mit leicht gebeugten Knien (Kreuzheben, Good Morning). */
function standSoftKnees(arms: { near: Limb; far: Limb }, props: Prop[] = [], torso = 90): PoseSpec {
  return {
    view: 'side',
    torso,
    head: torso,
    near: { arm: arms.near, leg: [-80, -96, 0] },
    far: { arm: arms.far, leg: [-83, -94, 0] },
    props,
  };
}

/** Vorgebeugt mit geradem Rücken (Rudern, Reverse Fly). */
function hinge(torso: number, arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso,
    head: torso + 5,
    near: { arm: arms.near, leg: [-68, -98, 0] },
    far: { arm: arms.far, leg: [-71, -96, 0] },
    props,
  };
}

/** Hoher Liegestütz (Hände unter den Schultern, Körper gerade, Zehen aufgestellt). */
const pushUp: PoseSpec = {
  view: 'side',
  torso: 20,
  head: 18,
  near: { arm: [-90, -90, 0], leg: [200, 200, -75] },
  far: { arm: [-87, -91, 0], leg: [201, 200, -75] },
};

/** Vierfüßlerstand. */
const quadruped: PoseSpec = {
  view: 'side',
  torso: 16,
  head: 16,
  near: { arm: [-90, -90, 0], leg: [-90, 180, 180] },
  far: { arm: [-88, -92, 0], leg: [-92, 180, 180] },
};

/** Aufrecht kniend (Oberschenkel senkrecht, Schienbeine am Boden). */
function kneel(arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    near: { arm: arms.near, leg: [-90, 180, 180] },
    far: { arm: arms.far, leg: [-92, 180, 180] },
    props,
  };
}

/** Rückenlage, Kopf rechts, Knie gebeugt, Füße flach am Boden. */
function supineKneesBent(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  props: Prop[] = [],
): PoseSpec {
  return {
    view: 'side',
    torso: 0,
    head: 2,
    pelvis: [0, 10],
    near: { arm: arms.near, leg: { ik: [-30, 3.5], bend: 'up', end: 180 } },
    far: { arm: arms.far, leg: { ik: [-32, 3.5], bend: 'up', end: 180 } },
    props,
  };
}

/** Vorderansicht stehend. */
function front(
  arms: { near: Limb; far: Limb },
  props: Prop[] = [],
  legs?: { near: Limb; far: Limb },
): PoseSpec {
  return {
    view: 'front',
    torso: 90,
    near: { arm: arms.near, leg: legs?.near ?? [-90, -90] },
    far: { arm: arms.far, leg: legs?.far ?? [-90, -90] },
    props,
  };
}

const armsDown = { near: [-86, -88] as Limb, far: [-95, -93] as Limb };
const armsForward = { near: [0, 0, 0] as Limb, far: [-3, -2, -2] as Limb };
const armsAtShoulders = { near: [-75, 92, 92] as Limb, far: [-78, 95, 95] as Limb };
const armsAcrossChest = { near: [-80, 75, 90] as Limb, far: [-84, 70, 90] as Limb };

/** Kurzhanteln im Profil (neutraler Griff) an beiden Händen. */
const dumbbellsAtSides = [
  ...dumbbellSide({ j: 'nearWrist', dy: -1 }, 0),
  ...dumbbellSide({ j: 'farWrist', dy: -1 }, 0, false),
];
/** Kurzhanteln von der Stirnseite (Handflächen nach vorn bzw. zum Boden). */
const dumbbellsEnd = [
  ...dumbbellEnd({ j: 'nearWrist', dy: 1 }),
  ...dumbbellEnd({ j: 'farWrist', dy: 1 }, false),
];

// ---------------------------------------------------------------------------------------------------------------
// Übungen
// ---------------------------------------------------------------------------------------------------------------

export const EXERCISE_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  // --- Liegestütz-Varianten ---------------------------------------------------------------------------------------
  'archer-liegestuetz': {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände deutlich weiter als schulterbreit, Körper vom Kopf bis zu den Fersen gerade.',
  },
  liegestuetz: {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Hände unter den Schultern, Körper vom Kopf bis zu den Fersen gerade.',
  },
  'trizeps-liegestuetz-eng': {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz von der Seite, Hände knapp schulterbreit unter der Brust, Arme gestreckt, Körper gerade.',
  },
  'liegestuetz-erhoeht': {
    pose: {
      view: 'side',
      torso: 50,
      head: 48,
      pelvis: [0, 62.8],
      near: { arm: { ik: [54, 60], bend: 'down', end: 0 }, leg: [230, 230, -60] },
      far: { arm: { ik: [53, 60], bend: 'down', end: 0 }, leg: [231, 229, -60] },
      props: table(50, 112, 55),
    },
    alt: 'Ausgangsposition: Hände auf einer Tischkante, Arme gestreckt, Füße hinten am Boden, Körper bildet eine gerade, schräge Linie.',
  },
  'liegestuetz-fuesse-erhoeht': {
    pose: {
      view: 'side',
      torso: 2,
      head: 0,
      pelvis: [0, 47.5],
      near: { arm: [-90, -90, 0], leg: [182, 182, -75] },
      far: { arm: [-88, -91, 0], leg: [182, 183, -75] },
      props: chair(-80, 1, 29.5, 28),
    },
    alt: 'Ausgangsposition: Liegestütz mit den Füßen auf einem Stuhl, Hände unter den Schultern am Boden, Arme gestreckt, Körper gerade.',
  },
  'pike-liegestuetz': {
    pose: {
      view: 'side',
      torso: -45,
      head: -60,
      near: { arm: [-65, -65, 0], leg: [-112, -112, -35] },
      far: { arm: [-63, -66, 0], leg: [-110, -113, -35] },
    },
    alt: 'Ausgangsposition: umgedrehtes V – Hände schulterbreit am Boden, Arme gestreckt, Hüfte hoch, Beine gestreckt, Kopf zwischen den Armen.',
  },
  'dips-stuhl': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [-8, 46],
      near: {
        arm: { ik: [-14, 37], bend: 'back', end: 0 },
        leg: { ik: [36, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [-15, 37], bend: 'back', end: 0 },
        leg: { ik: [34, 3.5], bend: 'up', end: 0 },
      },
      props: [wall(-52, 6), ...chair(-46, 1, 31, 30)],
    },
    alt: 'Ausgangsposition: Hände auf der vorderen Sitzkante eines Stuhls an der Wand, Arme gestreckt, Gesäß vor dem Stuhl, Knie gebeugt, Füße am Boden.',
  },

  // --- Kniebeugen und Ausfallschritte -----------------------------------------------------------------------------
  'kniebeuge-koerpergewicht': {
    pose: stand(armsForward),
    alt: 'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Arme waagerecht nach vorn gestreckt.',
  },
  'kniebeuge-pause': {
    pose: stand(armsForward),
    alt: 'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Zehen leicht nach außen, Arme nach vorn gestreckt.',
  },
  'kniebeuge-tempo': {
    pose: stand(armsForward),
    alt: 'Ausgangsposition: aufrecht stehen, Füße etwa schulterbreit, Zehen leicht nach außen, Arme nach vorn gestreckt.',
  },
  'kniebeuge-stuhl': {
    pose: stand(armsForward, chair(-42, 1, 33, 28)),
    alt: 'Ausgangsposition: aufrecht vor einem Stuhl stehen, der Stuhl steht hinter dir, Füße schulterbreit, Arme nach vorn gestreckt.',
  },
  'kniebeuge-langhantel': {
    pose: stand({ near: [-125, 72, 80], far: [-128, 70, 80] }, [
      ...rack(-46, 100),
      ...barbellEnd({ j: 'neck', dx: -6, dy: -5 }),
    ]),
    alt: 'Ausgangsposition: aufrecht stehen, Langhantel liegt auf dem oberen Rücken, Hände greifen die Stange, Füße schulterbreit; dahinter das Rack.',
  },
  'goblet-kniebeuge': {
    pose: stand(
      { near: [-70, 85, 90], far: [-74, 82, 90] },
      dumbbellSide({ j: 'nearWrist', dx: 2, dy: -6 }, 90),
    ),
    alt: 'Ausgangsposition: aufrecht stehen, eine Kurzhantel senkrecht dicht vor der Brust halten, Ellbogen zeigen nach unten, Füße etwas weiter als hüftbreit.',
  },
  'ausfallschritt-rueckwaerts-kurzhantel': {
    pose: stand(armsDown, dumbbellsAtSides),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kurzhantel seitlich an den gestreckten Armen.',
  },
  'split-kniebeuge': {
    pose: {
      view: 'side',
      torso: 90,
      pelvis: [0, 64],
      near: { arm: [-86, -88], leg: { ik: [26, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [-95, -93], leg: { ik: [-30, 9], bend: 'fwd', end: -40 } },
    },
    alt: 'Ausgangsposition: große Schrittstellung, vorderer Fuß flach, hinterer Fuß auf dem Ballen, Oberkörper aufrecht.',
  },
  'bulgarische-split-kniebeuge': {
    pose: {
      view: 'side',
      torso: 90,
      pelvis: [0, 60],
      near: { arm: [-88, -89], leg: { ik: [30, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [-93, -92], leg: { ik: [-40, 36.5], bend: 'down', end: 185 } },
      props: [...bench(-100, -32, 32), ...dumbbellsAtSides],
    },
    alt: 'Ausgangsposition: vor einer Flachbank stehen, Spann des hinteren Fußes liegt auf der Bank, vorderer Fuß weit vorn, je eine Kurzhantel seitlich.',
  },
  'bulgarische-split-kniebeuge-stuhl': {
    pose: {
      view: 'side',
      torso: 90,
      pelvis: [0, 60],
      near: { arm: [-86, -88], leg: { ik: [28, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [-60, -70], leg: { ik: [-46, 38], bend: 'down', end: 185 } },
      props: [backWall(-84, 40), ...chair(-76, 1, 33, 28)],
    },
    alt: 'Ausgangsposition: seitlich nah an einer Wand stehen, eine Hand an der Wand, Fußrücken des hinteren Beins auf der Stuhlsitzfläche, vorderer Fuß weit vorn.',
  },
  'step-up-stufe': {
    pose: {
      view: 'side',
      torso: 88,
      pelvis: [0, 67],
      near: {
        arm: { ik: [30, 84], bend: 'down', end: 10 },
        leg: { ik: [24, 16.75], bend: 'fwd', end: 0 },
      },
      far: { arm: [-95, -93], leg: { ik: [-4, 3.5], bend: 'fwd', end: 0 } },
      props: [
        step(14, 120, 14),
        step(46, 120, 28),
        {
          t: 'line',
          points: [
            [16, 0],
            [16, 82],
            [118, 108],
          ],
          w: 3.5,
          role: 'furnitureLine',
        },
      ],
    },
    alt: 'Ausgangsposition: vor der untersten Treppenstufe stehen, ein Fuß komplett auf der Stufe, eine Hand am Geländer.',
  },

  // --- Hüfte und Beinrückseite ------------------------------------------------------------------------------------
  'rumaenisches-kreuzheben-langhantel': {
    pose: standSoftKnees(
      { near: [-82, -86, -88], far: [-85, -88, -88] },
      barbellEnd({ j: 'nearWrist', dy: -1 }),
    ),
    alt: 'Ausgangsposition: aufrecht stehen, Knie leicht gebeugt, Langhantel mit gestreckten Armen vor den Oberschenkeln, Füße hüftbreit.',
  },
  'rumaenisches-kreuzheben-kurzhantel': {
    pose: standSoftKnees({ near: [-82, -86, -88], far: [-85, -88, -88] }, dumbbellsEnd),
    alt: 'Ausgangsposition: aufrecht stehen, Knie leicht gebeugt, je eine Kurzhantel vor den Oberschenkeln, Füße hüftbreit.',
  },
  'good-morning-koerpergewicht': {
    pose: standSoftKnees(armsAcrossChest),
    alt: 'Ausgangsposition: hüftbreit stehen, Knie leicht gebeugt, Hände vor der Brust gekreuzt, Rücken gerade.',
  },
  'good-morning-band': {
    pose: standSoftKnees(armsAcrossChest, [
      band([{ j: 'nearToe', dx: -5, dy: -2 }, { j: 'nearWrist' }, { j: 'neck', dx: -6, dy: -4 }]),
    ]),
    alt: 'Ausgangsposition: hüftbreit auf dem Widerstandsband stehen, Schlaufe hinter dem Nacken auf den Schultern, Hände halten das Band vor der Brust, Knie leicht gebeugt.',
  },
  'rdl-einbeinig-koerpergewicht': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-86, -88], leg: [-84, -94, 0] },
      far: { arm: [-60, -70], leg: [-100, -112, -20] },
      props: [backWall(-50, 50)],
    },
    alt: 'Ausgangsposition: auf einem Bein stehen, Knie leicht gebeugt, das freie Bein knapp über dem Boden, eine Hand an der Wand neben dir.',
  },
  'kettlebell-swing': {
    pose: {
      view: 'side',
      torso: 38,
      head: 32,
      pelvis: [-14, 57],
      near: {
        arm: { ik: [31, 25], bend: 'down', end: -70 },
        leg: { ik: [0, 3.5], bend: 'fwd', end: 0 },
      },
      far: {
        arm: { ik: [30, 25], bend: 'down', end: -70 },
        leg: { ik: [-3, 3.5], bend: 'fwd', end: 0 },
      },
      props: kettlebell([32, 0]),
    },
    alt: 'Ausgangsposition: Hüfte nach hinten geschoben, Rücken gerade, beide Hände greifen die Kettlebell, die etwa 30 cm vor den Füßen am Boden steht.',
  },
  'glute-bridge': {
    pose: supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
    alt: 'Ausgangsposition: Rückenlage, Knie gebeugt, Füße hüftbreit nah am Gesäß, Arme seitlich am Körper abgelegt.',
  },
  'glute-bridge-einbeinig': {
    pose: {
      ...supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
      near: { arm: [182, 180, 180], leg: [148, 148, 60] },
    },
    alt: 'Ausgangsposition: Rückenlage, ein Fuß nah am Gesäß aufgestellt, das andere Bein gestreckt angehoben, Arme seitlich abgelegt.',
  },
  'hip-thrust-langhantel': {
    pose: {
      view: 'side',
      torso: 152,
      head: 115,
      pelvis: [0, 14],
      near: {
        arm: { ik: [3, 25], bend: 'up', end: 0 },
        leg: { ik: [34, 3.5], bend: 'up', end: 0 },
      },
      far: { arm: { ik: [2, 25], bend: 'up', end: 0 }, leg: { ik: [31, 3.5], bend: 'up', end: 0 } },
      props: [...benchEnd(-64, 32, 28), ...barbellEnd([3, 25])],
    },
    alt: 'Ausgangsposition: mit dem Rücken vor einer Flachbank sitzen, Schulterblätter an der Bankkante, Langhantel über der Hüfte, Füße hüftbreit aufgestellt.',
  },
  'hip-thrust-sofa': {
    pose: {
      view: 'side',
      torso: 152,
      head: 115,
      pelvis: [0, 14],
      near: {
        arm: { ik: [-8, 5], bend: 'up', end: 0 },
        leg: { ik: [34, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [-10, 5], bend: 'up', end: 0 },
        leg: { ik: [31, 3.5], bend: 'up', end: 0 },
      },
      props: sofa(-92, 1, 30, 58),
    },
    alt: 'Ausgangsposition: mit dem Rücken vor einem Sofa sitzen, Schulterblätter an der Sitzkante, Knie gebeugt, Füße hüftbreit aufgestellt.',
  },
  'hueftstrecken-vierfuessler': {
    pose: quadruped,
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
  },
  'nordic-curl-assistiert': {
    pose: kneel({ near: [-80, 60, 80], far: [-84, 58, 80] }, [
      mat(-10, 12, 3),
      ...sofa(-86, 1, 36, 70, 12),
    ]),
    alt: 'Ausgangsposition: aufrecht auf einer weichen Unterlage knien, Fersen unter einem schweren Sofa verankert, Körper vom Knie bis zum Kopf gerade, Hände vor der Brust.',
  },

  // --- Beinbeuger und Beinstrecker --------------------------------------------------------------------------------
  'beinbeuger-band': {
    pose: {
      view: 'side',
      torso: 2,
      head: 14,
      near: { arm: [-20, 0, 0], leg: [182, 180, 200] },
      far: { arm: [-24, 4, 0], leg: [181, 181, 200] },
      props: [
        {
          t: 'line',
          points: [
            [-104, 0],
            [-104, 44],
          ],
          w: 4,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            [-130, 44],
            [-100, 44],
          ],
          w: 6,
          role: 'furnitureLine',
        },
        band([{ j: 'nearAnkle' }, [-102, 6]]),
      ],
    },
    alt: 'Ausgangsposition: Bauchlage, Beine gestreckt, Kopf auf den Unterarmen, Widerstandsband um ein Fußgelenk, am Tischbein hinter den Füßen befestigt.',
  },
  'beinbeuger-handtuch': {
    pose: {
      view: 'side',
      torso: -27,
      head: 0,
      pelvis: [0, 28],
      near: { arm: [190, 180, 180], leg: { ik: [-24, 6], bend: 'up', end: 100 } },
      far: { arm: [189, 180, 180], leg: { ik: [-26, 6], bend: 'up', end: 100 } },
      props: [mat(-38, -12, 3)],
    },
    alt: 'Ausgangsposition: Rückenlage, Becken angehoben, sodass Schultern, Hüfte und Knie eine Linie bilden, Fersen auf einem gefalteten Handtuch.',
  },
  'beinbeuger-maschine': {
    pose: {
      view: 'side',
      torso: 100,
      pelvis: [0, 42],
      near: { arm: { ik: [16, 46], bend: 'back', end: -40 }, leg: [0, -12, 78] },
      far: { arm: { ik: [15, 46], bend: 'back', end: -40 }, leg: [1, -13, 78] },
      props: [
        { t: 'rect', at: [-6, 0], w: 22, h: 30, role: 'furniture' },
        { t: 'rect', at: [-16, 30], w: 46, h: 6, r: 3, role: 'furnitureLine' },
        {
          t: 'line',
          points: [
            [-18, 38],
            [-28, 96],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        {
          t: 'circle',
          at: { j: 'nearKnee', dx: -6, dy: 10 },
          r: 6,
          role: 'furnitureLine',
          front: true,
        },
        {
          t: 'line',
          points: [
            { j: 'nearKnee', dx: 2 },
            { j: 'nearAnkle', dy: -8 },
          ],
          w: 3,
          role: 'equip',
          front: true,
        },
        { t: 'circle', at: { j: 'nearAnkle', dy: -9 }, r: 5, role: 'furnitureLine', front: true },
        handle({ j: 'nearWrist' }),
      ],
    },
    alt: 'Ausgangsposition: an der Beinbeuger-Maschine sitzen, Beine gestreckt, Polster über den Oberschenkeln und hinter den Fersen, Hände an den Griffen.',
  },
  'beinstrecker-band': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 41],
      near: {
        arm: { ik: [4, 38], bend: 'back', end: -90 },
        leg: { ik: [33, 9], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [3, 38], bend: 'back', end: -90 },
        leg: { ik: [31, 9], bend: 'up', end: 0 },
      },
      props: [...chair(-22, 1, 33, 28), band([{ j: 'nearAnkle' }, [6, 6]])],
    },
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, Knie im rechten Winkel, Widerstandsband vom Fußgelenk zum Stuhlbein, Hände halten sich seitlich fest.',
  },
  beinstrecker: {
    pose: {
      view: 'side',
      torso: 98,
      pelvis: [0, 42],
      near: {
        arm: { ik: [12, 40], bend: 'back', end: -60 },
        leg: { ik: [34, 14], bend: 'up', end: 10 },
      },
      far: {
        arm: { ik: [11, 40], bend: 'back', end: -60 },
        leg: { ik: [32, 14], bend: 'up', end: 10 },
      },
      props: [
        { t: 'rect', at: [-6, 0], w: 22, h: 30, role: 'furniture' },
        { t: 'rect', at: [-16, 30], w: 46, h: 6, r: 3, role: 'furnitureLine' },
        {
          t: 'line',
          points: [
            [-16, 40],
            [-24, 96],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            { j: 'nearKnee', dx: 2 },
            { j: 'nearAnkle', dx: 8, dy: 2 },
          ],
          w: 3,
          role: 'equip',
          front: true,
        },
        {
          t: 'circle',
          at: { j: 'nearAnkle', dx: 9, dy: 3 },
          r: 5,
          role: 'furnitureLine',
          front: true,
        },
        handle({ j: 'nearWrist' }),
      ],
    },
    alt: 'Ausgangsposition: an der Beinstrecker-Maschine sitzen, Knie gebeugt, Fußpolster vorn knapp über den Fußgelenken, Hände an den Griffen.',
  },
  beinpresse: {
    pose: {
      view: 'side',
      torso: 135,
      head: 128,
      pelvis: [0, 30],
      near: { arm: { ik: [8, 24], bend: 'down', end: 0 }, leg: [38, 46, 136] },
      far: { arm: { ik: [7, 24], bend: 'down', end: 0 }, leg: [39, 47, 136] },
      props: [
        { t: 'rect', at: [-30, 0], w: 50, h: 18, r: 2, role: 'furniture' },
        {
          t: 'line',
          points: [
            [-6, 20],
            [-40, 54],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            [10, 0],
            [92, 82],
          ],
          w: 5,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            { j: 'nearAnkle', dx: -12, dy: 6 },
            { j: 'nearAnkle', dx: 6, dy: -14 },
          ],
          w: 6,
          role: 'equip',
          front: false,
        },
        handle({ j: 'nearWrist' }),
      ],
    },
    alt: 'Ausgangsposition: in der Beinpresse liegen, Rücken und Gesäß am Polster, Füße hüftbreit auf der Plattform, Beine fast gestreckt.',
  },

  // --- Waden --------------------------------------------------------------------------------------------------------
  'wadenheben-koerpergewicht': {
    pose: stand({ near: [-12, 2, 80], far: [-80, -88] }, [step(0, 46, 12), wall(48, 8)], {
      rest: 12,
    }),
    alt: 'Ausgangsposition: mit den Fußballen auf einer Stufe stehen, Fersen frei, eine Hand an der Wand vor dir.',
  },
  'wadenheben-einbeinig': {
    pose: {
      view: 'side',
      torso: 90,
      rest: 12,
      near: { arm: [-12, 2, 80], leg: [-89, -90, 0] },
      far: { arm: [-80, -88], leg: [-98, -165, -150] },
      props: [step(0, 46, 12), wall(48, 8)],
    },
    alt: 'Ausgangsposition: auf einem Bein mit dem Fußballen auf einer Stufe stehen, das andere Bein angewinkelt, eine Hand an der Wand.',
  },
  'wadenheben-kurzhantel': {
    pose: stand(
      { near: [-88, -89], far: [-12, 2, 80] },
      [step(0, 46, 12), wall(48, 8), ...dumbbellSide({ j: 'nearWrist', dy: -1 }, 0)],
      { rest: 12 },
    ),
    alt: 'Ausgangsposition: mit den Fußballen auf einer Stufe stehen, eine Kurzhantel seitlich in einer Hand, die andere Hand an der Wand.',
  },

  // --- Rücken: Rudern, Ziehen -------------------------------------------------------------------------------------
  langhantelrudern: {
    pose: hinge(
      45,
      { near: [-90, -90, -90], far: [-92, -91, -90] },
      barbellEnd({ j: 'nearWrist', dy: -2 }),
    ),
    alt: 'Ausgangsposition: Oberkörper etwa 45 Grad vorgebeugt, Rücken gerade, Knie leicht gebeugt, Langhantel hängt an gestreckten Armen.',
  },
  'vorgebeugtes-rudern-kurzhantel': {
    pose: hinge(45, { near: [-90, -90, -90], far: [-92, -91, -90] }, [
      ...dumbbellSide({ j: 'nearWrist', dy: -2 }, 0),
      ...dumbbellSide({ j: 'farWrist', dy: -2 }, 0, false),
    ]),
    alt: 'Ausgangsposition: Oberkörper etwa 45 Grad vorgebeugt, Rücken gerade, Knie leicht gebeugt, je eine Kurzhantel an gestreckten Armen.',
  },
  'kurzhantelrudern-einarmig': {
    pose: {
      view: 'side',
      torso: 16,
      head: 10,
      pelvis: [0, 70.5],
      near: { arm: [-90, -90, -90], leg: { ik: [8, 3.5], bend: 'fwd', end: 0 } },
      far: {
        arm: { ik: [37, 37.5], bend: 'back', end: 0 },
        leg: { ik: [-34, 36.5], bend: 'down', end: 180 },
      },
      props: [...bench(-50, 52, 32), ...dumbbellSide({ j: 'nearWrist', dy: -2 }, 0)],
    },
    alt: 'Ausgangsposition: eine Hand und ein Knie auf der Flachbank, der andere Fuß am Boden, Rücken gerade, Kurzhantel hängt am gestreckten Arm unter der Schulter.',
  },
  'reverse-fly-kurzhantel': {
    pose: hinge(25, { near: [-96, -80, -85], far: [-98, -82, -85] }, [
      ...dumbbellSide({ j: 'nearWrist', dy: -2 }, 0),
      ...dumbbellSide({ j: 'farWrist', dy: -2 }, 0, false),
    ]),
    alt: 'Ausgangsposition: Oberkörper mit geradem Rücken weit vorgebeugt, Knie gebeugt, Arme hängen leicht gebeugt unter den Schultern, je eine leichte Kurzhantel.',
  },
  'y-t-w-vorgebeugt': {
    pose: hinge(30, { near: [-94, -86, -88], far: [-96, -88, -88] }),
    alt: 'Ausgangsposition: hüftbreit stehen, Knie leicht gebeugt, Oberkörper mit geradem Rücken vorgeneigt, Arme hängen locker nach unten.',
  },
  'rudern-band': {
    pose: stand({ near: [-4, -3, -3], far: [-6, -4, -4] }, [
      wall(76, 7),
      band([{ j: 'nearWrist' }, [76, 98]]),
    ]),
    alt: 'Ausgangsposition: aufrecht stehen, Arme auf Brusthöhe nach vorn gestreckt, Widerstandsband an einem Türanker vor dir befestigt.',
  },
  kabelrudern: {
    pose: {
      view: 'side',
      torso: 90,
      pelvis: [0, 21.5],
      near: {
        arm: { ik: [42, 46], bend: 'down', end: -10 },
        leg: { ik: [52, 18], bend: 'up', end: 80 },
      },
      far: {
        arm: { ik: [41, 46], bend: 'down', end: -10 },
        leg: { ik: [50, 18], bend: 'up', end: 80 },
      },
      props: [
        {
          t: 'line',
          points: [
            [-22, 4],
            [86, 4],
          ],
          w: 6,
          role: 'furnitureLine',
        },
        { t: 'rect', at: [-20, 10], w: 34, h: 6, r: 3, role: 'furnitureLine' },
        {
          t: 'line',
          points: [
            [58, 6],
            [64, 34],
          ],
          w: 5,
          role: 'furnitureLine',
        },
        ...cableTower(84, 22, { j: 'nearWrist' }, 12, 62),
        handle({ j: 'nearWrist' }),
      ],
    },
    alt: 'Ausgangsposition: aufrecht am Kabelzug sitzen, Füße an den Fußstützen, Knie leicht gebeugt, Griff mit gestreckten Armen fassen.',
  },
  'handtuch-rudern-isometrisch': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-25, -12, -10], leg: [8, -14, 80] },
      far: { arm: [-27, -13, -10], leg: [9, -15, 80] },
      props: [
        {
          t: 'line',
          points: [
            { j: 'nearWrist' },
            { j: 'nearAnkle', dx: 7, dy: 4 },
            { j: 'nearAnkle', dx: 6, dy: -4 },
          ],
          w: 4,
          role: 'equipSoft',
          front: true,
        },
      ],
    },
    alt: 'Ausgangsposition: aufrecht auf dem Boden sitzen, Beine leicht gebeugt, ein Handtuch um beide Fußsohlen, die Enden mit langen Armen greifen.',
  },
  'tisch-rudern': {
    pose: {
      view: 'side',
      torso: -12,
      head: 0,
      pelvis: [0, 19],
      near: {
        arm: { ik: [38, 56], bend: 'fwd', end: 90 },
        leg: { ik: [-30, 3.5], bend: 'up', end: 180 },
      },
      far: {
        arm: { ik: [37, 56], bend: 'fwd', end: 90 },
        leg: { ik: [-32, 3.5], bend: 'up', end: 180 },
      },
      props: [
        {
          t: 'line',
          points: [
            [106, 0],
            [106, 60],
          ],
          w: 4,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            [30, 61],
            [110, 61],
          ],
          w: 6,
          role: 'furnitureLine',
        },
      ],
    },
    alt: 'Ausgangsposition: rücklings unter einem stabilen Tisch liegen, Hände greifen die Tischkante über der Brust, Arme gestreckt, Knie gebeugt, Körper von Schultern bis Knie gerade.',
  },
  'tuerrahmen-rudern': {
    pose: {
      view: 'side',
      torso: 100,
      head: 96,
      pelvis: [16.5, 67.7],
      near: {
        arm: { ik: [54, 90], bend: 'down', end: 0 },
        leg: { ik: [28, 3.5], bend: 'fwd', end: 0 },
      },
      far: { arm: [-100, -95], leg: { ik: [26, 3.5], bend: 'fwd', end: 0 } },
      props: [wall(56, 8)],
    },
    alt: 'Ausgangsposition: Füße dicht am Türrahmen, eine Hand greift den Rahmen auf Brusthöhe, Arm gestreckt, Körper gerade nach hinten gelehnt.',
  },
  klimmzug: {
    pose: {
      view: 'side',
      torso: 93,
      pelvis: [0, 72],
      headOnTop: true,
      near: { arm: [86, 88, 88], leg: [-95, -150, -100] },
      far: { arm: [87, 89, 88], leg: [-97, -145, -100] },
      props: pullUpBar([5, 157.5]),
    },
    alt: 'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Hände etwas weiter als schulterbreit, Beine angewinkelt, Füße über dem Boden.',
  },
  'klimmzug-band-unterstuetzt': {
    pose: {
      view: 'side',
      torso: 93,
      pelvis: [0, 72],
      headOnTop: true,
      near: { arm: [86, 88, 88], leg: [-70, -140, -60] },
      far: { arm: [87, 89, 88], leg: [-97, -145, -100] },
      props: [
        ...pullUpBar([5, 157.5]),
        band([
          [3, 156],
          { j: 'nearAnkle', dx: -4, dy: -5 },
          { j: 'nearToe', dx: 1, dy: -5 },
          [6, 156],
        ]),
      ],
    },
    alt: 'Ausgangsposition: gestreckter Hang an der Klimmzugstange, ein Fuß steht in der Schlaufe eines Widerstandsbands, das an der Stange befestigt ist.',
  },
  latziehen: {
    pose: {
      view: 'side',
      torso: 100,
      head: 98,
      pelvis: [0, 44],
      near: { arm: [78, 80, 80], leg: { ik: [32, 3.5], bend: 'up', end: 0 } },
      far: { arm: [80, 81, 80], leg: { ik: [30, 3.5], bend: 'up', end: 0 } },
      props: [
        { t: 'rect', at: [-44, 0], w: 12, h: 162, r: 2, role: 'furniture' },
        {
          t: 'line',
          points: [
            [-38, 162],
            [6, 162],
          ],
          w: 5,
          role: 'furnitureLine',
        },
        { t: 'rect', at: [-14, 30], w: 34, h: 6, r: 3, role: 'furnitureLine' },
        { t: 'rect', at: [-4, 0], w: 14, h: 30, role: 'furniture' },
        {
          t: 'circle',
          at: { j: 'nearHip', dx: 22, dy: 12 },
          r: 6,
          role: 'furnitureLine',
          front: true,
        },
        { t: 'line', points: [{ j: 'nearWrist', dy: 2 }, [4, 160]], w: 1.8, role: 'equip' },
        handle({ j: 'nearWrist', dy: 2 }),
      ],
    },
    alt: 'Ausgangsposition: am Latzug sitzen, Oberschenkel unter dem Polster, Stange mit gestreckten Armen über dem Kopf, Oberkörper leicht nach hinten geneigt.',
  },
  'latziehen-band': {
    pose: kneel({ near: [70, 72, 72], far: [72, 73, 72] }, [
      wall(46, 8),
      band([{ j: 'nearWrist' }, [46, 140]]),
    ]),
    alt: 'Ausgangsposition: aufrecht knien, die Enden des oben befestigten Widerstandsbands mit gestreckten Armen über dem Kopf greifen.',
  },
  'handtuch-latziehen': {
    pose: kneel({ near: [62, 66, 66], far: [64, 68, 66] }, [
      mat(-12, 14, 3),
      {
        t: 'rect',
        at: { j: 'nearWrist', dx: -5, dy: -6 },
        w: 10,
        h: 12,
        r: 3,
        role: 'equipSoft',
        front: true,
      },
    ]),
    alt: 'Ausgangsposition: aufrecht knien, ein Handtuch an den Enden greifen, Hände deutlich weiter als schulterbreit, Arme schräg nach oben vor dem Kopf.',
  },
  'face-pull-kabel': {
    pose: stand(
      { near: [12, 10, 10], far: [10, 9, 9] },
      [...cableTower(70, 122, { j: 'nearWrist' }), handle({ j: 'nearWrist' })],
      {
        torso: 92,
      },
    ),
    alt: 'Ausgangsposition: aufrecht vor dem Kabelzug stehen, Rolle auf Kopfhöhe, Seil mit beiden Händen und gestreckten Armen greifen.',
  },

  // --- Brust und Schultern ------------------------------------------------------------------------------------------
  'bankdruecken-langhantel': {
    pose: {
      view: 'side',
      torso: 0,
      head: 0,
      pelvis: [0, 42],
      near: { arm: [90, 90, 90], leg: { ik: [-36, 3.5], bend: 'up', end: 180 } },
      far: { arm: [91, 90, 90], leg: { ik: [-38, 3.5], bend: 'up', end: 180 } },
      props: [
        ...rack(68, 92, 100),
        ...bench(-22, 66, 32),
        ...barbellEnd({ j: 'nearWrist', dy: 1 }),
      ],
    },
    alt: 'Ausgangsposition: auf der Flachbank liegen, Füße fest am Boden, Langhantel mit gestreckten Armen über den Schultern; dahinter die Ablage.',
  },
  'bankdruecken-kurzhantel': {
    pose: {
      view: 'side',
      torso: 0,
      head: 0,
      pelvis: [0, 42],
      near: {
        arm: { ik: [32, 52], bend: 'down', end: 90 },
        leg: { ik: [-36, 3.5], bend: 'up', end: 180 },
      },
      far: {
        arm: { ik: [31, 52], bend: 'down', end: 90 },
        leg: { ik: [-38, 3.5], bend: 'up', end: 180 },
      },
      props: [...bench(-22, 66, 32), ...dumbbellsEnd],
    },
    alt: 'Ausgangsposition: auf der Flachbank liegen, Füße fest am Boden, je eine Kurzhantel seitlich der Brust, Ellbogen unter den Hanteln.',
  },
  'schraegbankdruecken-kurzhantel': {
    pose: {
      view: 'side',
      torso: 150,
      head: 145,
      pelvis: [0, 44],
      near: {
        arm: { ik: [-24, 76], bend: 'down', end: 90 },
        leg: { ik: [36, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [-25, 76], bend: 'down', end: 90 },
        leg: { ik: [34, 3.5], bend: 'up', end: 0 },
      },
      props: [
        { t: 'rect', at: [-8, 0], w: 18, h: 30, role: 'furniture' },
        {
          t: 'line',
          points: [
            [-10, 33],
            [18, 33],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            [-4, 30],
            [-48, 55.4],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        ...dumbbellsEnd,
      ],
    },
    alt: 'Ausgangsposition: auf der Schrägbank (etwa 30 Grad) liegen, Füße am Boden, je eine Kurzhantel seitlich der oberen Brust.',
  },
  'bodendruecken-kurzhantel': {
    pose: supineKneesBent({ near: [90, 90, 90], far: [91, 90, 90] }, dumbbellsEnd),
    alt: 'Ausgangsposition: Rückenlage am Boden, Knie gebeugt, Füße aufgestellt, je eine Kurzhantel mit gestreckten Armen über der Brust.',
  },
  brustpresse: {
    pose: {
      view: 'side',
      torso: 95,
      pelvis: [0, 42],
      near: {
        arm: { ik: [12, 70], bend: 'down', end: 90 },
        leg: { ik: [30, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [11, 70], bend: 'down', end: 90 },
        leg: { ik: [28, 3.5], bend: 'up', end: 0 },
      },
      props: [
        { t: 'rect', at: [-6, 0], w: 22, h: 30, role: 'furniture' },
        { t: 'rect', at: [-16, 30], w: 40, h: 6, r: 3, role: 'furnitureLine' },
        {
          t: 'line',
          points: [
            [-15, 40],
            [-19, 104],
          ],
          w: 7,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            { j: 'nearWrist', dy: -6 },
            { j: 'nearWrist', dy: 8 },
          ],
          w: 4,
          role: 'equip',
          front: true,
        },
        { t: 'line', points: [{ j: 'nearWrist', dy: 8 }, [42, 112]], w: 4, role: 'furnitureLine' },
      ],
    },
    alt: 'Ausgangsposition: an der Brustpresse sitzen, Rücken an der Lehne, Griffe auf Höhe der Brustmitte fassen.',
  },
  'brustdruecken-band': {
    pose: {
      view: 'side',
      torso: 86,
      head: 88,
      near: { arm: [-125, 5, 5], leg: [-78, -93, 0] },
      far: { arm: [-128, 3, 3], leg: [-104, -78, -25] },
      props: [wall(-62, 7), band([{ j: 'nearWrist' }, [-55, 92]], false)],
    },
    alt: 'Ausgangsposition: Schrittstellung, Widerstandsband an einem Türanker hinter dir, Hände halten die Enden seitlich der Brust.',
  },
  'fliegende-kabel': {
    pose: front(
      { near: [188, 176, 176], far: [-8, 4, 4] },
      [
        ...cableTower(-116, 104, { j: 'nearWrist' }),
        ...cableTower(104, 104, { j: 'farWrist' }),
        handle({ j: 'nearWrist' }),
        handle({ j: 'farWrist' }),
      ],
      { near: [-88, -90], far: [-92, -90] },
    ),
    alt: 'Ausgangsposition: von vorn – zwischen zwei Kabelzügen stehen, Rollen auf Schulterhöhe, Arme leicht gebeugt seitlich geöffnet, Griffe in den Händen.',
  },
  'schulterdruecken-kurzhantel': {
    pose: stand(armsAtShoulders, dumbbellEnd({ j: 'nearWrist', dy: 3 })),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kurzhantel auf Schulterhöhe, Ellbogen darunter.',
  },
  'schulterdruecken-band': {
    pose: stand(armsAtShoulders, [band([{ j: 'nearAnkle', dx: 5, dy: -2 }, { j: 'nearWrist' }])]),
    alt: 'Ausgangsposition: hüftbreit auf dem Widerstandsband stehen, die Enden auf Schulterhöhe halten.',
  },
  'schulterdruecken-langhantel': {
    pose: stand({ near: [-70, 100, 100], far: [-73, 98, 100] }, [
      ...rack(-44, 104),
      ...barbellEnd({ j: 'nearWrist', dx: 1, dy: 3 }),
    ]),
    alt: 'Ausgangsposition: aufrecht stehen, Langhantel liegt auf den vorderen Schultern, schulterbreiter Griff, Füße hüftbreit; dahinter das Rack.',
  },
  'seitheben-kurzhantel': {
    pose: front({ near: [-100, -94], far: [-80, -86] }, [
      ...dumbbellEnd({ j: 'nearWrist', dy: -1 }),
      ...dumbbellEnd({ j: 'farWrist', dy: -1 }),
    ]),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, je eine leichte Kurzhantel seitlich neben dem Körper, Ellbogen leicht gebeugt.',
  },
  'seitheben-band': {
    pose: front({ near: [-100, -94], far: [-80, -86] }, [
      band([{ j: 'nearAnkle', dx: 3 }, { j: 'nearWrist' }]),
      band([{ j: 'farAnkle', dx: -3 }, { j: 'farWrist' }]),
    ]),
    alt: 'Ausgangsposition: von vorn – mit beiden Füßen auf der Mitte des Widerstandsbands stehen, die Enden seitlich neben dem Körper greifen.',
  },
  'trizepsdruecken-kabel': {
    pose: stand(
      { near: [-96, 30, 20], far: [-98, 28, 20] },
      [...cableTower(30, 150, { j: 'nearWrist' }), handle({ j: 'nearWrist' })],
      {
        torso: 86,
      },
    ),
    alt: 'Ausgangsposition: aufrecht vor dem Kabelzug stehen, Rolle ganz oben, Ellbogen seitlich am Körper, Hände halten das Seil vor der Brust.',
  },
  'trizepsdruecken-band': {
    pose: stand(
      { near: [-96, 30, 20], far: [-98, 28, 20] },
      [wall(34, 7), band([{ j: 'nearWrist' }, [34, 148]])],
      {
        torso: 86,
      },
    ),
    alt: 'Ausgangsposition: aufrecht stehen, Widerstandsband oben am Türanker, Ellbogen seitlich am Körper, Hände halten die Enden vor der Brust.',
  },
  'trizepsstrecken-kurzhantel': {
    pose: stand(
      { near: [94, 92, 90], far: [95, 93, 90] },
      dumbbellSide({ j: 'nearWrist', dy: -6 }, 90),
      {
        headOnTop: true,
      },
    ),
    alt: 'Ausgangsposition: aufrecht stehen, eine Kurzhantel mit beiden Händen an einem Ende greifen und mit gestreckten Armen über den Kopf halten.',
  },
  'bizepscurl-kurzhantel': {
    pose: stand({ near: [-88, -88, -88], far: [-93, -92, -90] }, dumbbellsEnd),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kurzhantel an gestreckten Armen, Handflächen nach vorn.',
  },
  'bizepscurl-band': {
    pose: stand({ near: [-88, -88, -88], far: [-93, -92, -90] }, [
      band([{ j: 'nearAnkle', dx: 5, dy: -2 }, { j: 'nearWrist' }]),
    ]),
    alt: 'Ausgangsposition: mit beiden Füßen auf dem Widerstandsband stehen, die Enden mit gestreckten Armen greifen.',
  },

  // --- Rumpf --------------------------------------------------------------------------------------------------------
  unterarmstuetz: {
    pose: {
      view: 'side',
      torso: 8,
      head: 6,
      near: { arm: [-90, 0, 0], leg: [188, 188, -75] },
      far: { arm: [-88, 2, 0], leg: [189, 188, -75] },
    },
    alt: 'Ausgangsposition: Unterarmstütz – Ellbogen unter den Schultern, Unterarme am Boden, auf den Fußspitzen, Körper vom Kopf bis zu den Fersen gerade.',
  },
  'bird-dog': {
    pose: quadruped,
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
  },
  'dead-bug': {
    pose: {
      view: 'side',
      torso: 0,
      head: 2,
      near: { arm: [90, 90, 90], leg: [90, 180, 100] },
      far: { arm: [91, 90, 90], leg: [92, 181, 100] },
    },
    alt: 'Ausgangsposition: Rückenlage, Arme senkrecht nach oben, Hüfte und Knie im rechten Winkel, Unterschenkel waagerecht.',
  },
  seitstuetz: {
    pose: {
      view: 'front',
      torso: 17,
      head: 17,
      near: { arm: [88, 90, 90], leg: [197, 197, 200] },
      far: { arm: [-90, -62, -40], armScale: [1, 0.3], leg: [197, 197, 200] },
    },
    alt: 'Ausgangsposition: Seitstütz von vorn – Ellbogen unter der Schulter, Beine gestreckt, Hüfte angehoben, Körper vom Kopf bis zu den Füßen gerade, oberer Arm nach oben gestreckt.',
  },
  'seitstuetz-knie': {
    pose: {
      view: 'front',
      torso: 17,
      head: 17,
      near: { arm: [88, 90, 90], leg: [197, -90, -90], legScale: [1, 0.3] },
      far: { arm: [-90, -62, -40], armScale: [1, 0.3], leg: [197, -90, -90], legScale: [1, 0.3] },
    },
    alt: 'Ausgangsposition: Seitstütz auf den Knien von vorn – Ellbogen unter der Schulter, Knie gebeugt, Hüfte angehoben, Kopf, Hüfte und Knie in einer Linie.',
  },
  'pallof-press-band': {
    pose: front(
      { near: [-110, 22, 10], far: [-70, 158, 170] },
      [wall(-112, 8), band([[-104, 86], { j: 'nearWrist' }])],
      { near: [-92, -90], far: [-88, -90] },
    ),
    alt: 'Ausgangsposition: von vorn – seitlich zum Befestigungspunkt stehen, Widerstandsband auf Brusthöhe, beide Hände halten es vor der Brust.',
  },

  // --- Ausdauer -----------------------------------------------------------------------------------------------------
  hampelmann: {
    pose: front({ near: [-96, -93], far: [-84, -87] }, [], { near: [-87, -90], far: [-93, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Füße zusammen, Arme seitlich am Körper.',
  },
  'step-jacks': {
    pose: front({ near: [-96, -93], far: [-84, -87] }, [], { near: [-87, -90], far: [-93, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Füße zusammen, Arme seitlich am Körper.',
  },

  // --- Aufwärmen & Dehnen (Trainings-Modi, Entwürfe, docs/PLAN-TRAINING-MODI.md 5) ---------------------------------
  'marschieren-auf-der-stelle': {
    pose: front({ near: [-96, -93], far: [-84, -87] }, [], { near: [-88, -90], far: [-92, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Füße hüftbreit, Arme locker neben dem Körper.',
  },
  armkreisen: {
    pose: front({ near: [180, 180], far: [0, 0] }, [], { near: [-88, -90], far: [-92, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Füße hüftbreit, beide Arme seitlich auf Schulterhöhe gestreckt.',
  },
  'schulterblatt-kreisen': {
    pose: front({ near: [-96, -93], far: [-84, -87] }, [], { near: [-88, -90], far: [-92, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Arme hängen locker, Schultern entspannt.',
  },
  'hueftkreisen-stehend': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-12, 2, 80], leg: [-89, -90, 0] },
      far: { arm: [-80, -88], leg: [0, -90, 0] },
      props: [wall(46, 8)],
    },
    alt: 'Ausgangsposition: aufrecht neben einer Wand stehen, eine Hand an der Wand, das andere Knie auf Hüfthöhe angehoben.',
  },
  'beinpendel-stehend': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-12, 2, 80], leg: [-89, -90, 0] },
      far: { arm: [-80, -88], leg: [-70, -72, 0] },
      props: [wall(46, 8)],
    },
    alt: 'Ausgangsposition: aufrecht neben einer Wand stehen, eine Hand an der Wand, das freie Bein locker leicht nach vorn gependelt.',
  },
  'katze-kuh': {
    pose: quadruped,
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken gerade.',
  },
  'brustdehnung-tuerrahmen': {
    pose: stand({ near: [180, 90, 90], far: [-95, -93] }, [wall(-36, 7)]),
    alt: 'Ausgangsposition: aufrecht im Türrahmen stehen, ein Oberarm auf Schulterhöhe nach hinten, der Unterarm senkrecht am Rahmen.',
  },
  'lat-dehnung-stehend': {
    pose: front({ near: [95, 95], far: [-60, -100] }, [], { near: [-88, -90], far: [-92, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, ein Arm gestreckt über dem Kopf, die andere Hand an der Hüfte.',
  },
  'trizeps-dehnen': {
    pose: stand({ near: [100, -80, -80], far: [80, 160, 160] }, [], { headOnTop: true }),
    alt: 'Ausgangsposition: aufrecht stehen, ein Arm über dem Kopf gebeugt, die Hand liegt zwischen den Schulterblättern, die andere Hand am Ellbogen.',
  },
  'schulter-rueckseite-dehnen': {
    pose: front({ near: [-8, -8], far: [-120, 160] }, [], { near: [-88, -90], far: [-92, -90] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, ein gestreckter Arm quer vor der Brust, die andere Hand oberhalb des Ellbogens.',
  },
  'unterarm-dehnen': {
    pose: stand({ near: [0, 0, 90], far: [-3, -2, -2] }),
    alt: 'Ausgangsposition: aufrecht stehen, ein Arm gestreckt nach vorn, die Finger zeigen nach oben, die andere Hand fasst die Finger.',
  },
  'oberschenkel-vorderseite-dehnen': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-12, 2, 80], leg: [-89, -90, 0] },
      far: { arm: [-118, -100], leg: [-102, 125, 180] },
      props: [wall(46, 8)],
    },
    alt: 'Ausgangsposition: auf einem Bein neben einer Wand stehen, eine Hand an der Wand, die andere Hand hält den Fuß des gebeugten Beins hinter dem Gesäß.',
  },
  'beinrueckseite-dehnen-sitzend': {
    pose: {
      view: 'side',
      torso: 80,
      pelvis: [0, 41],
      near: {
        arm: [-60, -60, -60],
        leg: { ik: [52, 3.5], bend: 'up', end: 90 },
      },
      far: {
        arm: [-62, -62, -62],
        leg: { ik: [31, 3.5], bend: 'up', end: 0 },
      },
      props: [...chair(-22, 1, 33, 28)],
    },
    alt: 'Ausgangsposition: auf der vorderen Kante eines Stuhls sitzen, ein Bein gestreckt mit der Ferse am Boden, das andere Knie gebeugt, Rücken gerade.',
  },
  'wadendehnung-wand': {
    pose: {
      view: 'side',
      torso: 70,
      head: 72,
      pelvis: [0, 64],
      near: { arm: [20, 20, 90], leg: { ik: [22, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [18, 18, 90], leg: { ik: [-34, 3.5], bend: 'fwd', end: 0 } },
      props: [wall(58, 8)],
    },
    alt: 'Ausgangsposition: mit beiden Händen an einer Wand abstützen, ein Bein vorn gebeugt, das hintere Bein gestreckt, die hintere Ferse am Boden.',
  },
  'gesaess-dehnen-sitzend': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 41],
      near: {
        arm: { ik: [16, 30], bend: 'down', end: 0 },
        leg: { ik: [24, 30], bend: 'up', end: -20 },
      },
      far: {
        arm: { ik: [14, 30], bend: 'down', end: 0 },
        leg: { ik: [31, 3.5], bend: 'up', end: 0 },
      },
      props: [...chair(-22, 1, 33, 28)],
    },
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, ein Knöchel liegt auf dem anderen Knie, Rücken gerade.',
  },
  'adduktoren-dehnen-stehend': {
    pose: front({ near: [-115, -95], far: [-72, -60] }, [], { near: [-125, -92], far: [-62, -62] }),
    alt: 'Ausgangsposition: von vorn – breiter Stand, ein Knie gebeugt, das andere Bein gestreckt, Hände an den Oberschenkeln.',
  },

  // --- Calisthenics, Schlingentrainer, Lauf-ABC (Entwürfe, docs/PLAN-CALISTHENICS-SCHLINGE.md) --------------------
  ...CALISTHENICS_ILLUSTRATIONS,
};
