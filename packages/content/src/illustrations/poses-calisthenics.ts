import {
  barFront,
  benchEnd,
  chair,
  dipBars,
  parallette,
  pullUpBar,
  ring,
  step,
  suspension,
  wall,
} from './equipment';
import type { ExerciseIllustration } from './poses';
import type { Limb, PoseSpec, Prop } from './rig';

/**
 * Ausgangspositionen der Entwürfe aus docs/PLAN-CALISTHENICS-SCHLINGE.md (Calisthenics-Skill-Pfade, Schlingentrainer,
 * Lauf-ABC/Lauf-Kraft). Gleiche Figur und Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026): Winkel absolut in
 * Grad, 0 = nach vorn, 90 = nach oben. Halteübungen zeigen die gehaltene Position.
 */

// ---------------------------------------------------------------------------------------------------------------
// Grundhaltungen
// ---------------------------------------------------------------------------------------------------------------

const BAR: readonly [number, number] = [5, 157.5];
/** Hang an der Stange mit leicht angewinkelten Beinen (Füße frei). */
function hang(legs: { near: Limb; far: Limb }, props: Prop[] = pullUpBar(BAR)): PoseSpec {
  return {
    view: 'side',
    torso: 93,
    pelvis: [0, 72],
    headOnTop: true,
    near: { arm: [86, 88, 88], leg: legs.near },
    far: { arm: [87, 89, 88], leg: legs.far },
    props,
  };
}
const hangLegs = { near: [-95, -150, -100] as Limb, far: [-97, -145, -100] as Limb };

/** Oben am Ende eines Klimmzugs: Kinn über der Stange, Ellbogen unten. */
const pullTop: PoseSpec = {
  view: 'side',
  torso: 95,
  head: 92,
  pelvis: [-4, 100],
  near: { arm: { ik: [6, 155], bend: 'down', end: 90 }, leg: [-100, -150, -100] },
  far: { arm: { ik: [5, 155], bend: 'down', end: 90 }, leg: [-102, -145, -100] },
  props: pullUpBar(BAR),
};

/** Stütz mit gestreckten Armen (Barren/Ringe): Hände auf Höhe `h`, Beine angewinkelt nach hinten. */
function support(h: number, props: Prop[]): PoseSpec {
  return {
    view: 'side',
    torso: 92,
    pelvis: [-2, h + 10],
    near: { arm: { ik: [2, h], bend: 'back', end: -90 }, leg: [-80, -160, -120] },
    far: { arm: { ik: [1, h], bend: 'back', end: -90 }, leg: [-84, -155, -120] },
    props,
  };
}

/** Hoher Liegestütz (wie poses.ts). */
const pushUp: PoseSpec = {
  view: 'side',
  torso: 20,
  head: 18,
  near: { arm: [-90, -90, 0], leg: [200, 200, -75] },
  far: { arm: [-87, -91, 0], leg: [201, 200, -75] },
};

/** Laufhaltung der Arme (vorn/hinten angewinkelt). */
const runArms = { near: [-62, 18, 18] as Limb, far: [-118, -48, -48] as Limb };

/** Stand auf einem Bein, anderes Knie vorn oben (Laufhaltung). */
function kneeUp(thigh = 0, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    near: { arm: runArms.far, leg: [thigh, -95, -20] },
    far: { arm: runArms.near, leg: [-90, -90, 0] },
    props,
  };
}

/** Vorderansicht stehend. */
function front(
  arms: { near: Limb; far: Limb },
  legs: { near: Limb; far: Limb },
  props: Prop[] = [],
): PoseSpec {
  return {
    view: 'front',
    torso: 90,
    near: { arm: arms.near, leg: legs.near },
    far: { arm: arms.far, leg: legs.far },
    props,
  };
}

// --- Schlingentrainer ------------------------------------------------------------------------------------------

/** Anker vor der Person (Gesicht zum Anker), oben. */
const ANCHOR_FRONT: readonly [number, number] = [70, 160];
/** Anker hinter der Person (Rücken zum Anker). */
const ANCHOR_BACK: readonly [number, number] = [-70, 160];

/** Zurückgelehnt, Gesicht zum Anker, Arme gestreckt zum Anker (Rudern, Curl, Y/T, Face Pull). */
function leanBack(oneArm = false): PoseSpec {
  return {
    view: 'side',
    torso: 125,
    head: 118,
    pelvis: [0, 57],
    near: {
      arm: { ik: [16, 108], bend: 'down', end: 35 },
      leg: [-55, -55, 0],
    },
    far: oneArm
      ? { arm: [-60, -70], leg: [-56, -54, 0] }
      : { arm: { ik: [15, 107], bend: 'down', end: 35 }, leg: [-56, -54, 0] },
    props: suspension(ANCHOR_FRONT, oneArm ? [{ j: 'nearHand' }] : [{ j: 'nearHand' }]),
  };
}

