import { band, dumbbellSide, handle, kettlebell, wall } from './equipment';
import { EXERCISE_ILLUSTRATIONS, type ExerciseIllustration } from './poses';
import { pullTop } from './poses-calisthenics';
import { rowingMachine } from './poses-rowing';
import {
  BODY,
  buildScene,
  type Joint,
  type Limb,
  type LimbTarget,
  placeSkeleton,
  type PoseSpec,
  type Prop,
  type SidePose,
  VIEW_MARGIN,
  VIEW_WIDTH,
} from './rig';

/**
 * Endpositionen (Gründer-Feedback 14.11.2026, docs/PLAN-WORKOUTS.md Abschnitt 4 „Workout-Player“): zweites Bild je
 * Übung – der Umkehrpunkt der Bewegung (Liegestütz unten, Kniebeuge tief, Klimmzug oben …). Der Workout-Timer blendet
 * Ausgangs- und Endposition im Sekundentakt ineinander (wie ein GIF); bei „Bewegung reduzieren“ bleibt das Startbild.
 *
 * Gleiche Figur, Regeln und Ansichtsbox wie poses.ts (Gründer-Entscheidung B, 21.10.2026). Jede Endposition entsteht aus
 * der Ausgangsposition (`move`): nur geänderte Winkel werden angegeben, Hände bzw. Füße können an ihrer Stelle bleiben
 * (`keep` – inverse Kinematik zum Gelenk der Ausgangsposition). Der Generator zeichnet sie mit derselben waagerechten
 * Verschiebung wie das Startbild, damit Boden, Geräte und Füße beim Überblenden stillstehen.
 *
 * Umfang (Gründer-Vorgabe 14.11.2026): JEDE Übung, die in einem Workout vorkommt, hat eine Endposition (Test in
 * illustrations.test.ts). Bewegte Übungen: eigener Umkehrpunkt (EXERCISE_END_ILLUSTRATIONS unten, von Hand). Halte-,
 * Trage-, Dehn- und Flow-Übungen (END_BREATH_IDS): „Atem-Variante“ – dieselbe Haltung, Kopf und freie Arme geben beim
 * Ausatmen leicht nach (settle). Das Bild bewegt sich ruhig mit, täuscht aber keine Wiederholung vor. Diese Liste ist
 * ein Startbestand: bewegte Flow-Übungen (z. B. Pilates-Beinkreise) bekommen nach und nach einen echten Umkehrpunkt.
 */

/** Übungen mit Atem-Variante als Endposition (siehe oben) – Halten, Tragen, Dehnen, Flow-Posen. */
export const END_BREATH_IDS: readonly string[] = [
  'adduktoren-dehnen-stehend',
  'beinrueckseite-dehnen-sitzend',
  'brustdehnung-tuerrahmen',
  'copenhagen-seitstuetz-knie',
  'einbeinstand-laeufer',
  'farmers-carry-kettlebell',
  'farmers-carry-kurzhantel',
  'gesaess-dehnen-sitzend',
  'handtuch-rudern-isometrisch',
  'hollow-body-gehockt',
  'hollow-body-halten',
  'hueftkreisen-stehend',
  'hyrox-rudergeraet',
  'katze-kuh',
  'koffer-tragen-einarmig',
  'marschieren-auf-der-stelle',
  'mobility-beinrueckseite-band-liegend',
  'mobility-brustwirbel-drehung-vierfuessler',
  'mobility-buch-oeffnen-seitlage',
  'mobility-frosch-schaukel',
  'mobility-handgelenke-kreisen',
  'mobility-hueft-90-90',
  'mobility-hueftbeuger-kniend',
  'mobility-hueftkreisen',
  'mobility-katze-kuh-stuhl',
  'mobility-knie-zur-wand',
  'mobility-nacken-seitneige',
  'mobility-schulterkreisen',
  'mobility-sprunggelenk-kreisen-sitzend',
  'mobility-wade-wand',
  'mobility-wandengel',
  'mobility-weltbeste-dehnung',
  'oberschenkel-vorderseite-dehnen',
  'pallof-press-band',
  'pilates-abrollen-stehend',
  'pilates-beckenkippen',
  'pilates-beinkreise-seitlage',
  'pilates-brustkorb-heben',
  'pilates-einbein-strecken',
  'pilates-einbeinkreisen',
  'pilates-fersen-tippen',
  'pilates-hundert-gehockt',
  'pilates-knie-falten',
  'pilates-meerjungfrau',
  'pilates-muschel',
  'pilates-ruecken-strecken-bauchlage',
  'pilates-rumpf-atmung-sitzend',
  'pilates-saege',
  'pilates-schulterbruecke-abrollen',
  'pilates-schulterbruecke-marsch',
  'pilates-schwan-sanft',
  'pilates-schwimmen',
  'pilates-seitliegend-beinheben',
  'pilates-stehend-beinkreisen',
  'pilates-tischbein-wechsel',
  'pilates-unterarmstuetz-knie',
  'pilates-vierfuessler-arm-bein',
  'pilates-wandstuetz',
  'pilates-wirbelsaeule-dehnen-sitzend',
  'pilates-wirbelsaeule-drehen-sitzend',
  'schulter-rueckseite-dehnen',
  'schulterblatt-kreisen',
  'seitstuetz',
  'seitstuetz-knie',
  'taschen-tragen',
  'toter-hang',
  'unterarm-dehnen',
  'unterarmstuetz',
  'wadendehnung-wand',
  'yoga-adlerarme-sitzend',
  'yoga-baum-wand',
  'yoga-beine-an-der-wand',
  'yoga-berghaltung',
  'yoga-brustoeffner-stuhl',
  'yoga-drehsitz-stuhl',
  'yoga-dreieck',
  'yoga-dreieck-block',
  'yoga-entspannung-rueckenlage',
  'yoga-entspannung-sitzend',
  'yoga-girlande-block',
  'yoga-halbe-vorbeuge-block',
  'yoga-heldensitz-block',
  'yoga-herabschauender-hund',
  'yoga-hueftbeuger-stuhl',
  'yoga-hund-an-der-wand',
  'yoga-katze-kuh',
  'yoga-kindhaltung',
  'yoga-kindhaltung-sitzend',
  'yoga-knie-zur-brust',
  'yoga-kobra-sanft',
  'yoga-krieger-2',
  'yoga-krieger-2-stuhl',
  'yoga-krieger-3-wand',
  'yoga-liegende-drehung',
  'yoga-palme',
  'yoga-schmetterling',
  'yoga-schulterbruecke-block',
  'yoga-seitneige-stehend',
  'yoga-seitneige-stuhl',
  'yoga-seitstreckung-kniend',
  'yoga-sitzende-vorbeuge-block',
  'yoga-sphinx',
  'yoga-stuhlhaltung',
  'yoga-taube',
  'yoga-tiefer-ausfallschritt',
  'yoga-vorbeuge-stehend',
  'yoga-vorbeuge-stuhl',
];

