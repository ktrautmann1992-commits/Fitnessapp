import { mat, wall } from './equipment';
import type { ExerciseIllustration } from './poses';
import {
  front,
  HANDS_ON_THIGHS,
  prone,
  QUADRUPED,
  seated,
  seatedFloor,
  supine,
  supineKneesBent,
} from './poses-yoga';
import type { PoseSpec, Prop } from './rig';

/**
 * Ausgangspositionen der neuen Yoga-, Pilates- und Mobility-Posen (Sportarten Stufe 1 · Restpunkte A, 27.10.2026,
 * docs/PLAN-SPORTARTEN-STUFE-1.md 4). Gleiche Figur und Regeln wie poses-yoga.ts. Block = kleiner Quader in Gerätefarbe.
 */

/** Yoga-Block am Boden (Welt-Koordinaten, linke untere Ecke). */
function block(x: number, h = 12, w = 18): Prop {
  return { t: 'rect', at: [x, 0], w, h, r: 1.5, role: 'equip' };
}

/** Seitlage von vorn (wie die Pilates-Seitlage in poses-yoga.ts). */
function sideLying(extra: Partial<PoseSpec>): PoseSpec {
  return {
    view: 'front',
    torso: 0,
    head: 0,
    near: { arm: [192, 190, 190], leg: [180, 180, 180] },
    far: { arm: [0, 0, 0], leg: [180, 180, 180] },
    props: [mat(-90, 70)],
    ...extra,
  };
}