/** Nach vorn gelehnt, Rücken zum Anker, Arme vorn auf Brusthöhe (Brustpresse, Fliegende, Trizeps, Fallout). */
function leanForward(
  arms: { near: Limb; far: Limb } = { near: [5, 5, 5], far: [3, 3, 3] },
): PoseSpec {
  return {
    view: 'side',
    torso: 62,
    head: 64,
    pelvis: [0, 62],
    near: { arm: arms.near, leg: [-118, -118, 0] },
    far: { arm: arms.far, leg: [-116, -120, 0] },
    props: suspension(ANCHOR_BACK, [{ j: 'nearHand' }], false),
  };
}

/** Füße in den Schlaufen, hoher Liegestütz (Füße ca. 30 Einheiten über dem Boden). */
const feetInStrapsPushUp: PoseSpec = {
  view: 'side',
  torso: 8,
  head: 6,
  pelvis: [0, 44],
  near: { arm: [-84, -90, 0], leg: [188, 188, 180] },
  far: { arm: [-82, -92, 0], leg: [189, 188, 180] },
  props: suspension([-60, 160], [{ j: 'nearAnkle' }]),
};

/** Rückenlage, Fersen in den Schlaufen (Beinbeuger, Hüftheben). */
function supineHeels(bent: boolean): PoseSpec {
  return {
    view: 'side',
    torso: 0,
    head: 4,
    near: {
      arm: [182, 180, 180],
      leg: bent ? [150, 195, 100] : [168, 168, 100],
    },
    far: { arm: [181, 180, 180], leg: bent ? [151, 196, 100] : [169, 168, 100] },
    props: suspension([-58, 160], [{ j: 'nearAnkle' }]),
  };
}