/** Endpositionen, bei denen die Füße bewusst nicht den Boden berühren (Sprung, Hang, Stütz). */
export const END_OFF_GROUND = new Set([
  'klimmzug',
  'klimmzug-band-unterstuetzt',
  'klimmzug-negativ',
  'skapula-klimmzug',
  'knieheben-haengend',
  'dips-barren',
  'seilspringen',
  'toter-hang',
]);

type Vec = readonly [number, number];
type Bend = LimbTarget['bend'];

/** Hand bzw. Fuß bleibt an der Stelle der Ausgangsposition; `bend` = wohin Ellbogen bzw. Knie zeigt. */
interface Keep {
  readonly keep: Bend;
}
const keep = (bend: Bend): Keep => ({ keep: bend });
type LimbChange = Limb | LimbTarget | Keep;
const isKeep = (c: LimbChange): c is Keep => !Array.isArray(c) && 'keep' in c;

interface SideChange {
  readonly arm?: LimbChange;
  readonly leg?: LimbChange;
  readonly armScale?: readonly [number, number];
  readonly legScale?: readonly [number, number];
}

interface Change {
  readonly torso?: number;
  readonly head?: number;
  /** Becken absolut … */
  readonly pelvis?: Vec;
  /** … oder relativ zum Becken der Ausgangsposition. */
  readonly dx?: number;
  readonly dy?: number;
  readonly near?: SideChange;
  readonly far?: SideChange;
  readonly props?: Prop[];
  readonly headOnTop?: boolean;
}

function startPose(id: string): PoseSpec {
  const illustration = EXERCISE_ILLUSTRATIONS[id];
  if (!illustration) throw new Error(`Keine Ausgangsposition für „${id}“.`);
  return illustration.pose;
}

const deg = (a: Vec, b: Vec) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
const round = (n: number) => Math.round(n * 100) / 100;

/** Endposition aus der Ausgangsposition: Becken fest (aus der Ausgangsposition plus Verschiebung), Rest geändert. */
function move(id: string, change: Change): PoseSpec {
  const s = startPose(id);
  const joints = placeSkeleton(s).joints;
  const pelvis: Vec = change.pelvis ?? [
    round(joints.pelvis[0] + (change.dx ?? 0)),
    round(joints.pelvis[1] + (change.dy ?? 0)),
  ];
  const side = (name: 'near' | 'far'): SidePose => {
    const sp = s[name];
    const ch = change[name] ?? {};
    const limb = (kind: 'arm' | 'leg', c: LimbChange | undefined): Limb | LimbTarget => {
      if (c === undefined) return sp[kind];
      if (!isKeep(c)) return c;
      const end = joints[`${name}${kind === 'arm' ? 'Wrist' : 'Ankle'}` as Joint];
      const tip = joints[`${name}${kind === 'arm' ? 'Hand' : 'Toe'}` as Joint];
      return { ik: [round(end[0]), round(end[1])], bend: c.keep, end: round(deg(end, tip)) };
    };
    const armScale = ch.armScale ?? sp.armScale;
    const legScale = ch.legScale ?? sp.legScale;
    return {
      arm: limb('arm', ch.arm),
      leg: limb('leg', ch.leg),
      ...(armScale ? { armScale } : {}),
      ...(legScale ? { legScale } : {}),
    };
  };
  const torso = change.torso ?? s.torso;
  const head = change.head ?? (s.head === undefined ? undefined : s.head + (torso - s.torso));
  const headOnTop = change.headOnTop ?? s.headOnTop;
  return {
    view: s.view,
    torso,
    ...(head === undefined ? {} : { head }),
    pelvis,
    near: side('near'),
    far: side('far'),
    ...(headOnTop ? { headOnTop } : {}),
    props: change.props ?? s.props ?? [],
  };
}

/**
 * Gestreckter Körper, der um die Füße kippt (Liegestütz unten, Rudern am Tisch oben): Becken auf der Linie Fuß →
 * Rumpf, Hände bleiben (Ellbogen `armBend`).
 */
function pivot(id: string, torso: number, armBend: Bend = 'back', extra: Change = {}): PoseSpec {
  const ankle = placeSkeleton(startPose(id)).joints.nearAnkle;
  const legLen = BODY.thigh + BODY.shin;
  const r = (torso * Math.PI) / 180;
  const pelvis: Vec = [
    round(ankle[0] + Math.cos(r) * legLen),
    round(ankle[1] + Math.sin(r) * legLen),
  ];
  return move(id, {
    torso,
    pelvis,
    near: { arm: keep(armBend), leg: keep('down') },
    far: { arm: keep(armBend), leg: keep('down') },
    ...extra,
  });
}

/** Winkel eines Gliedes drehen (Arme mit dem Rumpf mitdrehen). */
function rot(limb: Limb, by: number): Limb {
  return limb[2] === undefined
    ? [limb[0] + by, limb[1] + by]
    : [limb[0] + by, limb[1] + by, limb[2] + by];
}

const armsForward = { near: [0, 0, 0] as Limb, far: [-3, -2, -2] as Limb };
const armsOverhead = { near: [86, 88, 88] as Limb, far: [88, 89, 88] as Limb };
const runArms = { near: [-62, 18, 18] as Limb, far: [-118, -48, -48] as Limb };

