import { band, chair, mat, wall } from './equipment';
import type { ExerciseIllustration } from './poses';
import type { Limb, PoseSpec, Prop, SidePose } from './rig';

/**
 * Ausgangspositionen der Yoga-, Pilates- und Mobility-Entwürfe (Sportarten Stufe 1 · Etappe Y,
 * docs/PLAN-SPORTARTEN-STUFE-1.md 4). Gleiche Figur und Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026):
 * Winkel absolut in Grad, 0 = nach vorn, 90 = nach oben. Halteposen zeigen die gehaltene Position.
 */

// ---------------------------------------------------------------------------------------------------------------
// Grundhaltungen
// ---------------------------------------------------------------------------------------------------------------

function front(
  arms: { near: Limb; far: Limb },
  legs: { near: Limb; far: Limb } = { near: [-88, -90], far: [-92, -90] },
  props: Prop[] = [],
  extra: Partial<PoseSpec> = {},
): PoseSpec {
  return {
    view: 'front',
    torso: 90,
    near: { arm: arms.near, leg: legs.near },
    far: { arm: arms.far, leg: legs.far },
    props,
    ...extra,
  };
}

/** Vierfüßlerstand (Hände unter den Schultern, Knie unter der Hüfte). */
const QUADRUPED: PoseSpec = {
  view: 'side',
  torso: 16,
  head: 16,
  near: { arm: [-90, -90, 0], leg: [-90, 180, 180] },
  far: { arm: [-88, -92, 0], leg: [-92, 180, 180] },
  props: [mat(-60, 70)],
};

/** Rückenlage, Kopf rechts (Beine gestreckt). */
function supine(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  legs: { near: SidePose['leg']; far: SidePose['leg'] } = {
    near: [180, 180, 90],
    far: [181, 180, 90],
  },
  props: Prop[] = [mat(-90, 70)],
  extra: Partial<PoseSpec> = {},
): PoseSpec {
  return {
    view: 'side',
    torso: 0,
    head: 2,
    near: { arm: arms.near, leg: legs.near },
    far: { arm: arms.far, leg: legs.far },
    props,
    ...extra,
  };
}

/** Rückenlage mit aufgestellten Füßen (Becken fest, Füße per Zielpunkt). */
function supineKneesBent(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  props: Prop[] = [mat(-70, 70)],
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

/** Bauchlage, Kopf rechts, Oberkörper leicht angehoben (Unterarme am Boden). */
function prone(torso: number, arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso,
    head: torso - 5,
    near: { arm: arms.near, leg: [180, 180, 180] },
    far: { arm: arms.far, leg: [181, 180, 180] },
    props: [mat(-80, 60), ...props],
  };
}

/** Aufrecht auf einem Stuhl sitzen (Stuhl links, Blick nach rechts). */
function seated(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  legs?: { near: SidePose['leg']; far: SidePose['leg'] },
  extra: Partial<PoseSpec> = {},
): PoseSpec {
  return {
    view: 'side',
    torso: 92,
    pelvis: [0, 41],
    near: { arm: arms.near, leg: legs?.near ?? { ik: [31, 3.5], bend: 'up', end: 0 } },
    far: { arm: arms.far, leg: legs?.far ?? { ik: [29, 3.5], bend: 'up', end: 0 } },
    props: [...chair(-22, 1, 33, 28)],
    ...extra,
  };
}
const HANDS_ON_THIGHS = {
  near: { ik: [22, 38], bend: 'down', end: 0 } as SidePose['arm'],
  far: { ik: [20, 38], bend: 'down', end: 0 } as SidePose['arm'],
};

