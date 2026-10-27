import { band, dumbbellEnd, dumbbellSide, handle, kettlebell, step, wall } from './equipment';
import type { ExerciseIllustration } from './poses';
import type { Limb, PoseSpec, Prop } from './rig';

/**
 * Ausgangspositionen der Hyrox-Entwürfe (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1/4, Etappe H): Stationen und ihr Ersatz
 * ohne Spezialgerät. Gleiche Figur und Regeln wie poses.ts (Gründer-Entscheidung B, 21.10.2026): Winkel absolut in Grad,
 * 0 = nach vorn, 90 = nach oben. Schlitten, Ski-Ergometer und Wall-Ball-Ziel als einfache Formen (Block bzw. Wand) –
 * ohne Hersteller-Merkmale.
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
const armsForward = { near: [0, 0, 0] as Limb, far: [-3, -2, -2] as Limb };
const armsAtShoulders = { near: [-75, 92, 92] as Limb, far: [-78, 95, 95] as Limb };
const armsAtChest = { near: [-70, 85, 90] as Limb, far: [-74, 82, 90] as Limb };
const armsUp = { near: [70, 72, 72] as Limb, far: [72, 73, 72] as Limb };

const dumbbellsAtSides = [
  ...dumbbellSide({ j: 'nearWrist', dy: -1 }, 0),
  ...dumbbellSide({ j: 'farWrist', dy: -1 }, 0, false),
];

/** Hoher Liegestütz (wie poses.ts). */
const pushUp: PoseSpec = {
  view: 'side',
  torso: 20,
  head: 18,
  near: { arm: [-90, -90, 0], leg: [200, 200, -75] },
  far: { arm: [-87, -91, 0], leg: [201, 200, -75] },
};

/** Große Schrittstellung (wie split-kniebeuge in poses.ts). */
function lungeStance(arms: { near: Limb; far: Limb }, props: Prop[] = []): PoseSpec {
  return {
    view: 'side',
    torso: 90,
    pelvis: [0, 64],
    near: { arm: arms.near, leg: { ik: [26, 3.5], bend: 'fwd', end: 0 } },
    far: { arm: arms.far, leg: { ik: [-30, 9], bend: 'fwd', end: -40 } },
    props,
  };
}

export const HYROX_ILLUSTRATIONS: Readonly<Record<string, ExerciseIllustration>> = {
  'hyrox-skierg': {
    pose: stand(armsUp, [wall(40, 10), handle({ j: 'nearWrist' })]),
    alt: 'Ausgangsposition: aufrecht vor dem Ski-Ergometer stehen, beide Griffe mit fast gestreckten Armen über Kopfhöhe greifen.',
  },
  'band-zug-ueber-kopf': {
    pose: stand(armsUp, [wall(46, 8), band([{ j: 'nearWrist' }, [46, 140]])]),
    alt: 'Ausgangsposition: aufrecht stehen, die Enden des oben befestigten Widerstandsbands mit fast gestreckten Armen über Kopfhöhe greifen.',
  },
  'hyrox-schlitten-schieben': {
    pose: stand(armsForward, [step(30, 70, 40)]),
    alt: 'Ausgangsposition: aufrecht hinter dem Schlitten stehen, Arme nach vorn zu den Griffen gestreckt.',
  },
  'ausfallschritt-gehen-kurzhantel': {
    pose: stand(armsDown, dumbbellsAtSides),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kurzhantel seitlich an den gestreckten Armen.',
  },
  'hyrox-schlitten-ziehen': {
    pose: stand(armsForward, [step(60, 95, 30), band([{ j: 'nearWrist' }, [60, 20]])]),
    alt: 'Ausgangsposition: aufrecht stehen, das Seil des Schlittens vor dir mit beiden Händen gegriffen, Arme nach vorn gestreckt.',
  },
  'band-zug-rueckwaerts-gehen': {
    pose: stand(armsForward, [wall(76, 7), band([{ j: 'nearWrist' }, [76, 98]])]),
    alt: 'Ausgangsposition: aufrecht stehen, Arme auf Brusthöhe nach vorn gestreckt, Widerstandsband vor dir befestigt.',
  },
  'burpee-weitsprung': {
    pose: stand(armsDown),
    alt: 'Ausgangsposition: aufrecht stehen, Füße hüftbreit, Arme seitlich am Körper.',
  },
  'burpee-ohne-sprung': {
    pose: pushUp,
    alt: 'Ausgangsposition: hoher Liegestütz von der Seite, Arme gestreckt, Körper gerade – hierhin werden die Beine nacheinander gesetzt.',
  },
  'hyrox-rudergeraet': {
    pose: stand(armsDown, [step(-60, 60, 8)]),
    alt: 'Ausgangsposition: neben dem Rudergerät stehen, bereit zum Hinsetzen und Festschnallen der Füße.',
  },
  'farmers-carry-kurzhantel': {
    pose: stand(armsDown, dumbbellsAtSides),
    alt: 'Ausgangsposition: aufrecht stehen, je eine schwere Kurzhantel seitlich an den gestreckten Armen, Schultern tief.',
  },
  'farmers-carry-kettlebell': {
    pose: stand(armsDown, kettlebell([3, 62])),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kettlebell seitlich an den gestreckten Armen, Schultern tief.',
  },
  'koffer-tragen-einarmig': {
    pose: stand(armsDown, dumbbellSide({ j: 'nearWrist', dy: -1 }, 0)),
    alt: 'Ausgangsposition: aufrecht stehen, eine Kurzhantel seitlich in einer Hand, Oberkörper gerade.',
  },
  'taschen-tragen': {
    pose: stand(armsDown),
    alt: 'Ausgangsposition: aufrecht stehen, in jeder Hand eine gefüllte Tasche an den gestreckten Armen.',
  },
  'sandsack-ausfallschritte': {
    pose: stand(armsAtShoulders),
    alt: 'Ausgangsposition: aufrecht stehen, den Sandsack auf den Schultern hinter dem Kopf mit beiden Händen festhalten.',
  },
  'ausfallschritt-gehen-koerpergewicht': {
    pose: lungeStance(armsDown),
    alt: 'Ausgangsposition: große Schrittstellung, vorderer Fuß flach, hinterer Fuß auf dem Ballen, Oberkörper aufrecht.',
  },
  'wall-balls': {
    pose: stand(armsAtChest, [wall(46, 8)]),
    alt: 'Ausgangsposition: etwa eine Armlänge vor der Wand stehen, den Ball mit beiden Händen vor der Brust halten.',
  },
  'kniebeuge-schulterdruecken-kurzhantel': {
    pose: stand(armsAtShoulders, dumbbellEnd({ j: 'nearWrist', dy: 3 })),
    alt: 'Ausgangsposition: aufrecht stehen, je eine Kurzhantel auf Schulterhöhe, Ellbogen darunter, Füße schulterbreit.',
  },
};