/** Tiefe Kniebeuge: Füße bleiben, Becken hinten unten, Oberkörper nach vorn geneigt. */
function squat(id: string, arms?: { near: Limb; far: Limb }, extra: Change = {}): PoseSpec {
  return move(id, {
    torso: 52,
    head: 62,
    dx: -24,
    pelvis: undefined,
    dy: -32,
    near: { leg: keep('fwd'), ...(arms ? { arm: arms.near } : {}) },
    far: { leg: keep('fwd'), ...(arms ? { arm: arms.far } : {}) },
    ...extra,
  });
}

/** Ausfallschritt unten: vorderes Knie über dem Fuß, hinteres Knie knapp über dem Boden. */
function lungeDown(id: string, change: Change = {}): PoseSpec {
  return move(id, {
    dy: -24,
    near: { leg: keep('fwd') },
    far: { leg: keep('down') },
    ...change,
  });
}

/** Rücken gerade nach vorn kippen (Hüfte nach hinten), Knie leicht gebeugt, Füße bleiben. */
function hingeDown(id: string, torso: number, arms?: { near: Limb; far: Limb }): PoseSpec {
  const s = startPose(id);
  const by = torso - s.torso;
  return move(id, {
    torso,
    head: torso + 4,
    dx: -16,
    dy: -4,
    near: { leg: keep('fwd'), arm: arms?.near ?? rot(s.near.arm as Limb, by) },
    far: { leg: keep('fwd'), arm: arms?.far ?? rot(s.far.arm as Limb, by) },
  });
}

/** Beinwechsel (Lauf-ABC): nahes und fernes Bein bzw. Arm tauschen. */
function swapSides(id: string): PoseSpec {
  const s = startPose(id);
  return {
    ...s,
    near: { ...s.far, arm: s.near.arm, leg: s.far.leg },
    far: { ...s.near, arm: s.far.arm, leg: s.near.leg },
  };
}

/**
 * Atem-Variante: Kopf nickt leicht (−10°), freie Arme (Hand mehr als 25 über dem Boden, als Winkel angegeben) gehen
 * 12° mit (Vorderansicht spiegelbildlich). Liegt das Ergebnis nicht vollständig im Bild bzw. hebt die Figur vom Boden ab, nur der Kopf.
 */
function settle(id: string): PoseSpec {
  const s = startPose(id);
  const joints = placeSkeleton(s).joints;
  const head = (s.head ?? s.torso) - 10;
  const side = (name: 'near' | 'far'): SidePose => {
    const arm = s[name].arm;
    const wrist = joints[`${name}Wrist` as Joint];
    const free = Array.isArray(arm) && wrist[1] - joints.pelvis[1] > -40 && wrist[1] > 25;
    // Vorderansicht: rechte Körperseite (near) liegt im Bild links → gespiegelt drehen (beide Arme gleich weit hoch).
    const by = s.view === 'front' && name === 'near' ? -12 : 12;
    return free ? { ...s[name], arm: rot(arm as Limb, by) } : s[name];
  };
  const withArms: PoseSpec = { ...s, head, near: side('near'), far: side('far') };
  const anchor = buildScene(s).offsetX;
  const startBox = buildScene(s).box;
  const fits = (pose: PoseSpec) => {
    try {
      const box = buildScene(pose, anchor).box;
      return (
        box[0] >= VIEW_MARGIN &&
        box[2] <= VIEW_WIDTH - VIEW_MARGIN &&
        box[1] >= VIEW_MARGIN - 0.5 &&
        Math.abs(box[3] - startBox[3]) < 0.01
      );
    } catch {
      return false;
    }
  };
  return fits(withArms) ? withArms : { ...s, head };
}

const BREATH_ALT =
  'Endposition: dieselbe Haltung, beim Ausatmen geben Kopf und Arme leicht nach – ruhig weiteratmen.';

function e(pose: PoseSpec, alt: string): ExerciseIllustration {
  return { pose, alt };
}