/** Aufrecht, Gesicht zum Anker, Griffe vor der Brust (Kniebeuge mit Halt, Ausfallschritt mit Halt). */
function standHolding(legs?: { near: Limb; far: Limb }): PoseSpec {
  return {
    view: 'side',
    torso: 92,
    near: { arm: [-20, 10, 10], leg: legs?.near ?? [-88, -91, 0] },
    far: { arm: [-22, 8, 8], leg: legs?.far ?? [-93, -89, 0] },
    props: suspension(ANCHOR_FRONT, [{ j: 'nearHand' }]),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Übungen
// ---------------------------------------------------------------------------------------------------------------

export const CALISTHENICS_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  // --- Klimmzug-Pfad ----------------------------------------------------------------------------------------------
  'toter-hang': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Hände schulterbreit, Arme gestreckt, Beine locker angewinkelt, Füße über dem Boden.',
  },
  'skapula-klimmzug': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: gestreckter Hang an der Klimmzugstange, Arme gestreckt, Schultern noch locker, Füße über dem Boden.',
  },
  'klimmzug-negativ': {
    pose: pullTop,
    alt: 'Ausgangsposition: oben an der Klimmzugstange, Kinn über der Stange, Ellbogen gebeugt und nah am Körper, Beine angewinkelt.',
  },
  'chin-up': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: gestreckter Hang an der Klimmzugstange im Untergriff, Handflächen zeigen zum Körper, Füße über dem Boden.',
  },
  'archer-klimmzug': {
    pose: {
      view: 'front',
      torso: 90,
      pelvis: [0, 84],
      headOnTop: true,
      near: { arm: [128, 128, 128], leg: [-92, -92, -90] },
      far: { arm: [52, 52, 52], leg: [-88, -88, -90] },
      props: [barFront(161, 78)],
    },
    alt: 'Ausgangsposition: von vorn – Hang an der Klimmzugstange mit sehr weitem Griff, beide Arme gestreckt, Beine geschlossen.',
  },
  'einarmiger-klimmzug-negativ': {
    pose: {
      ...pullTop,
      far: { arm: { ik: [12, 128], bend: 'down', end: 90 }, leg: [-102, -145, -100] },
      props: [
        ...pullUpBar(BAR),
        {
          t: 'line',
          points: [[8, 156], { j: 'farHand' }],
          w: 3,
          role: 'equipSoft',
          front: true,
        },
      ],
    },
    alt: 'Ausgangsposition: oben an der Klimmzugstange, Kinn über der Stange; eine Hand an der Stange, die andere hält lose ein Handtuch, das über die Stange hängt.',
  },
  // --- Rudern -----------------------------------------------------------------------------------------------------
  'australian-pull-up': {
    pose: {
      view: 'side',
      torso: 24,
      head: 22,
      pelvis: [0, 32],
      near: { arm: { ik: [38, 91], bend: 'fwd', end: 90 }, leg: [205, 205, 115] },
      far: { arm: { ik: [37, 91], bend: 'fwd', end: 90 }, leg: [206, 205, 115] },
      props: [
        {
          t: 'line',
          points: [
            [80, 0],
            [80, 104],
          ],
          w: 4,
          role: 'furnitureLine',
        },
        {
          t: 'line',
          points: [
            [80, 92],
            [38, 92],
          ],
          w: 3,
          role: 'furnitureLine',
        },
        { t: 'circle', at: [38, 92], r: 3.5, role: 'equip', front: true },
      ],
    },
    alt: 'Ausgangsposition: rücklings unter einer Stange auf Hüfthöhe, Hände greifen schulterbreit, Arme gestreckt, Fersen am Boden, Körper gerade.',
  },
  'ring-rudern': {
    pose: {
      ...leanBack(),
      props: [...ring({ j: 'nearHand' }, 62), ...ring({ j: 'farHand' }, 60, 164, false)],
    },
    alt: 'Ausgangsposition: Gesicht zu den Ringen, Hände greifen die Ringe, Arme gestreckt, Körper gerade nach hinten gelehnt, Fersen am Boden.',
  },
  // --- Muscle-up --------------------------------------------------------------------------------------------------
  'explosiver-klimmzug': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: ruhiger, gestreckter Hang an der Klimmzugstange, Hände etwas weiter als schulterbreit, Füße über dem Boden.',
  },
  'muscle-up-negativ': {
    pose: {
      view: 'side',
      torso: 84,
      head: 84,
      pelvis: [-4, 92],
      near: { arm: { ik: [7, 85], bend: 'back', end: -90 }, leg: [-95, -95, 0] },
      far: { arm: { ik: [6, 85], bend: 'back', end: -90 }, leg: [-92, -98, 0] },
      props: [...pullUpBar([7, 84], 164), step(-38, 18, 24)],
    },
    alt: 'Ausgangsposition: im Stütz über der Stange, Arme gestreckt, Stange auf Hüfthöhe; die Füße stehen noch auf einem Kasten.',
  },
  'muscle-up': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: gestreckter Hang an der Stange, Hände etwa schulterbreit, Körper ruhig, Füße über dem Boden.',
  },
  // --- Dips -------------------------------------------------------------------------------------------------------
  'stuetz-barren': {
    pose: support(86, dipBars(-30, 34, 86)),
    alt: 'Ausgangsposition: Stütz am Barren, Arme gestreckt, Hände neben der Hüfte, Schultern tief, Beine angewinkelt über dem Boden.',
  },
  'dips-negativ-barren': {
    pose: support(86, dipBars(-30, 34, 86)),
    alt: 'Ausgangsposition: oben im Stütz am Barren, Arme gestreckt, Schultern tief, Oberkörper leicht nach vorn, Beine angewinkelt.',
  },
  'dips-barren': {
    pose: support(86, dipBars(-30, 34, 86)),
    alt: 'Ausgangsposition: Stütz am Barren mit gestreckten Armen, Schultern weg von den Ohren, Beine angewinkelt über dem Boden.',
  },
  'ring-stuetz': {
    pose: support(86, [
      ...ring({ j: 'nearHand' }, 14, 164, false),
      ...ring({ j: 'farHand' }, 12, 164, false),
    ]),
    alt: 'Ausgangsposition: Stütz an den Ringen, Arme gestreckt, Ringe dicht neben der Hüfte, Beine angewinkelt über dem Boden.',
  },
  // Restpunkte E (27.10.2026): von vorn gezeichnet – so sind beide Ringe neben der Hüfte und die Gurte sichtbar
  // (im Profil verdeckte der Körper die Ringe).
  'dips-ringe': {
    pose: {
      view: 'front',
      torso: 90,
      pelvis: [0, 92],
      near: { arm: [-97, -93, -90], leg: [-93, -90, -90], legScale: [1, 0.55] },
      far: { arm: [-83, -87, -90], leg: [-87, -90, -90], legScale: [1, 0.55] },
      props: [...ring({ j: 'nearHand' }, -24, 164), ...ring({ j: 'farHand' }, 24, 164)],
    },
    alt: 'Ausgangsposition: von vorn – ruhiger Stütz an den Ringen, Arme gestreckt, Ringe neben der Hüfte, Knie angewinkelt, Füße hinten.',
  },
  // --- Liegestütz -------------------------------------------------------------------------------------------------
  'diamant-liegestuetz': {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz, Hände eng unter der Brust (Daumen und Zeigefinger bilden eine Raute), Arme gestreckt, Körper gerade.',
  },
  'planche-lehne': {
    pose: {
      ...pushUp,
      torso: 17,
      near: { arm: [-110, -110, 180], leg: [197, 197, -75] },
      far: { arm: [-108, -111, 180], leg: [198, 197, -75] },
    },
    alt: 'Ausgangsposition: hoher Liegestütz, Schultern deutlich vor die Hände geschoben, Arme gestreckt, Finger zeigen nach hinten.',
  },
  'pseudo-planche-liegestuetz': {
    pose: {
      ...pushUp,
      torso: 17,
      near: { arm: [-110, -110, 180], leg: [197, 197, -75] },
      far: { arm: [-108, -111, 180], leg: [198, 197, -75] },
    },
    alt: 'Ausgangsposition: hoher Liegestütz mit den Händen auf Hüfthöhe, Schultern vor den Händen, Arme gestreckt, Körper gerade.',
  },
  'ring-liegestuetz': {
    pose: {
      ...pushUp,
      pelvis: [0, 46],
      torso: 36,
      head: 34,
      near: { arm: [-90, -90, 0], leg: [216, 216, -30] },
      far: { arm: [-87, -91, 0], leg: [217, 216, -30] },
      props: [
        ...ring({ j: 'nearWrist' }, 14, 164, false),
        ...ring({ j: 'farWrist' }, 12, 164, false),
      ],
    },
    alt: 'Ausgangsposition: schräger Liegestütz, Hände in tief hängenden Ringen, Arme gestreckt, Füße am Boden, Körper gerade.',
  },
  // --- Kniebeuge --------------------------------------------------------------------------------------------------
  'pistol-kniebeuge-halt': {
    pose: {
      view: 'side',
      torso: 92,
      near: { arm: [-10, 0, 0], leg: [-28, -28, 10] },
      far: { arm: [-80, -85], leg: [-90, -90, 0] },
      props: [wall(56, 8)],
    },
    alt: 'Ausgangsposition: auf einem Bein neben einem Türrahmen stehen, eine Hand hält den Rahmen auf Hüfthöhe, das andere Bein leicht nach vorn gehoben.',
  },
  'pistol-kniebeuge-kasten': {
    pose: {
      view: 'side',
      torso: 92,
      near: { arm: [2, 2, 2], leg: [-28, -28, 10] },
      far: { arm: [0, 0, 0], leg: [-90, -90, 0] },
      props: chair(-48, 1, 33, 28),
    },
    alt: 'Ausgangsposition: auf einem Bein vor einem Stuhl stehen, das andere Bein und die Arme nach vorn gestreckt.',
  },
  'pistol-kniebeuge': {
    pose: {
      view: 'side',
      torso: 92,
      near: { arm: [2, 2, 2], leg: [-22, -22, 10] },
      far: { arm: [0, 0, 0], leg: [-90, -90, 0] },
    },
    alt: 'Ausgangsposition: auf einem Bein stehen, das andere Bein gestreckt leicht angehoben, Arme waagerecht nach vorn.',
  },
  // --- Handstand --------------------------------------------------------------------------------------------------
  'hechtstuetz-erhoeht': {
    pose: {
      view: 'side',
      torso: -76,
      head: -84,
      pelvis: [0, 92],
      near: { arm: [-82, -82, 0], leg: [206, 206, -80] },
      far: { arm: [-80, -83, 0], leg: [207, 206, -80] },
      props: chair(-84, 1, 60, 30),
    },
    alt: 'Ausgangsposition: Füße auf einem Stuhl, Hände schulterbreit am Boden, Hüfte hoch über den Schultern, Arme gestreckt, Kopf zwischen den Armen.',
  },
  wandlaufen: {
    pose: { ...pushUp, props: [wall(-77, 8)] },
    alt: 'Ausgangsposition: hoher Liegestütz mit den Fersen an einer Wand hinter dir, Arme gestreckt, Körper gerade.',
  },
  'handstand-wand': {
    pose: {
      view: 'side',
      torso: -90,
      head: -90,
      headOnTop: true,
      near: { arm: [-90, -90, 0], leg: [92, 92, 80] },
      far: { arm: [-91, -90, 0], leg: [90, 90, 80] },
      props: [wall(12, 8, 162)],
    },
    alt: 'Ausgangsposition: Handstand mit dem Bauch zur Wand, Hände eine Handbreite vor der Wand, Arme gestreckt, Körper gerade, Zehen an der Wand.',
  },
  'handstand-frei': {
    pose: {
      view: 'side',
      torso: -90,
      head: -90,
      headOnTop: true,
      near: { arm: [-90, -90, 0], leg: [90, 90, 90] },
      far: { arm: [-91, -90, 0], leg: [89, 90, 90] },
    },
    alt: 'Ausgangsposition: freier Handstand, Hände schulterbreit am Boden, Arme gestreckt, Körper vom Handgelenk bis zu den Zehen gerade übereinander.',
  },
  // --- Rumpf ------------------------------------------------------------------------------------------------------
  'hollow-body-gehockt': {
    pose: {
      view: 'side',
      torso: 14,
      head: 22,
      near: { arm: [165, 165, 165], leg: [70, 175, 160] },
      far: { arm: [163, 163, 163], leg: [72, 176, 160] },
    },
    alt: 'Ausgangsposition: Rückenlage, unterer Rücken am Boden, Schultern leicht angehoben, Knie zur Brust gezogen, Arme neben den Beinen.',
  },
  'hollow-body-halten': {
    pose: {
      view: 'side',
      torso: 10,
      head: 16,
      near: { arm: [16, 16, 16], leg: [172, 172, 172] },
      far: { arm: [15, 15, 15], leg: [173, 172, 172] },
    },
    alt: 'Ausgangsposition: Rückenlage, Schultern und gestreckte Beine knapp über dem Boden, Arme gestreckt neben den Ohren, unterer Rücken am Boden.',
  },
  'knieheben-haengend': {
    pose: hang(hangLegs),
    alt: 'Ausgangsposition: ruhiger, gestreckter Hang an der Klimmzugstange, Beine hängen locker nach unten, Füße über dem Boden.',
  },
  'l-sitz-gehockt': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 10],
      near: { arm: { ik: [2, 0.5], bend: 'back', end: 0 }, leg: [56, -62, -10] },
      far: { arm: { ik: [1, 0.5], bend: 'back', end: 0 }, leg: [54, -63, -10] },
    },
    alt: 'Ausgangsposition: Stütz am Boden, Hände neben der Hüfte, Arme gestreckt, Gesäß und Füße angehoben, Knie zur Brust gezogen.',
  },
  'l-sitz': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 27],
      near: { arm: { ik: [2, 13], bend: 'back', end: 0 }, leg: [2, 2, 10] },
      far: { arm: { ik: [1, 13], bend: 'back', end: 0 }, leg: [1, 2, 10] },
      props: parallette(2),
    },
    alt: 'Ausgangsposition: Stütz auf Parallettes, Arme gestreckt, Beine gestreckt und etwa waagerecht nach vorn – der Körper bildet ein „L“.',
  },
  // --- Front Lever ------------------------------------------------------------------------------------------------
  'front-lever-gehockt': {
    pose: {
      view: 'side',
      torso: 0,
      head: 2,
      pelvis: [-18, 106],
      headOnTop: true,
      // Restpunkte E (27.10.2026): Oberschenkel zur Brust (schräg nach oben), Unterschenkel hängen zum Gesäß –
      // vorher lagen die Beine verdeckt unter dem Rumpf.
      near: { arm: [82, 82, 82], leg: [58, -100, 180] },
      far: { arm: [83, 83, 83], leg: [55, -103, 180] },
      props: pullUpBar([26, 157.5]),
    },
    alt: 'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Rücken waagerecht, Knie eng zur Brust gezogen, Unterschenkel hängen locker.',
  },
  'front-lever-einbeinig': {
    pose: {
      view: 'side',
      torso: 0,
      head: 2,
      pelvis: [-18, 106],
      headOnTop: true,
      near: { arm: [82, 82, 82], leg: [180, 180, 180] },
      far: { arm: [83, 83, 83], leg: [-10, 184, 185] },
      props: pullUpBar([26, 157.5]),
    },
    alt: 'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Körper waagerecht, ein Bein gestreckt, das andere zur Brust gezogen.',
  },
  'front-lever': {
    pose: {
      view: 'side',
      torso: 0,
      head: 2,
      pelvis: [-18, 106],
      headOnTop: true,
      near: { arm: [82, 82, 82], leg: [180, 180, 180] },
      far: { arm: [83, 83, 83], leg: [181, 180, 180] },
      props: pullUpBar([26, 157.5]),
    },
    alt: 'Ausgangsposition: unter der Klimmzugstange, Arme gestreckt, Körper komplett gestreckt und waagerecht.',
  },
  // --- Back Lever -------------------------------------------------------------------------------------------------
  'deutscher-hang': {
    pose: {
      ...hang({ near: [40, -95, -90], far: [38, -96, -90] }),
      props: [...ring({ j: 'nearHand' }, 4), ...ring({ j: 'farHand' }, 3, 164, false)],
    },
    alt: 'Ausgangsposition: an den Ringen hängen, Arme gestreckt, Knie zur Brust gezogen, bereit zum langsamen Durchdrehen.',
  },
  'back-lever-gehockt': {
    pose: {
      view: 'side',
      torso: 0,
      head: -4,
      pelvis: [-18, 104],
      near: { arm: [112, 112, 112], leg: [-8, 185, 185] },
      far: { arm: [113, 113, 113], leg: [-10, 184, 185] },
      props: [...ring({ j: 'nearHand' }, -2), ...ring({ j: 'farHand' }, -3, 164, false)],
    },
    alt: 'Ausgangsposition: waagerecht unter den Ringen, Bauch nach unten, Arme gestreckt hinter dem Körper, Knie eng zur Brust gezogen.',
  },
  'back-lever': {
    pose: {
      view: 'side',
      torso: 0,
      head: -4,
      pelvis: [-18, 104],
      near: { arm: [112, 112, 112], leg: [180, 180, 180] },
      far: { arm: [113, 113, 113], leg: [181, 180, 180] },
      props: [...ring({ j: 'nearHand' }, -2), ...ring({ j: 'farHand' }, -3, 164, false)],
    },
    alt: 'Ausgangsposition: waagerecht unter den Ringen, Bauch nach unten, Arme gestreckt hinter dem Körper, Beine gestreckt.',
  },

  // --- Schlingentrainer -------------------------------------------------------------------------------------------
  'schlingentrainer-rudern': {
    pose: leanBack(),
    alt: 'Ausgangsposition: Gesicht zum Anker, Griffe in beiden Händen, Arme gestreckt, Körper gerade nach hinten gelehnt, Fersen am Boden.',
  },
  'schlingentrainer-rudern-einarmig': {
    pose: leanBack(true),
    alt: 'Ausgangsposition: Gesicht zum Anker, ein Griff in einer Hand, Arm gestreckt, Körper gerade nach hinten gelehnt, freier Arm an der Seite.',
  },
  'schlingentrainer-bizepscurl': {
    pose: leanBack(),
    alt: 'Ausgangsposition: Gesicht zum Anker, Griffe im Untergriff, Arme gestreckt auf Schulterhöhe, Körper gerade nach hinten gelehnt.',
  },
  'schlingentrainer-y-heben': {
    pose: leanBack(),
    alt: 'Ausgangsposition: Gesicht zum Anker, Griffe vor der Brust, Arme gestreckt, Körper leicht nach hinten gelehnt.',
  },
  'schlingentrainer-t-heben': {
    pose: leanBack(),
    alt: 'Ausgangsposition: Gesicht zum Anker, Arme gestreckt vor der Brust, Körper gerade nach hinten gelehnt, Fersen am Boden.',
  },
  'schlingentrainer-face-pull': {
    pose: leanBack(),
    alt: 'Ausgangsposition: Gesicht zum Anker, Griffe im Obergriff, Arme gestreckt, Körper gerade nach hinten gelehnt.',
  },
  'schlingentrainer-brustpresse': {
    pose: leanForward(),
    alt: 'Ausgangsposition: Rücken zum Anker, Griffe auf Brusthöhe, Arme gestreckt nach vorn, Körper gerade nach vorn gelehnt, Füße hinten.',
  },
  'schlingentrainer-fliegende': {
    pose: leanForward(),
    alt: 'Ausgangsposition: Rücken zum Anker, Griffe vor der Brust, Arme fast gestreckt, Körper gerade nach vorn gelehnt.',
  },
  'schlingentrainer-trizepsstrecken': {
    pose: leanForward({ near: [20, 20, 20], far: [18, 18, 18] }),
    alt: 'Ausgangsposition: Rücken zum Anker, Arme gestreckt schräg nach vorn oben, Körper gerade nach vorn gelehnt.',
  },
  'schlingentrainer-fallout': {
    pose: leanForward({ near: [10, 10, 10], far: [8, 8, 8] }),
    alt: 'Ausgangsposition: Rücken zum Anker, Arme gestreckt vor dem Körper, Körper leicht nach vorn gelehnt, Bauch fest.',
  },
  'schlingentrainer-liegestuetz': {
    pose: feetInStrapsPushUp,
    alt: 'Ausgangsposition: hoher Liegestütz, Hände unter den Schultern am Boden, Füße in den Schlaufen, Körper gerade.',
  },
  'schlingentrainer-atomic-liegestuetz': {
    pose: feetInStrapsPushUp,
    alt: 'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Arme gestreckt, Körper gerade.',
  },
  'schlingentrainer-pike': {
    pose: feetInStrapsPushUp,
    alt: 'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Schultern über den Händen, Körper gerade.',
  },
  'schlingentrainer-knie-zur-brust': {
    pose: feetInStrapsPushUp,
    alt: 'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Arme gestreckt, Körper gerade.',
  },
  'schlingentrainer-bergsteiger': {
    pose: feetInStrapsPushUp,
    alt: 'Ausgangsposition: hoher Liegestütz mit den Füßen in den Schlaufen, Hände unter den Schultern, Körper gerade.',
  },
  'schlingentrainer-unterarmstuetz': {
    pose: {
      view: 'side',
      torso: 2,
      head: 2,
      near: { arm: [-90, 0, 0], leg: [182, 182, 180] },
      far: { arm: [-88, 2, 0], leg: [183, 182, 180] },
      props: suspension([-62, 160], [{ j: 'nearAnkle' }]),
    },
    alt: 'Ausgangsposition: Unterarmstütz, Ellbogen unter den Schultern, Füße in den Schlaufen, Körper vom Kopf bis zu den Fersen gerade.',
  },
  'schlingentrainer-seitstuetz': {
    pose: {
      view: 'front',
      torso: 8,
      head: 8,
      near: { arm: [88, 90, 90], leg: [187, 187, 190] },
      far: { arm: [-90, -62, -40], armScale: [1, 0.3], leg: [187, 187, 190] },
      props: suspension([-66, 160], [{ j: 'nearAnkle' }]),
    },
    alt: 'Ausgangsposition: Seitstütz von vorn, Ellbogen unter der Schulter, Füße übereinander in den Schlaufen, Körper gerade, oberer Arm nach oben gestreckt.',
  },
  'schlingentrainer-beinbeuger': {
    pose: supineHeels(false),
    alt: 'Ausgangsposition: Rückenlage, Fersen in den Schlaufen unter dem Anker, Beine gestreckt, Arme seitlich am Boden.',
  },
  'schlingentrainer-hueftheben': {
    pose: supineHeels(true),
    alt: 'Ausgangsposition: Rückenlage, Fersen in den Schlaufen, Knie leicht gebeugt, Arme seitlich am Boden.',
  },
  'schlingentrainer-kniebeuge': {
    pose: standHolding(),
    alt: 'Ausgangsposition: aufrecht stehen, Gesicht zum Anker, Griffe vor der Brust, Füße schulterbreit, Gurte gespannt.',
  },
  'schlingentrainer-einbeinige-kniebeuge': {
    pose: standHolding({ near: [-28, -28, 10], far: [-90, -90, 0] }),
    alt: 'Ausgangsposition: auf einem Bein stehen, Gesicht zum Anker, Griffe vor der Brust, das andere Bein leicht nach vorn gehoben.',
  },
  'schlingentrainer-ausfallschritt-assistiert': {
    pose: standHolding(),
    alt: 'Ausgangsposition: aufrecht stehen, Gesicht zum Anker, Griffe vor der Brust, Füße hüftbreit.',
  },
  'schlingentrainer-ausfallschritt': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-80, -60, -60], leg: [-118, 196, 180] },
      far: { arm: [-84, -62, -62], leg: [-88, -91, 0] },
      props: suspension([-58, 160], [{ j: 'nearAnkle' }]),
    },
    alt: 'Ausgangsposition: Rücken zum Anker, auf dem vorderen Bein stehen, der hintere Fuß liegt auf Kniehöhe in der Schlaufe.',
  },

  // --- Lauf-ABC ---------------------------------------------------------------------------------------------------
  'lauf-abc-fussgelenksarbeit': {
    pose: {
      view: 'side',
      torso: 92,
      near: { arm: runArms.near, leg: [-92, -96, -40] },
      far: { arm: runArms.far, leg: [-89, -88, 0] },
    },
    alt: 'Ausgangsposition: aufrecht stehen, Arme angewinkelt wie beim Laufen, eine Ferse leicht angehoben, der Ballen bleibt am Boden.',
  },
  'lauf-abc-skippings': {
    pose: kneeUp(-40),
    alt: 'Ausgangsposition: aufrecht auf einem Bein, das andere Knie leicht nach vorn gehoben, Arme angewinkelt wie beim Laufen.',
  },
  'lauf-abc-anfersen': {
    pose: {
      view: 'side',
      torso: 92,
      near: { arm: runArms.far, leg: [-100, 115, 160] },
      far: { arm: runArms.near, leg: [-90, -90, 0] },
    },
    alt: 'Ausgangsposition: aufrecht auf einem Bein, die andere Ferse ist zum Gesäß geführt, Arme angewinkelt wie beim Laufen.',
  },
  'lauf-abc-kniehebelauf': {
    pose: kneeUp(0),
    alt: 'Ausgangsposition: aufrecht auf einem Bein, das andere Knie auf Hüfthöhe, Arme angewinkelt gegengleich wie beim Laufen.',
  },
  'lauf-abc-hopserlauf': {
    pose: kneeUp(-10),
    alt: 'Ausgangsposition: aufrecht auf dem Vorfuß eines Beins, das andere Knie vorn oben, Arme angewinkelt gegengleich.',
  },
  'lauf-abc-seitgalopp': {
    pose: front({ near: [195, 195], far: [-15, -15] }, { near: [-104, -100], far: [-76, -80] }),
    alt: 'Ausgangsposition: von vorn – seitlich zur Laufrichtung, Füße etwa schulterbreit, Knie leicht gebeugt, Arme seitlich auf Schulterhöhe.',
  },
  'lauf-abc-ueberkreuzlauf': {
    pose: front({ near: [200, 200], far: [-20, -20] }, { near: [-78, -100], far: [-100, -80] }),
    alt: 'Ausgangsposition: von vorn – seitlich zur Laufrichtung, ein Bein vor dem anderen gekreuzt, Arme seitlich leicht gehoben.',
  },
  'wadenheben-gebeugtes-knie': {
    pose: {
      view: 'side',
      torso: 88,
      near: { arm: [-10, 5, 80], leg: [-70, -105, 0] },
      far: { arm: [-80, -88], leg: [-72, -103, 0] },
      props: [wall(48, 8)],
    },
    alt: 'Ausgangsposition: hüftbreit vor einer Wand stehen, eine Hand an der Wand, Knie leicht gebeugt, Fersen am Boden.',
  },
  'einbeinstand-laeufer': {
    pose: kneeUp(0),
    alt: 'Ausgangsposition: auf einem Bein stehen, das andere Knie auf Hüfthöhe, Arme angewinkelt wie beim Laufen, Becken waagerecht.',
  },
  'laeufer-kniehub-stand': {
    pose: kneeUp(-20),
    alt: 'Ausgangsposition: auf einem Bein stehen, das andere Knie leicht angehoben, Arme angewinkelt wie beim Laufen.',
  },
  'step-down-stufe': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 88.5],
      near: { arm: [-80, -60, -60], leg: [-65, -90, -10] },
      far: { arm: [-84, -62, -62], leg: [-90, -90, 0] },
      props: [step(-40, 8, 22)],
    },
    alt: 'Ausgangsposition: auf einem Bein an der Kante einer Stufe stehen, das andere Bein hängt frei vor der Kante, Hände an der Hüfte.',
  },
  'seitlicher-ausfallschritt': {
    pose: front({ near: [-100, -95], far: [-80, -85] }, { near: [-112, -110], far: [-68, -70] }),
    alt: 'Ausgangsposition: von vorn – breiter Stand, Füße deutlich weiter als schulterbreit, Arme locker neben dem Körper.',
  },
  'copenhagen-seitstuetz-knie': {
    pose: {
      view: 'front',
      torso: 14,
      head: 14,
      near: { arm: [88, 90, 90], leg: [194, 194, 194] },
      far: { arm: [-90, -62, -40], armScale: [1, 0.3], leg: [194, -90, -90], legScale: [1, 0.3] },
      props: benchEnd(-86, 30, 22),
    },
    alt: 'Ausgangsposition: Seitstütz von vorn, Ellbogen unter der Schulter, das obere Knie liegt auf einer Bank, das untere Bein hängt frei, Hüfte angehoben.',
  },
};

/** Übungen, deren Ausgangsposition bewusst ohne Bodenkontakt ist (Hang, Hebel, Stütz). */
export const CALISTHENICS_OFF_GROUND = new Set([
  'toter-hang',
  'skapula-klimmzug',
  'klimmzug-negativ',
  'chin-up',
  'archer-klimmzug',
  'einarmiger-klimmzug-negativ',
  'explosiver-klimmzug',
  'muscle-up',
  'stuetz-barren',
  'dips-negativ-barren',
  'dips-barren',
  'ring-stuetz',
  'dips-ringe',
  'knieheben-haengend',
  'front-lever-gehockt',
  'front-lever-einbeinig',
  'front-lever',
  'deutscher-hang',
  'back-lever-gehockt',
  'back-lever',
]);