export const YOGA_REST_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  // --- Yoga ------------------------------------------------------------------------------------------------------
  'yoga-katze-kuh': {
    pose: { ...QUADRUPED, torso: 18, head: -25 },
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, Rücken sanft rund, Kopf hängt locker.',
  },
  'yoga-sphinx': {
    pose: prone(22, { near: [-90, 0, 0], far: [-88, 2, 0] }),
    alt: 'Ausgangsposition: Bauchlage, Ellbogen unter den Schultern, Unterarme parallel nach vorn, Brust sanft angehoben.',
  },
  'yoga-palme': {
    pose: front({ near: [97, 93, 93], far: [83, 87, 87] }, undefined, [], { headOnTop: true }),
    alt: 'Ausgangsposition: von vorn – hüftbreit stehen, beide Arme lang über den Kopf gestreckt, Handflächen zueinander.',
  },
  'yoga-stuhlhaltung': {
    pose: {
      view: 'side',
      torso: 65,
      head: 70,
      near: { arm: [62, 62, 62], leg: [-25, -108, 0] },
      far: { arm: [60, 60, 60], leg: [-27, -106, 0] },
    },
    alt: 'Ausgangsposition: Knie gebeugt, Gesäß nach hinten wie beim Hinsetzen, Oberkörper leicht nach vorn, Arme nach vorn oben gestreckt.',
  },
  'yoga-krieger-3-wand': {
    pose: {
      view: 'side',
      torso: 2,
      head: 4,
      pelvis: [0, 68],
      near: { arm: [2, 2, 0], leg: [-90, -90, 0] },
      far: { arm: [0, 0, 0], leg: [182, 182, 90] },
      props: [wall(92, 7)],
    },
    alt: 'Ausgangsposition: Hände auf Hüfthöhe an der Wand, Oberkörper und ein Bein waagerecht in einer Linie, Standbein gerade.',
  },
  'yoga-adlerarme-sitzend': {
    pose: seated({ near: [15, 95, 95], far: [25, 100, 100] }),
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, Arme vor der Brust überkreuzt, Ellbogen auf Schulterhöhe, Unterarme nach oben.',
  },
  'yoga-halbe-vorbeuge-block': {
    pose: {
      view: 'side',
      torso: 8,
      head: 0,
      near: { arm: [-85, -88, -90], leg: [-86, -94, 0] },
      far: { arm: [-83, -87, -90], leg: [-88, -92, 0] },
      props: [block(32, 22, 14)],
    },
    alt: 'Ausgangsposition: aus der Hüfte nach vorn geneigt, Rücken lang und fast waagerecht, Hände auf einem Block, Knie leicht gebeugt.',
  },
  'yoga-dreieck-block': {
    pose: front(
      { near: [-90, -90, -90], far: [90, 90, 90] },
      { near: [-120, -120], far: [-60, -60] },
      [{ t: 'rect', at: { j: 'nearHand', dx: -7, dy: -18 }, w: 14, h: 16, r: 1.5, role: 'equip' }],
      { torso: 160, head: 160 },
    ),
    alt: 'Ausgangsposition: von vorn – breiter Stand, Oberkörper zur Seite geneigt, untere Hand auf einem Block, obere Hand zeigt nach oben.',
  },
  'yoga-sitzende-vorbeuge-block': {
    pose: {
      ...seatedFloor(
        { near: [-5, -15, -15], far: [-8, -15, -15] },
        { near: [8, -8, 90], far: [6, -6, 90] },
        45,
      ),
      rest: 8,
      props: [mat(-50, 90), block(-14, 8, 22)],
    },
    alt: 'Ausgangsposition: auf einem Block am Boden sitzen, Beine nach vorn mit leicht gebeugten Knien, Oberkörper mit langem Rücken nach vorn geneigt.',
  },
  'yoga-heldensitz-block': {
    pose: {
      view: 'side',
      torso: 90,
      pelvis: [0, 24],
      near: { arm: { ik: [18, 20], bend: 'back', end: 0 }, leg: [-33, 180, 180] },
      far: { arm: { ik: [16, 20], bend: 'back', end: 0 }, leg: [-35, 180, 180] },
      props: [mat(-60, 60), block(-10, 13, 20)],
    },
    alt: 'Ausgangsposition: kniend auf einem Block zwischen den Fersen sitzen, Oberkörper aufrecht, Hände auf den Oberschenkeln.',
  },
  'yoga-schulterbruecke-block': {
    pose: {
      view: 'side',
      torso: 200,
      head: 185,
      pelvis: [0, 27],
      near: { arm: [-10, 0, 0], leg: { ik: [30, 3.5], bend: 'up', end: 0 } },
      far: { arm: [-12, 0, 0], leg: { ik: [28, 3.5], bend: 'up', end: 0 } },
      props: [mat(-60, 60), block(-9, 9, 18)],
    },
    alt: 'Ausgangsposition: Rückenlage, Füße aufgestellt, Becken liegt auf einem flachen Block unter dem Kreuzbein, Arme neben dem Körper.',
  },
  'yoga-girlande-block': {
    pose: {
      view: 'side',
      torso: 80,
      head: 82,
      pelvis: [0, 22],
      near: { arm: [-40, 95, 95], leg: { ik: [16, 3.5], bend: 'up', end: 0 } },
      far: { arm: [-35, 100, 100], leg: { ik: [14, 3.5], bend: 'up', end: 0 } },
      props: [block(-12, 14, 20)],
    },
    alt: 'Ausgangsposition: tiefe Hocke, Gesäß auf einem Block, Fersen am Boden, Hände vor der Brust, Ellbogen innen an den Knien.',
  },
  'yoga-seitstreckung-kniend': {
    pose: {
      view: 'front',
      torso: 70,
      head: 60,
      pelvis: [0, 43],
      near: { arm: [70, 30, 30], leg: [-92, -90], legScale: [1, 0.12] },
      far: { arm: [-50, -60, -60], leg: [-35, -35] },
      props: [mat(-80, 80)],
    },
    alt: 'Ausgangsposition: von vorn – auf einem Knie, das andere Bein seitlich ausgestreckt, Oberkörper zur Seite geneigt, ein Arm über dem Kopf.',
  },

  // --- Pilates ---------------------------------------------------------------------------------------------------
  'pilates-brustkorb-heben': {
    pose: {
      ...supineKneesBent({ near: [60, 200, 200], far: [62, 202, 200] }),
      torso: 14,
      head: 30,
    },
    alt: 'Ausgangsposition: Rückenlage, Füße aufgestellt, Hände am Hinterkopf, Kopf und Schultern ein Stück angehoben.',
  },
  'pilates-knie-falten': {
    pose: {
      ...supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
      near: { arm: [182, 180, 180], leg: [90, 180, 180] },
    },
    alt: 'Ausgangsposition: Rückenlage, ein Fuß aufgestellt, das andere Bein im rechten Winkel angehoben, Arme neben dem Körper.',
  },
  'pilates-fersen-tippen': {
    pose: {
      ...supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
      far: { arm: [181, 180, 180], leg: [90, 180, 180] },
    },
    alt: 'Ausgangsposition: Rückenlage, ein Bein im rechten Winkel angehoben, die andere Ferse tippt auf die Matte, Arme neben dem Körper.',
  },
  'pilates-einbein-strecken': {
    pose: supine(
      { near: [100, 150, 150], far: [102, 152, 150] },
      { near: [155, 155, 150], far: [65, -160, -100] },
    ),
    alt: 'Ausgangsposition: Rückenlage, ein Knie zur Brust gezogen, das andere Bein schräg nach vorn oben gestreckt, Kopf bleibt am Boden.',
  },
  'pilates-schulterbruecke-marsch': {
    pose: {
      view: 'side',
      torso: 205,
      head: 190,
      pelvis: [0, 28],
      near: { arm: [-10, 0, 0], leg: [55, -40, 0] },
      far: { arm: [-12, 0, 0], leg: { ik: [28, 3.5], bend: 'up', end: 0 } },
      props: [mat(-60, 60)],
    },
    alt: 'Ausgangsposition: Brücke – Becken angehoben, ein Fuß am Boden, der andere Fuß knapp über der Matte, Arme neben dem Körper.',
  },
  'pilates-unterarmstuetz-knie': {
    pose: {
      view: 'side',
      torso: 14,
      head: 14,
      near: { arm: [-90, 0, 0], leg: [205, 180, 180] },
      far: { arm: [-88, 2, 0], leg: [206, 180, 180] },
      props: [mat(-60, 80)],
    },
    alt: 'Ausgangsposition: Unterarme und Knie auf der Matte, Ellbogen unter den Schultern, Körper von Kopf bis Knie in einer Linie.',
  },
  'pilates-vierfuessler-arm-bein': {
    pose: {
      ...QUADRUPED,
      near: { arm: [10, 10, 10], leg: [-90, 180, 180] },
      far: { arm: [-88, -92, 0], leg: [180, 180, 180] },
    },
    alt: 'Ausgangsposition: Vierfüßlerstand, ein Arm lang nach vorn und das gegenüberliegende Bein lang nach hinten gestreckt.',
  },
  'pilates-beinkreise-seitlage': {
    pose: sideLying({ near: { arm: [192, 190, 190], leg: [168, 172, 172] } }),
    alt: 'Ausgangsposition: von vorn – in Seitlage, Kopf auf dem unteren Arm, das obere Bein auf Hüfthöhe angehoben.',
  },
  'pilates-ruecken-strecken-bauchlage': {
    pose: prone(16, { near: [190, 182, 182], far: [188, 181, 181] }),
    alt: 'Ausgangsposition: Bauchlage, Arme lang neben dem Körper, Brust und Kopf ein kleines Stück angehoben, Blick zum Boden.',
  },
  'pilates-wirbelsaeule-drehen-sitzend': {
    pose: seatedFloor(
      { near: [2, 2, 2], far: [178, 178, 178] },
      { near: [0, 0, 90], far: [2, 0, 90] },
      90,
    ),
    alt: 'Ausgangsposition: aufrecht am Boden sitzen, Beine nach vorn, Arme waagerecht zur Seite gestreckt, Oberkörper leicht gedreht.',
  },
  'pilates-meerjungfrau': {
    pose: front(
      { near: [75, 40, 40], far: [-55, -70, -70] },
      { near: [-165, -20], far: [-150, -30] },
      [mat(-80, 80)],
      { torso: 105, head: 100 },
    ),
    alt: 'Ausgangsposition: von vorn – seitlich sitzen, Knie zu einer Seite gebeugt, eine Hand am Boden, der andere Arm über dem Kopf zur Seite gestreckt.',
  },
  'pilates-stehend-beinkreisen': {
    pose: front({ near: [180, -90, -90], far: [-84, -87] }, { near: [-90, -90], far: [-70, -72] }, [
      wall(-58, 7),
    ]),
    alt: 'Ausgangsposition: von vorn – seitlich an einer Wand stehen, eine Hand stützt, ein Bein gestreckt knapp über dem Boden.',
  },
  'pilates-wandstuetz': {
    pose: {
      view: 'side',
      torso: 52,
      head: 52,
      pelvis: [0, 58],
      near: { arm: [0, 90, 90], leg: [-128, -128, 0] },
      far: { arm: [2, 88, 88], leg: [-126, -126, 0] },
      props: [wall(50, 7)],
    },
    alt: 'Ausgangsposition: Unterarme auf Schulterhöhe an der Wand, Füße einen großen Schritt zurück, Körper in einer schrägen Linie.',
  },

  // --- Mobility --------------------------------------------------------------------------------------------------
  'mobility-schulterkreisen': {
    pose: front({ near: [-100, -95], far: [-80, -85] }, undefined, [], { head: 92 }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Arme locker hängen, die Schultern kreisen langsam nach hinten.',
  },
  'mobility-hueftkreisen': {
    pose: front(
      { near: [-140, -20, -20], far: [-40, -160, -160] },
      { near: [-95, -92], far: [-85, -88] },
    ),
    alt: 'Ausgangsposition: von vorn – hüftbreit stehen, Knie locker, Hände an der Hüfte.',
  },
  'mobility-sprunggelenk-kreisen-sitzend': {
    pose: seated(HANDS_ON_THIGHS, {
      near: [8, -45, -20],
      far: { ik: [29, 3.5], bend: 'up', end: 0 },
    }),
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, ein Fuß leicht angehoben und locker, der andere Fuß am Boden.',
  },
  'mobility-handgelenke-kreisen': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [-60, 20, 20], leg: [-88, -91, 0] },
      far: { arm: [-62, 18, 18], leg: [-92, -89, 0] },
    },
    alt: 'Ausgangsposition: aufrecht stehen, Ellbogen gebeugt, Unterarme vor dem Körper, Hände locker verschränkt.',
  },
  'mobility-katze-kuh-stuhl': {
    pose: seated(
      {
        near: { ik: [26, 40], bend: 'down', end: 0 },
        far: { ik: [24, 40], bend: 'down', end: 0 },
      },
      undefined,
      { torso: 100, head: 65 },
    ),
    alt: 'Ausgangsposition: auf der vorderen Hälfte eines Stuhls sitzen, Hände auf den Knien, Rücken sanft rund, Kinn Richtung Brust.',
  },
  'mobility-buch-oeffnen-seitlage': {
    pose: sideLying({
      near: { arm: [92, 90, 90], leg: [190, 150, 150] },
      far: { arm: [0, 0, 0], leg: [200, 160, 160] },
    }),
    alt: 'Ausgangsposition: von vorn – in Seitlage, Knie gebeugt, der obere Arm öffnet sich nach oben zur anderen Seite.',
  },
  'mobility-hueftbeuger-kniend': {
    pose: {
      view: 'side',
      torso: 92,
      pelvis: [0, 40],
      near: {
        arm: [-110, -30, -30],
        leg: { ik: [30, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: [-112, -32, -30],
        leg: { ik: [-38, 6], bend: 'down', end: 180 },
      },
      props: [mat(-75, 60)],
    },
    alt: 'Ausgangsposition: kniender Ausfallschritt, hinteres Knie auf der Matte, Oberkörper aufrecht, Hände an der Hüfte, Becken sanft nach vorn.',
  },
  'mobility-wade-wand': {
    pose: {
      view: 'side',
      torso: 75,
      head: 78,
      near: { arm: [20, 20, 90], leg: [-65, -100, 0] },
      far: { arm: [18, 18, 90], leg: [-118, -118, -20] },
      props: [wall(52, 7)],
    },
    alt: 'Ausgangsposition: Hände an der Wand, vorderes Knie gebeugt, hinteres Bein gestreckt mit der Ferse am Boden.',
  },
};