/** Aufrecht am Boden sitzen, Beine nach vorn. */
function seatedFloor(
  arms: { near: SidePose['arm']; far: SidePose['arm'] },
  legs: { near: Limb; far: Limb },
  torso = 88,
): PoseSpec {
  return {
    view: 'side',
    torso,
    near: { arm: arms.near, leg: legs.near },
    far: { arm: arms.far, leg: legs.far },
    props: [mat(-50, 90)],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Posen
// ---------------------------------------------------------------------------------------------------------------

export const YOGA_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  // --- Yoga im Stehen --------------------------------------------------------------------------------------------
  'yoga-berghaltung': {
    pose: front({ near: [-96, -93], far: [-84, -87] }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, Füße hüftbreit, Arme locker neben dem Körper, Schultern entspannt.',
  },
  'yoga-baum': {
    pose: front(
      { near: [-80, 60, 90], far: [-100, 120, 90] },
      { near: [-90, -90], far: [-65, 205] },
    ),
    alt: 'Ausgangsposition: von vorn – auf einem Bein stehen, die Fußsohle des anderen Beins liegt am Unterschenkel, Knie zeigt zur Seite, Hände vor der Brust.',
  },
  'yoga-baum-wand': {
    pose: front({ near: [180, -90, -90], far: [-84, -87] }, { near: [-90, -90], far: [-80, 215] }, [
      wall(-58, 7),
    ]),
    alt: 'Ausgangsposition: von vorn – seitlich neben einer Wand auf einem Bein stehen, eine Hand an der Wand, die Ferse des anderen Fußes am Knöchel des Standbeins.',
  },
  'yoga-krieger-1': {
    pose: {
      view: 'side',
      torso: 90,
      near: { arm: [92, 92, 92], leg: [-35, -90, 0] },
      far: { arm: [88, 88, 88], leg: [-120, -120, -20] },
    },
    alt: 'Ausgangsposition: großer Ausfallschritt, vorderes Knie über dem Knöchel gebeugt, hinteres Bein gestreckt mit der Ferse am Boden, Arme gestreckt über dem Kopf.',
  },
  'yoga-krieger-2': {
    pose: front({ near: [180, 180], far: [0, 0] }, { near: [-130, -95], far: [-60, -60] }),
    alt: 'Ausgangsposition: von vorn – breiter Stand, ein Knie über dem Knöchel gebeugt, das andere Bein gestreckt, Arme waagerecht zur Seite gestreckt.',
  },
  'yoga-krieger-2-stuhl': {
    pose: seated(
      { near: [5, 5, 5], far: [175, 175, 175] },
      {
        near: { ik: [31, 3.5], bend: 'up', end: 0 },
        far: { ik: [-52, 4.5], bend: 'down', end: 0 },
      },
    ),
    alt: 'Ausgangsposition: seitlich auf der Kante eines Stuhls sitzen, vorderes Bein gebeugt, hinteres Bein nach hinten gestreckt, Arme waagerecht nach vorn und hinten.',
  },
  'yoga-dreieck': {
    pose: front(
      { near: [-90, -90, -90], far: [90, 90, 90] },
      { near: [-120, -120], far: [-60, -60] },
      [],
      { torso: 175, head: 175 },
    ),
    alt: 'Ausgangsposition: von vorn – breiter Stand mit gestreckten Beinen, Oberkörper zur Seite geneigt, untere Hand am Schienbein, obere Hand zeigt nach oben.',
  },
  'yoga-herabschauender-hund': {
    pose: {
      view: 'side',
      torso: -45,
      head: -60,
      near: { arm: [-65, -65, 0], leg: [-112, -112, -35] },
      far: { arm: [-63, -66, 0], leg: [-110, -113, -35] },
      props: [mat(-70, 80)],
    },
    alt: 'Ausgangsposition: umgedrehtes V – Hände schulterbreit am Boden, Arme gestreckt, Gesäß hoch, Beine lang, Kopf zwischen den Armen.',
  },
  'yoga-hund-an-der-wand': {
    pose: {
      view: 'side',
      torso: 5,
      head: 3,
      near: { arm: [5, 5, 0], leg: [-88, -91, 0] },
      far: { arm: [3, 4, 0], leg: [-92, -89, 0] },
      props: [wall(58, 8)],
    },
    alt: 'Ausgangsposition: Hände auf Hüfthöhe an einer Wand, Hüfte nach hinten geschoben, Rücken lang und waagerecht, Beine fast gestreckt.',
  },
  'yoga-seitneige-stehend': {
    pose: front({ near: [-96, -93], far: [70, 120, 130] }, undefined, [], {
      torso: 100,
      head: 105,
    }),
    alt: 'Ausgangsposition: von vorn – aufrecht stehen, ein Arm über dem Kopf gestreckt, der Oberkörper neigt sich zur Seite, die andere Hand an der Hüfte.',
  },
  'yoga-vorbeuge-stehend': {
    pose: {
      view: 'side',
      // Restpunkte E (27.10.2026): Rücken als klare Schräge vor den Beinen (vorher lag der Rumpf verdeckt auf den
      // Oberschenkeln), Hände hängen vor den Füßen Richtung Boden.
      torso: -28,
      head: -70,
      near: { arm: [-92, -94, -94], leg: [-80, -98, 0] },
      far: { arm: [-90, -93, -94], leg: [-82, -97, 0] },
    },
    alt: 'Ausgangsposition: stehend aus der Hüfte nach vorn beugen, Knie leicht gebeugt, Arme und Kopf hängen locker Richtung Boden.',
  },
  'yoga-vorbeuge-stuhl': {
    pose: {
      view: 'side',
      torso: 5,
      head: 3,
      near: { arm: [-25, -25, 0], leg: [-88, -91, 0] },
      far: { arm: [-27, -26, 0], leg: [-92, -89, 0] },
      props: [...chair(46, -1, 33, 28)],
    },
    alt: 'Ausgangsposition: vor einem Stuhl stehen, Hände auf der Lehne, Oberkörper mit langem Rücken nach vorn geneigt, Knie leicht gebeugt.',
  },
  'pilates-abrollen-stehend': {
    pose: {
      view: 'side',
      // Restpunkte E: Rumpf etwas flacher und vor den Beinen, damit das Abrollen lesbar ist.
      torso: -40,
      head: -95,
      near: { arm: [-93, -93, -93], leg: [-78, -100, 0] },
      far: { arm: [-91, -95, -93], leg: [-80, -98, 0] },
    },
    alt: 'Ausgangsposition: im Stand Wirbel für Wirbel nach vorn abgerollt, Kinn zur Brust, Arme hängen locker, Knie leicht gebeugt.',
  },

  // --- Yoga und Mobility am Boden ----------------------------------------------------------------------------------
  'yoga-kindhaltung': {
    pose: {
      view: 'side',
      torso: -18,
      head: -12,
      pelvis: [-10, 26],
      near: { arm: [-12, -4, -4], leg: { ik: [-34, 3.5], bend: 'up', end: 180 } },
      far: { arm: [-7, -6, -6], leg: { ik: [-36, 3.5], bend: 'up', end: 180 } },
      props: [mat(-60, 80)],
    },
    alt: 'Ausgangsposition: kniend, Gesäß Richtung Fersen gesunken, Oberkörper auf den Oberschenkeln, Arme lang nach vorn auf der Matte.',
  },
  'yoga-kobra-sanft': {
    pose: prone(30, { near: [-90, 0, 0], far: [-88, 2, 0] }),
    alt: 'Ausgangsposition: Bauchlage, Oberkörper leicht angehoben, Unterarme und Hände am Boden, Beine lang nach hinten.',
  },
  'pilates-schwan-sanft': {
    pose: prone(22, { near: [-95, 0, 0], far: [-93, 2, 0] }),
    alt: 'Ausgangsposition: Bauchlage, Kopf und Brust ein kleines Stück angehoben, Hände neben den Schultern, Beine lang.',
  },
  'pilates-schwimmen': {
    pose: {
      view: 'side',
      torso: 4,
      head: 6,
      near: { arm: [8, 8, 8], leg: [184, 184, 184] },
      far: { arm: [2, 2, 2], leg: [178, 178, 178] },
      props: [mat(-80, 90)],
    },
    alt: 'Ausgangsposition: Bauchlage, Arme lang nach vorn, Arme und Beine knapp über der Matte angehoben, Blick zum Boden.',
  },
  'yoga-taube': {
    pose: {
      view: 'side',
      torso: 85,
      near: { arm: [-75, -30, -30], leg: [-5, 175, 175] },
      far: { arm: [-80, -35, -30], leg: [182, 180, 180] },
      props: [mat(-75, 50)],
    },
    alt: 'Ausgangsposition: vorderes Bein angewinkelt vor dem Körper auf der Matte, hinteres Bein lang nach hinten, Oberkörper aufrecht, Hände neben der Hüfte.',
  },
  'yoga-tiefer-ausfallschritt': {
    pose: {
      view: 'side',
      torso: 88,
      pelvis: [0, 40],
      near: {
        arm: { ik: [26, 40], bend: 'down', end: 0 },
        leg: { ik: [30, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [24, 40], bend: 'down', end: 0 },
        leg: { ik: [-42, 6], bend: 'down', end: 180 },
      },
      props: [mat(-75, 60)],
    },
    alt: 'Ausgangsposition: kniender Ausfallschritt, vorderer Fuß flach am Boden, hinteres Knie auf der Matte, Oberkörper aufrecht, Hände auf dem vorderen Knie.',
  },
  'yoga-drehsitz': {
    pose: seatedFloor(
      { near: [-120, -95, -90], far: [-40, -10, 0] },
      { near: [55, -60, 0], far: [0, 0, 90] },
      90,
    ),
    alt: 'Ausgangsposition: aufrecht am Boden sitzen, ein Bein gestreckt, das andere aufgestellt, Oberkörper zum aufgestellten Knie gedreht, eine Hand hinter dem Becken.',
  },
  'yoga-schmetterling': {
    pose: front(
      { near: [-75, -80, -60], far: [-105, -100, -120] },
      { near: [-170, -20], far: [-10, -160] },
      [mat(-80, 80)],
    ),
    alt: 'Ausgangsposition: von vorn – aufrecht am Boden sitzen, Fußsohlen aneinander, Knie fallen zur Seite, Hände umfassen die Füße.',
  },
  'pilates-wirbelsaeule-dehnen-sitzend': {
    pose: seatedFloor(
      { near: [10, 10, 10], far: [8, 8, 8] },
      { near: [0, 0, 90], far: [2, 0, 90] },
      75,
    ),
    alt: 'Ausgangsposition: aufrecht am Boden sitzen, Beine gestreckt etwas mehr als hüftbreit, Arme lang nach vorn auf Schulterhöhe.',
  },
  'pilates-saege': {
    pose: front({ near: [180, 180], far: [0, 0] }, { near: [-150, -150], far: [-30, -30] }, [
      mat(-90, 90),
    ]),
    alt: 'Ausgangsposition: von vorn – im Grätschsitz aufrecht sitzen, Beine gestreckt und gespreizt, Arme waagerecht zur Seite.',
  },
  'mobility-hueft-90-90': {
    pose: front(
      { near: [-120, -100, -90], far: [-60, -80, -90] },
      { near: [-160, -90], far: [-20, -90] },
      [mat(-80, 80)],
      { torso: 95 },
    ),
    alt: 'Ausgangsposition: von vorn – am Boden sitzen, beide Beine im rechten Winkel nach einer Seite abgelegt, Hände hinter dem Körper aufgestützt.',
  },
  'mobility-brustwirbel-drehung-vierfuessler': {
    pose: {
      ...QUADRUPED,
      far: { arm: [150, -30, -30], leg: [-92, 180, 180] },
    },
    alt: 'Ausgangsposition: Vierfüßlerstand, Hände unter den Schultern, Knie unter der Hüfte, eine Hand liegt am Hinterkopf, Ellbogen zeigt zur Seite.',
  },
  'mobility-weltbeste-dehnung': {
    pose: {
      view: 'side',
      torso: 30,
      head: 25,
      pelvis: [0, 40],
      near: {
        arm: { ik: [40, 3], bend: 'back', end: 0 },
        leg: { ik: [34, 3.5], bend: 'up', end: 0 },
      },
      far: {
        arm: { ik: [38, 3], bend: 'back', end: 0 },
        leg: { ik: [-60, 6], bend: 'down', end: 180 },
      },
      props: [mat(-75, 65)],
    },
    alt: 'Ausgangsposition: tiefer Ausfallschritt, beide Hände innen neben dem vorderen Fuß am Boden, hinteres Bein lang, Knie darf abgelegt sein.',
  },
  'mobility-frosch-schaukel': {
    pose: {
      view: 'side',
      torso: 10,
      head: 10,
      near: { arm: [-90, 0, 0], leg: [-90, 180, 180] },
      far: { arm: [-88, 2, 0], leg: [-92, 180, 180] },
      props: [mat(-60, 70)],
    },
    alt: 'Ausgangsposition: Vierfüßlerstand auf den Unterarmen, Knie weit geöffnet, Rücken lang, Gesäß über den Knien.',
  },
  'mobility-knie-zur-wand': {
    pose: {
      view: 'side',
      torso: 88,
      pelvis: [0, 66],
      near: { arm: [15, 15, 90], leg: { ik: [22, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [13, 13, 90], leg: { ik: [-12, 3.5], bend: 'fwd', end: 0 } },
      props: [wall(52, 8)],
    },
    alt: 'Ausgangsposition: vor einer Wand stehen, Hände an der Wand, vorderer Fuß eine Handbreit vor der Wand, Knie schiebt Richtung Wand, Ferse am Boden.',
  },
  'mobility-wandengel': {
    pose: front({ near: [180, 90, 90], far: [0, 90, 90] }, undefined, [], { headOnTop: true }),
    alt: 'Ausgangsposition: von vorn – mit dem Rücken an einer Wand stehen, Oberarme waagerecht zur Seite, Unterarme senkrecht nach oben an der Wand.',
  },
  'mobility-nacken-seitneige': {
    pose: seated(HANDS_ON_THIGHS, undefined, { head: 75 }),
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, Hände auf den Oberschenkeln, Kopf sanft zur Seite geneigt, Schultern locker.',
  },

  // --- Rückenlage ------------------------------------------------------------------------------------------------
  'yoga-schulterbruecke': {
    pose: {
      view: 'side',
      torso: 205,
      head: 190,
      pelvis: [0, 28],
      near: { arm: [-10, 0, 0], leg: { ik: [30, 3.5], bend: 'up', end: 0 } },
      far: { arm: [-12, 0, 0], leg: { ik: [28, 3.5], bend: 'up', end: 0 } },
      props: [mat(-60, 60)],
    },
    alt: 'Ausgangsposition: Rückenlage, Füße hüftbreit aufgestellt, Becken angehoben, Schultern, Hüfte und Knie bilden eine Linie, Arme neben dem Körper.',
  },
  'pilates-schulterbruecke-abrollen': {
    pose: supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
    alt: 'Ausgangsposition: Rückenlage, Knie gebeugt, Füße hüftbreit nah am Gesäß, Arme neben dem Körper abgelegt.',
  },
  'pilates-beckenkippen': {
    pose: supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
    alt: 'Ausgangsposition: Rückenlage, Knie aufgestellt, Füße hüftbreit am Boden, Arme neben dem Körper, unterer Rücken entspannt.',
  },
  'yoga-knie-zur-brust': {
    pose: supine(
      { near: [100, 150, 150], far: [102, 152, 150] },
      { near: [65, -160, -100], far: [63, -158, -100] },
    ),
    alt: 'Ausgangsposition: Rückenlage, beide Knie zur Brust gezogen, Hände an den Schienbeinen, Kopf am Boden.',
  },
  'pilates-tischbein-wechsel': {
    pose: supine(
      { near: [182, 180, 180], far: [181, 180, 180] },
      { near: [90, 180, 180], far: [92, 181, 180] },
    ),
    alt: 'Ausgangsposition: Rückenlage, Hüfte und Knie im rechten Winkel, Unterschenkel waagerecht, Arme neben dem Körper.',
  },
  'pilates-hundert-gehockt': {
    pose: supine(
      { near: [190, 182, 180], far: [188, 181, 180] },
      { near: [100, 175, 175], far: [102, 176, 175] },
      [mat(-70, 70)],
      { torso: 15, head: 25 },
    ),
    alt: 'Ausgangsposition: Rückenlage, Beine angewinkelt angehoben, Kopf und Schultern leicht angehoben, Arme lang neben dem Körper knapp über der Matte.',
  },
  'pilates-einbeinkreisen': {
    pose: {
      ...supineKneesBent({ near: [182, 180, 180], far: [181, 180, 180] }),
      near: { arm: [182, 180, 180], leg: [95, 95, 100] },
    },
    alt: 'Ausgangsposition: Rückenlage, ein Fuß aufgestellt, das andere Bein gestreckt nach oben, Arme neben dem Körper.',
  },
  'yoga-liegende-drehung': {
    pose: supine(
      { near: [182, 180, 180], far: [178, 180, 180] },
      { near: [135, -100, -100], far: [133, -102, -100] },
    ),
    alt: 'Ausgangsposition: Rückenlage, Knie angewinkelt und zur Seite gesunken, Arme seitlich auf Schulterhöhe abgelegt, Schultern am Boden.',
  },
  'yoga-entspannung-rueckenlage': {
    pose: supine({ near: [185, 182, 182], far: [183, 181, 181] }),
    alt: 'Ausgangsposition: flach auf dem Rücken liegen, Beine locker ausgestreckt, Arme etwas vom Körper entfernt abgelegt.',
  },
  'yoga-beine-an-der-wand': {
    pose: supine(
      { near: [185, 182, 182], far: [183, 181, 181] },
      { near: [92, 92, 0], far: [90, 90, 0] },
      [mat(-60, 80), wall(-26, 8)],
    ),
    alt: 'Ausgangsposition: Rückenlage nah an einer Wand, Beine gestreckt senkrecht an der Wand, Arme locker neben dem Körper.',
  },
  'mobility-beinrueckseite-band-liegend': {
    pose: {
      ...supineKneesBent({ near: [120, 100, 100], far: [181, 180, 180] }),
      near: { arm: [125, 105, 105], leg: [95, 95, 10] },
      props: [mat(-70, 70), band([{ j: 'nearWrist' }, { j: 'nearToe' }])],
    },
    alt: 'Ausgangsposition: Rückenlage, ein Fuß aufgestellt, das andere Bein gestreckt nach oben, ein Widerstandsband um den Fuß, beide Hände halten das Band.',
  },

  // --- Seitlage --------------------------------------------------------------------------------------------------
  'pilates-seitliegend-beinheben': {
    pose: {
      view: 'front',
      torso: 0,
      head: 0,
      near: { arm: [192, 190, 190], leg: [174, 180, 180] },
      far: { arm: [0, 0, 0], leg: [180, 180, 180] },
      props: [mat(-90, 70)],
    },
    alt: 'Ausgangsposition: von vorn – in Seitlage, Kopf auf dem unteren Arm, Beine gestreckt übereinander, oberer Arm liegt am Körper.',
  },
  'pilates-muschel': {
    pose: {
      view: 'front',
      torso: 0,
      head: 0,
      near: { arm: [192, 190, 190], leg: [190, 150, 150] },
      far: { arm: [0, 0, 0], leg: [200, 160, 160] },
      props: [mat(-90, 70)],
    },
    alt: 'Ausgangsposition: von vorn – in Seitlage, Knie gebeugt, Füße auf einer Linie mit dem Gesäß, Kopf auf dem unteren Arm.',
  },

  // --- Auf dem Stuhl und an der Wand ------------------------------------------------------------------------------
  'yoga-kindhaltung-sitzend': {
    pose: seated(
      { near: { ik: [26, 44], bend: 'down', end: 0 }, far: { ik: [24, 44], bend: 'down', end: 0 } },
      undefined,
      { torso: 60, head: 50 },
    ),
    alt: 'Ausgangsposition: auf einem Stuhl sitzen, mit langem Rücken leicht nach vorn geneigt, Unterarme auf den Oberschenkeln, Blick zum Boden.',
  },
  'yoga-brustoeffner-stuhl': {
    pose: seated(
      {
        near: { ik: [-14, 36], bend: 'back', end: 0 },
        far: { ik: [-16, 36], bend: 'back', end: 0 },
      },
      undefined,
      { torso: 95, head: 95 },
    ),
    alt: 'Ausgangsposition: auf der vorderen Hälfte eines Stuhls sitzen, Hände hinter dem Gesäß an der Sitzfläche, Brustbein angehoben.',
  },
  'yoga-drehsitz-stuhl': {
    pose: seated({
      near: { ik: [22, 38], bend: 'down', end: 0 },
      far: { ik: [-16, 60], bend: 'back', end: 90 },
    }),
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, Oberkörper sanft zur Seite gedreht, eine Hand am Knie, die andere an der Rückenlehne.',
  },
  'yoga-seitneige-stuhl': {
    pose: seated(
      { near: [-95, -95, -95], far: { ik: [6, 52], bend: 'back', end: -90 } },
      undefined,
      {
        head: 95,
      },
    ),
    alt: 'Ausgangsposition: aufrecht auf einem Stuhl sitzen, eine Hand hängt seitlich neben dem Stuhl, die andere liegt an der Hüfte.',
  },
  'yoga-hueftbeuger-stuhl': {
    pose: seated(
      {
        near: { ik: [-14, 62], bend: 'down', end: 0 },
        far: { ik: [22, 38], bend: 'down', end: 0 },
      },
      {
        near: { ik: [-48, 4], bend: 'down', end: -20 },
        far: { ik: [31, 3.5], bend: 'up', end: 0 },
      },
    ),
    alt: 'Ausgangsposition: seitlich auf der Kante eines Stuhls sitzen, vorderes Bein gebeugt, hinteres Bein nach hinten gestreckt mit dem Fußballen am Boden, eine Hand an der Lehne.',
  },
  'yoga-entspannung-sitzend': {
    pose: seated(HANDS_ON_THIGHS),
    alt: 'Ausgangsposition: bequem und aufrecht auf einem Stuhl sitzen, Füße am Boden, Hände locker auf den Oberschenkeln.',
  },
  'pilates-rumpf-atmung-sitzend': {
    pose: seated({ near: [-95, 35, 35], far: [-97, 33, 33] }),
    alt: 'Ausgangsposition: aufrecht auf der vorderen Hälfte eines Stuhls sitzen, Füße hüftbreit, Hände seitlich an den unteren Rippen.',
  },
};