const MOVING_END_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  // --- Liegestütz-Varianten ---------------------------------------------------------------------------------------
  liegestuetz: e(
    pivot('liegestuetz', 6),
    'Endposition: Brust knapp über dem Boden, Ellbogen gebeugt, Körper vom Kopf bis zu den Fersen gerade.',
  ),
  'archer-liegestuetz': e(
    pivot('archer-liegestuetz', 7, 'back', {
      far: { arm: keep('down'), leg: keep('down') },
    }),
    'Endposition: Brust tief neben einer Hand, dieser Arm gebeugt, der andere Arm fast gestreckt zur Seite, Körper gerade.',
  ),
  'trizeps-liegestuetz-eng': e(
    pivot('trizeps-liegestuetz-eng', 7),
    'Endposition: Brust knapp über den Händen, Ellbogen eng am Körper nach hinten gebeugt, Körper gerade.',
  ),
  'diamant-liegestuetz': e(
    pivot('diamant-liegestuetz', 7),
    'Endposition: Brust knapp über den zusammengelegten Händen, Ellbogen nah am Körper gebeugt, Körper gerade.',
  ),
  'liegestuetz-erhoeht': e(
    pivot('liegestuetz-erhoeht', 38),
    'Endposition: Brust an die Tischkante abgesenkt, Ellbogen gebeugt, Körper bleibt eine gerade, schräge Linie.',
  ),
  'liegestuetz-fuesse-erhoeht': e(
    move('liegestuetz-fuesse-erhoeht', {
      torso: -10,
      head: -12,
      dy: -9,
      near: { arm: keep('back'), leg: keep('down') },
      far: { arm: keep('back'), leg: keep('down') },
    }),
    'Endposition: Füße auf dem Stuhl, Brust knapp über dem Boden, Ellbogen gebeugt, Körper gerade.',
  ),
  'pike-liegestuetz': e(
    move('pike-liegestuetz', {
      torso: -62,
      head: -80,
      dx: 8,
      dy: -6,
      near: { arm: keep('back'), leg: keep('up') },
      far: { arm: keep('back'), leg: keep('up') },
    }),
    'Endposition: Hüfte bleibt hoch, Ellbogen gebeugt, Kopf zwischen den Händen knapp über dem Boden.',
  ),
  'dips-stuhl': e(
    move('dips-stuhl', {
      dy: -18,
      near: { arm: keep('back'), leg: keep('up') },
      far: { arm: keep('back'), leg: keep('up') },
    }),
    'Endposition: Gesäß vor dem Stuhl abgesenkt, Ellbogen etwa rechtwinklig nach hinten gebeugt, Füße am Boden.',
  ),
  'dips-barren': e(
    move('dips-barren', {
      torso: 78,
      dy: -18,
      dx: -4,
      near: { arm: keep('back') },
      far: { arm: keep('back') },
    }),
    'Endposition: im Barren abgesenkt, Ellbogen etwa rechtwinklig gebeugt, Oberkörper leicht nach vorn geneigt.',
  ),

  // --- Kniebeugen und Ausfallschritte -----------------------------------------------------------------------------
  'kniebeuge-koerpergewicht': e(
    squat('kniebeuge-koerpergewicht', armsForward),
    'Endposition: tiefe Kniebeuge, Oberschenkel etwa waagerecht, Fersen am Boden, Arme nach vorn gestreckt.',
  ),
  'kniebeuge-pause': e(
    squat('kniebeuge-pause', armsForward),
    'Endposition: tiefe Kniebeuge, unten kurz halten, Fersen am Boden, Arme nach vorn gestreckt.',
  ),
  'kniebeuge-tempo': e(
    squat('kniebeuge-tempo', armsForward),
    'Endposition: langsam in die tiefe Kniebeuge abgesenkt, Fersen am Boden, Arme nach vorn gestreckt.',
  ),
  'kniebeuge-stuhl': e(
    squat('kniebeuge-stuhl', armsForward, { dy: -29, dx: -27 }),
    'Endposition: Gesäß berührt kurz die Sitzfläche, Fersen am Boden, Arme nach vorn gestreckt.',
  ),
  'kniebeuge-langhantel': e(
    squat('kniebeuge-langhantel', { near: [-160, 32, 50], far: [-163, 30, 50] }),
    'Endposition: tiefe Kniebeuge mit der Langhantel auf dem oberen Rücken, Rücken gerade, Fersen am Boden.',
  ),
  'goblet-kniebeuge': e(
    squat('goblet-kniebeuge', { near: [-40, 100, 105], far: [-44, 98, 105] }),
    'Endposition: tiefe Kniebeuge, Kurzhantel dicht vor der Brust, Ellbogen zwischen den Knien, Fersen am Boden.',
  ),
  'kniebeuge-schulterdruecken-kurzhantel': e(
    move('kniebeuge-schulterdruecken-kurzhantel', {
      near: { arm: armsOverhead.near },
      far: { arm: armsOverhead.far },
    }),
    'Endposition: aufrecht stehen, beide Kurzhanteln mit gestreckten Armen über dem Kopf.',
  ),
  'thruster-langhantel': e(
    move('thruster-langhantel', {
      near: { arm: [48, 102, 100] },
      far: { arm: [50, 103, 100] },
    }),
    'Endposition: aufrecht stehen, Langhantel mit gestreckten Armen über dem Kopf.',
  ),
  'wall-balls': e(
    move('wall-balls', {
      near: { arm: [70, 74, 74] },
      far: { arm: [72, 75, 74] },
      props: [wall(46, 8), { t: 'circle', at: [44, 148], r: 9, role: 'equip', front: true }],
    }),
    'Endposition: aufrecht, Arme nach oben vorn gestreckt, der Ball fliegt an die Wand über dir.',
  ),
  'ausfallschritt-rueckwaerts-kurzhantel': e(
    move('ausfallschritt-rueckwaerts-kurzhantel', {
      dx: -16,
      dy: -26,
      near: { leg: keep('fwd') },
      far: { leg: { ik: [-48, 9], bend: 'down', end: -40 } },
    }),
    'Endposition: ein Bein weit nach hinten gesetzt, hinteres Knie knapp über dem Boden, Kurzhanteln seitlich, Oberkörper aufrecht.',
  ),
  'split-kniebeuge': e(
    lungeDown('split-kniebeuge'),
    'Endposition: senkrecht abgesenkt, vorderes Knie über dem Fuß, hinteres Knie knapp über dem Boden.',
  ),
  'ausfallschritt-gehen-koerpergewicht': e(
    lungeDown('ausfallschritt-gehen-koerpergewicht'),
    'Endposition: im Schritt abgesenkt, vorderes Knie über dem Fuß, hinteres Knie knapp über dem Boden.',
  ),
  'sandsack-ausfallschritte': e(
    move('sandsack-ausfallschritte', {
      dx: 14,
      dy: -26,
      near: { leg: { ik: [40, 3.5], bend: 'fwd', end: 0 } },
      far: { leg: { ik: [-22, 9], bend: 'down', end: -40 } },
    }),
    'Endposition: großer Schritt nach vorn, hinteres Knie knapp über dem Boden, Gewicht an den Schultern, Oberkörper aufrecht.',
  ),
  'bulgarische-split-kniebeuge': e(
    lungeDown('bulgarische-split-kniebeuge', { dy: -22, dx: -4, far: { leg: keep('down') } }),
    'Endposition: auf dem vorderen Bein abgesenkt, hinterer Fuß auf der Bank, hinteres Knie Richtung Boden, Kurzhanteln seitlich.',
  ),
  'bulgarische-split-kniebeuge-stuhl': e(
    lungeDown('bulgarische-split-kniebeuge-stuhl', { dy: -22, dx: -4 }),
    'Endposition: auf dem vorderen Bein abgesenkt, hinterer Fuß auf dem Stuhl, hinteres Knie Richtung Boden, Hand an der Wand.',
  ),
  'seitlicher-ausfallschritt': e(
    move('seitlicher-ausfallschritt', {
      dx: -16,
      dy: -18,
      near: { leg: keep('back'), arm: [-60, -20] },
      far: { leg: keep('back'), arm: [-120, -160] },
    }),
    'Endposition: Gewicht auf einem Bein, dieses Knie gebeugt, das andere Bein gestreckt zur Seite, Hände vor dem Körper.',
  ),
  'step-up-stufe': e(
    move('step-up-stufe', {
      pelvis: [22, 82],
      near: { leg: keep('fwd'), arm: { ik: [40, 98], bend: 'down', end: 10 } },
      far: { leg: [-84, -110, -30] },
    }),
    'Endposition: auf der Stufe stehen, Standbein gestreckt, das andere Bein angehoben, eine Hand am Geländer.',
  ),
  'step-down-stufe': e(
    move('step-down-stufe', {
      dx: -8,
      dy: -16,
      torso: 82,
      near: { leg: [-70, -94, 10] },
      far: { leg: keep('fwd') },
    }),
    'Endposition: Standbein auf der Stufe gebeugt, die Ferse des freien Beins tippt vorn auf den Boden.',
  ),
  'pistol-kniebeuge-kasten': e(
    move('pistol-kniebeuge-kasten', {
      torso: 64,
      head: 70,
      dx: -18,
      dy: -40,
      near: { leg: [-4, -4, 60], arm: [8, 8, 8] },
      far: { leg: keep('fwd'), arm: [6, 6, 6] },
    }),
    'Endposition: auf einem Bein bis zur Kastenkante abgesenkt, das andere Bein gestreckt nach vorn, Arme nach vorn.',
  ),

  // --- Hüfte und Beinrückseite ------------------------------------------------------------------------------------
  'rumaenisches-kreuzheben-langhantel': e(
    hingeDown('rumaenisches-kreuzheben-langhantel', 20, {
      near: [-90, -90, -90],
      far: [-92, -91, -90],
    }),
    'Endposition: Hüfte weit nach hinten, Oberkörper fast waagerecht, Rücken gerade, Langhantel dicht an den Schienbeinen.',
  ),
  'rumaenisches-kreuzheben-kurzhantel': e(
    hingeDown('rumaenisches-kreuzheben-kurzhantel', 20, {
      near: [-90, -90, -90],
      far: [-92, -91, -90],
    }),
    'Endposition: Hüfte weit nach hinten, Oberkörper fast waagerecht, Rücken gerade, Kurzhanteln vor den Schienbeinen.',
  ),
  'good-morning-koerpergewicht': e(
    hingeDown('good-morning-koerpergewicht', 22),
    'Endposition: Hüfte nach hinten geschoben, Oberkörper fast waagerecht, Rücken gerade, Hände vor der Brust.',
  ),
  'good-morning-band': e(
    hingeDown('good-morning-band', 22),
    'Endposition: Hüfte nach hinten geschoben, Oberkörper fast waagerecht, Band auf Spannung, Rücken gerade.',
  ),
  'rdl-einbeinig-koerpergewicht': e(
    move('rdl-einbeinig-koerpergewicht', {
      torso: 8,
      head: 12,
      dx: -8,
      dy: -6,
      near: { leg: keep('fwd'), arm: [-86, -88] },
      far: { leg: [184, 184, 120], arm: [-90, -92] },
    }),
    'Endposition: Oberkörper nach vorn gekippt, freies Bein gestreckt nach hinten, Körper bildet fast eine waagerechte Linie.',
  ),
  'kettlebell-swing': e(
    move('kettlebell-swing', {
      torso: 92,
      head: 92,
      dx: 10,
      dy: 12,
      near: { arm: { ik: [40, 98], bend: 'down', end: 0 }, leg: keep('fwd') },
      far: { arm: { ik: [39, 98], bend: 'down', end: 0 }, leg: keep('fwd') },
      props: kettlebell([42, 80]),
    }),
    'Endposition: aufrecht stehen, Hüfte gestreckt, Kettlebell schwingt mit gestreckten Armen auf Brusthöhe.',
  ),
  'glute-bridge': e(
    move('glute-bridge', {
      torso: -28,
      head: -4,
      pelvis: [-2, 30],
      near: { arm: keep('up'), leg: keep('up') },
      far: { arm: keep('up'), leg: keep('up') },
    }),
    'Endposition: Becken angehoben, Schultern, Hüfte und Knie bilden eine Linie, Füße und Arme am Boden.',
  ),
  'glute-bridge-einbeinig': e(
    move('glute-bridge-einbeinig', {
      torso: -28,
      head: -4,
      pelvis: [-2, 30],
      near: { arm: keep('up'), leg: [152, 152, 60] },
      far: { arm: keep('up'), leg: keep('up') },
    }),
    'Endposition: Becken angehoben, ein Fuß am Boden, das andere Bein gestreckt in Verlängerung des Körpers.',
  ),
  'hip-thrust-sofa': e(
    move('hip-thrust-sofa', {
      torso: 180,
      head: 160,
      pelvis: [4, 33],
      near: { arm: keep('up'), leg: keep('up') },
      far: { arm: keep('up'), leg: keep('up') },
    }),
    'Endposition: Becken nach oben gedrückt, Oberkörper und Oberschenkel waagerecht, Schulterblätter an der Sofakante.',
  ),
  'hueftstrecken-vierfuessler': e(
    move('hueftstrecken-vierfuessler', {
      near: { leg: [174, 95, 95] },
      far: { leg: keep('down'), arm: keep('down') },
    }),
    'Endposition: im Vierfüßlerstand ein Bein angewinkelt nach hinten oben gedrückt, Fußsohle zur Decke, Rücken gerade.',
  ),
  'nordic-curl-assistiert': e(
    move('nordic-curl-assistiert', {
      torso: 58,
      head: 62,
      pelvis: undefined,
      near: { leg: [-122, 180, 180], arm: [-50, -20, -20] },
      far: { leg: [-124, 180, 180], arm: [-54, -22, -20] },
      dx: 18,
      dy: -5,
    }),
    'Endposition: Körper vom Knie bis zum Kopf als Linie langsam nach vorn abgesenkt, Hände bereit zum Abfangen.',
  ),
  'beinbeuger-maschine': e(
    move('beinbeuger-maschine', {
      near: { leg: [0, -128, -40] },
      far: { leg: [1, -129, -40] },
    }),
    'Endposition: an der Beinbeuger-Maschine die Unterschenkel unter den Sitz gebeugt, Knie etwa rechtwinklig.',
  ),
  beinpresse: e(
    move('beinpresse', {
      near: { leg: { ik: [30, 54], bend: 'up', end: 136 } },
      far: { leg: { ik: [30, 54], bend: 'up', end: 136 } },
    }),
    'Endposition: in der Beinpresse die Knie Richtung Brust gebeugt, Rücken und Gesäß am Polster.',
  ),

  // --- Waden --------------------------------------------------------------------------------------------------------
  'wadenheben-koerpergewicht': e(
    move('wadenheben-koerpergewicht', {
      dy: 6.5,
      near: { leg: [-88, -91, -36] },
      far: { leg: [-93, -89, -36] },
    }),
    'Endposition: auf den Fußballen ganz nach oben gedrückt, Fersen hoch, Körper gestreckt.',
  ),
  'wadenheben-einbeinig': e(
    move('wadenheben-einbeinig', { dy: 6.5, near: { leg: [-89, -90, -36] } }),
    'Endposition: auf einem Fußballen ganz nach oben gedrückt, Ferse hoch, das andere Bein angewinkelt.',
  ),
  'wadenheben-kurzhantel': e(
    move('wadenheben-kurzhantel', {
      dy: 6.5,
      near: { leg: [-88, -91, -36] },
      far: { leg: [-93, -89, -36] },
    }),
    'Endposition: auf den Fußballen ganz nach oben gedrückt, Fersen hoch, Kurzhantel seitlich in einer Hand.',
  ),
  'wadenheben-gebeugtes-knie': e(
    move('wadenheben-gebeugtes-knie', {
      dy: 6.5,
      near: { leg: [-70, -105, -36] },
      far: { leg: [-72, -103, -36] },
    }),
    'Endposition: Knie gebeugt, auf den Fußballen nach oben gedrückt, Fersen hoch.',
  ),

  // --- Rücken: Rudern, Ziehen -------------------------------------------------------------------------------------
  'vorgebeugtes-rudern-kurzhantel': e(
    move('vorgebeugtes-rudern-kurzhantel', {
      near: { arm: [-160, -90, -90] },
      far: { arm: [-162, -92, -90] },
    }),
    'Endposition: vorgebeugt, Ellbogen nach hinten oben gezogen, Kurzhanteln seitlich am Bauch.',
  ),
  'reverse-fly-kurzhantel': e(
    move('reverse-fly-kurzhantel', {
      near: { arm: [-40, -50, -50], armScale: [0.45, 0.45] },
      far: { arm: [-140, -130, -130], armScale: [0.45, 0.45] },
    }),
    'Endposition: vorgebeugt, Arme leicht gebeugt seitlich bis auf Schulterhöhe gehoben.',
  ),
  'y-t-w-vorgebeugt': e(
    move('y-t-w-vorgebeugt', {
      near: { arm: [34, 34, 34] },
      far: { arm: [36, 36, 36] },
    }),
    'Endposition: vorgebeugt, Arme in Verlängerung des Oberkörpers schräg nach vorn oben gehoben (Y).',
  ),
  'rudern-band': e(
    move('rudern-band', {
      near: { arm: [-128, 2, 2] },
      far: { arm: [-130, 0, 0] },
    }),
    'Endposition: Ellbogen nah am Körper nach hinten gezogen, Hände seitlich am Bauch, Band auf Spannung.',
  ),
  kabelrudern: e(
    move('kabelrudern', {
      torso: 96,
      near: { arm: { ik: [18, 52], bend: 'down', end: -10 } },
      far: { arm: { ik: [17, 52], bend: 'down', end: -10 } },
    }),
    'Endposition: aufrecht sitzen, Griff zum Bauch gezogen, Ellbogen nah am Körper nach hinten.',
  ),
  'tisch-rudern': e(
    move('tisch-rudern', {
      torso: 12,
      head: 18,
      dy: 14,
      near: { arm: keep('down'), leg: keep('up') },
      far: { arm: keep('down'), leg: keep('up') },
    }),
    'Endposition: unter dem Tisch die Brust zur Tischkante gezogen, Körper gerade, Füße am Boden.',
  ),
  'tuerrahmen-rudern': e(
    move('tuerrahmen-rudern', {
      torso: 92,
      head: 92,
      dx: 14,
      dy: 2,
      near: { arm: keep('down'), leg: keep('fwd') },
      far: { leg: keep('fwd') },
    }),
    'Endposition: Oberkörper zum Türrahmen gezogen, Ellbogen gebeugt nah am Körper, Füße bleiben stehen.',
  ),
  'australian-pull-up': e(
    pivot('australian-pull-up', 34, 'down'),
    'Endposition: Brust an die Stange gezogen, Körper gerade, Fersen am Boden.',
  ),
  klimmzug: e(
    pullTop,
    'Endposition: Kinn über der Stange, Ellbogen nach unten gezogen, Beine leicht angewinkelt.',
  ),
  'klimmzug-band-unterstuetzt': e(
    {
      ...pullTop,
      near: { ...pullTop.near, leg: [-75, -140, -60] },
      props: [
        ...(pullTop.props ?? []),
        band([
          [3, 156],
          { j: 'nearAnkle', dx: -4, dy: -5 },
          { j: 'nearToe', dx: 1, dy: -5 },
          [6, 156],
        ]),
      ],
    },
    'Endposition: Kinn über der Stange, ein Fuß im Band, Ellbogen nach unten gezogen.',
  ),
  'klimmzug-negativ': e(
    startPose('klimmzug'),
    'Endposition: langsam abgesenkt, Arme gestreckt im Hang an der Stange.',
  ),
  'skapula-klimmzug': e(
    move('skapula-klimmzug', {
      dy: 5,
      near: { arm: keep('fwd') },
      far: { arm: keep('fwd') },
    }),
    'Endposition: im Hang Schulterblätter nach unten gezogen, Körper ein Stück angehoben, Arme bleiben fast gestreckt.',
  ),
  'knieheben-haengend': e(
    move('knieheben-haengend', {
      near: { leg: [5, -85, -60] },
      far: { leg: [3, -88, -60] },
    }),
    'Endposition: im Hang die Knie bis auf Hüfthöhe gehoben, Oberkörper ruhig.',
  ),
  latziehen: e(
    move('latziehen', {
      near: { arm: { ik: [12, 84], bend: 'down', end: 80 } },
      far: { arm: { ik: [11, 84], bend: 'down', end: 80 } },
    }),
    'Endposition: Stange vor dem Körper zur oberen Brust gezogen, Ellbogen zeigen nach unten.',
  ),
  'latziehen-band': e(
    move('latziehen-band', {
      near: { arm: [-80, 78, 78] },
      far: { arm: [-82, 80, 78] },
    }),
    'Endposition: kniend, Ellbogen nach unten an den Körper gezogen, Hände auf Schulterhöhe, Band auf Spannung.',
  ),
  'handtuch-latziehen': e(
    move('handtuch-latziehen', {
      near: { arm: [-80, 80, 80] },
      far: { arm: [-82, 82, 80] },
    }),
    'Endposition: kniend, Handtuch straff gezogen, Ellbogen nach unten an den Körper gezogen.',
  ),
  'face-pull-kabel': e(
    move('face-pull-kabel', {
      near: { arm: [172, 40, 40] },
      far: { arm: [170, 38, 38] },
    }),
    'Endposition: Seil zum Gesicht gezogen, Ellbogen hoch und weit nach hinten, Hände neben den Ohren.',
  ),

  // --- Brust und Schultern ------------------------------------------------------------------------------------------
  'bodendruecken-kurzhantel': e(
    move('bodendruecken-kurzhantel', {
      near: { arm: [188, 90, 90] },
      far: { arm: [187, 91, 90] },
    }),
    'Endposition: Rückenlage, Oberarme auf dem Boden, Unterarme senkrecht, Kurzhanteln über den Ellbogen.',
  ),
  brustpresse: e(
    move('brustpresse', {
      near: { arm: { ik: [38, 74], bend: 'down', end: 90 } },
      far: { arm: { ik: [37, 74], bend: 'down', end: 90 } },
    }),
    'Endposition: Griffe nach vorn gedrückt, Arme fast gestreckt, Rücken an der Lehne.',
  ),
  'brustdruecken-band': e(
    move('brustdruecken-band', {
      near: { arm: [2, 2, 2] },
      far: { arm: [0, 0, 0] },
    }),
    'Endposition: Arme auf Brusthöhe nach vorn gestreckt, Band auf Spannung, Schrittstellung.',
  ),
  'schulterdruecken-kurzhantel': e(
    move('schulterdruecken-kurzhantel', {
      near: { arm: armsOverhead.near },
      far: { arm: armsOverhead.far },
    }),
    'Endposition: Kurzhanteln mit gestreckten Armen über den Kopf gedrückt, Rumpf fest.',
  ),
  'schulterdruecken-band': e(
    move('schulterdruecken-band', {
      near: { arm: armsOverhead.near },
      far: { arm: armsOverhead.far },
    }),
    'Endposition: Band mit gestreckten Armen über den Kopf gedrückt, Rumpf fest.',
  ),
  'schulterdruecken-langhantel': e(
    move('schulterdruecken-langhantel', {
      near: { arm: [48, 102, 100] },
      far: { arm: [50, 103, 100] },
    }),
    'Endposition: Langhantel mit gestreckten Armen über den Kopf gedrückt, Rumpf fest.',
  ),
  'seitheben-kurzhantel': e(
    move('seitheben-kurzhantel', {
      near: { arm: [180, 182] },
      far: { arm: [0, -2] },
    }),
    'Endposition: Arme seitlich bis auf Schulterhöhe gehoben, Ellbogen leicht gebeugt.',
  ),
  'seitheben-band': e(
    move('seitheben-band', {
      near: { arm: [180, 182] },
      far: { arm: [0, -2] },
    }),
    'Endposition: Arme mit dem Band seitlich bis auf Schulterhöhe gehoben.',
  ),
  'trizepsstrecken-kurzhantel': e(
    move('trizepsstrecken-kurzhantel', {
      near: { arm: [98, -100, -96] },
      far: { arm: [99, -99, -96] },
      props: dumbbellSide({ j: 'nearWrist', dy: 2 }, 90),
    }),
    'Endposition: Oberarme bleiben neben dem Kopf, Unterarme hinter den Kopf gesenkt, Kurzhantel im Nacken.',
  ),
  'bizepscurl-kurzhantel': e(
    move('bizepscurl-kurzhantel', {
      near: { arm: [-88, 78, 80] },
      far: { arm: [-92, 80, 80] },
    }),
    'Endposition: Kurzhanteln bis vor die Schultern gebeugt, Oberarme bleiben am Körper.',
  ),

  // --- Rumpf --------------------------------------------------------------------------------------------------------
  'bird-dog': e(
    move('bird-dog', {
      near: { arm: [12, 12, 12] },
      far: { arm: keep('down'), leg: [172, 172, 172] },
    }),
    'Endposition: im Vierfüßlerstand einen Arm nach vorn und das gegenüberliegende Bein nach hinten gestreckt.',
  ),
  'dead-bug': e(
    move('dead-bug', {
      near: { arm: [8, 8, 8] },
      far: { leg: [176, 176, 176] },
    }),
    'Endposition: Rückenlage, ein Arm nach hinten über den Kopf, das gegenüberliegende Bein gestreckt knapp über dem Boden.',
  ),

  // --- Ausdauer und Sprünge -----------------------------------------------------------------------------------------
  hampelmann: e(
    move('hampelmann', {
      dy: -4.5,
      near: { arm: [130, 115], leg: [-112, -110] },
      far: { arm: [50, 65], leg: [-68, -70] },
    }),
    'Endposition: Beine gegrätscht, Arme seitlich über den Kopf gehoben.',
  ),
  'step-jacks': e(
    move('step-jacks', {
      near: { arm: [130, 115], leg: [-114, -112] },
      far: { arm: [50, 65] },
    }),
    'Endposition: ein Bein seitlich ausgestellt, Arme seitlich über den Kopf gehoben.',
  ),
  'box-sprung': e(
    move('box-sprung', {
      pelvis: [54, 98],
      torso: 84,
      near: { leg: [-62, -108, 0], arm: [-60, -40] },
      far: { leg: [-66, -106, 0], arm: [-64, -44] },
    }),
    'Endposition: nach dem Sprung mit beiden Füßen weich auf der Box gelandet, Knie leicht gebeugt.',
  ),
  seilspringen: e(
    move('seilspringen', {
      dy: 8,
      near: { leg: [-88, -95, -30] },
      far: { leg: [-93, -92, -30] },
      props: [
        handle({ j: 'nearWrist' }),
        {
          t: 'line',
          points: [{ j: 'nearWrist' }, [22, 50], [24, 28], [18, 4], [4, 0.5], [-10, 2]],
          w: 1.5,
          role: 'equip',
          front: true,
        },
      ],
    }),
    'Endposition: kleiner Sprung auf den Fußballen, das Seil schwingt unter den Füßen durch.',
  ),
  'burpee-weitsprung': e(
    move('burpee-weitsprung', {
      torso: 6,
      head: 4,
      pelvis: [-10, 19],
      near: { arm: { ik: [34, 3.5], bend: 'back', end: 0 }, leg: [186, 186, -75] },
      far: { arm: { ik: [33, 3.5], bend: 'back', end: 0 }, leg: [187, 186, -75] },
    }),
    'Endposition: Brust tief im Liegestütz am Boden, danach aufspringen und weit nach vorn springen.',
  ),
  'burpee-ohne-sprung': e(
    move('burpee-ohne-sprung', {
      torso: 90,
      head: 90,
      pelvis: [-56, 69],
      near: { arm: armsOverhead.near, leg: [-88, -91, 0] },
      far: { arm: armsOverhead.far, leg: [-93, -89, 0] },
    }),
    'Endposition: aufgerichtet stehen, Arme über den Kopf gestreckt – ohne Sprung.',
  ),
  'hyrox-skierg': e(
    move('hyrox-skierg', {
      torso: 52,
      head: 58,
      dx: -12,
      dy: -10,
      near: { arm: [-80, -95, -95], leg: keep('fwd') },
      far: { arm: [-82, -96, -95], leg: keep('fwd') },
    }),
    'Endposition: Griffe kraftvoll nach unten gezogen, Hüfte gebeugt, Knie leicht gebeugt, Arme neben den Oberschenkeln.',
  ),
  'hyrox-schlitten-schieben': e(
    move('hyrox-schlitten-schieben', {
      torso: 40,
      head: 48,
      pelvis: [-26, 56],
      near: {
        arm: { ik: [30, 36], bend: 'down', end: 0 },
        leg: { ik: [4, 3.5], bend: 'fwd', end: 0 },
      },
      far: {
        arm: { ik: [29, 36], bend: 'down', end: 0 },
        leg: { ik: [-62, 8], bend: 'fwd', end: -40 },
      },
    }),
    'Endposition: tief nach vorn gelehnt, Hände am Schlitten, kraftvoller Schritt, hinteres Bein gestreckt.',
  ),
  'hyrox-schlitten-ziehen': e(
    move('hyrox-schlitten-ziehen', {
      torso: 104,
      head: 100,
      dx: -6,
      dy: -12,
      near: { arm: [-70, 10, 10], leg: { ik: [16, 3.5], bend: 'fwd', end: 0 } },
      far: { arm: [-74, 8, 8], leg: keep('fwd') },
    }),
    'Endposition: leicht zurückgelehnt, Knie gebeugt, Seil Hand über Hand zum Körper gezogen.',
  ),
  rudergeraet: e(
    move('rudergeraet', {
      torso: 108,
      head: 102,
      dx: -40,
      dy: 0,
      near: { arm: { ik: [-8, 38], bend: 'down', end: -10 }, leg: [-4, -6, 80] },
      far: { arm: { ik: [-9, 38], bend: 'down', end: -10 }, leg: [-3, -5, 80] },
      props: rowingMachine([-54, 12]),
    }),
    'Endposition: Endzug – Beine gestreckt, Oberkörper leicht zurückgelehnt, Griff unter der Brust.',
  ),
  'rudergeraet-locker': e(
    move('rudergeraet-locker', {
      torso: 104,
      head: 100,
      dx: -40,
      dy: 0,
      near: { arm: { ik: [-6, 38], bend: 'down', end: -10 }, leg: [-4, -6, 80] },
      far: { arm: { ik: [-7, 38], bend: 'down', end: -10 }, leg: [-3, -5, 80] },
      props: rowingMachine([-54, 12]),
    }),
    'Endposition: Endzug – Beine gestreckt, Oberkörper leicht zurückgelehnt, Griff unter der Brust – locker.',
  ),

  // --- Lauf-ABC und Läuferkraft -------------------------------------------------------------------------------------
  'lauf-abc-anfersen': e(
    swapSides('lauf-abc-anfersen'),
    'Endposition: Beinwechsel – die andere Ferse schwingt zum Gesäß, Arme gegengleich.',
  ),
  'lauf-abc-fussgelenksarbeit': e(
    swapSides('lauf-abc-fussgelenksarbeit'),
    'Endposition: Beinwechsel – der andere Fuß rollt über den Ballen ab, Arme gegengleich.',
  ),
  'lauf-abc-hopserlauf': e(
    swapSides('lauf-abc-hopserlauf'),
    'Endposition: Beinwechsel – das andere Knie schwingt nach vorn oben, Arme gegengleich.',
  ),
  'lauf-abc-kniehebelauf': e(
    swapSides('lauf-abc-kniehebelauf'),
    'Endposition: Beinwechsel – das andere Knie hoch bis auf Hüfthöhe, Arme gegengleich.',
  ),
  'lauf-abc-skippings': e(
    swapSides('lauf-abc-skippings'),
    'Endposition: Beinwechsel – das andere Knie leicht angehoben, schnelle kurze Schritte.',
  ),
  'lauf-abc-ueberkreuzlauf': e(
    swapSides('lauf-abc-ueberkreuzlauf'),
    'Endposition: Beinwechsel – das andere Bein kreuzt vor dem Standbein, Arme gegengleich.',
  ),
  'lauf-abc-seitgalopp': e(
    move('lauf-abc-seitgalopp', {
      near: { leg: [-94, -92] },
      far: { leg: [-86, -88] },
    }),
    'Endposition: Füße kurz zusammen nachgestellt, Arme seitlich in Schulterhöhe.',
  ),
  'laeufer-kniehub-stand': e(
    move('laeufer-kniehub-stand', {
      near: { leg: [-118, -128, -60], arm: runArms.near },
      far: { arm: runArms.far },
    }),
    'Endposition: das Schwungbein gestreckt nach hinten, Arme gegengleich wie beim Laufen.',
  ),
};

export const EXERCISE_END_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  ...MOVING_END_ILLUSTRATIONS,
  ...Object.fromEntries(END_BREATH_IDS.map((id) => [id, e(settle(id), BREATH_ALT)])),
};
