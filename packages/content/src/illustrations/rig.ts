/**
 * Figuren-Rig für die eigenen Übungs-Illustrationen (Gründer-Entscheidung B, 21.10.2026; docs/DESIGN.md
 * „Übungs-Illustrationen“). Aus Gelenkwinkeln je Übung (poses.ts) entsteht deterministisch ein SVG: immer dieselbe
 * stilisierte, geschlechtsneutrale Figur (flache Formen, runde Enden), dieselbe Strichstärke, dieselbe Bodenlinie und
 * dieselbe Ansichtsbox. Keine Zufallswerte, keine Zeitstempel – gleiche Daten ergeben byte-gleiche Dateien.
 *
 * Koordinaten: Welt in „Figur-Einheiten“, x nach vorn (Blickrichtung der Figur in der Seitenansicht), y nach oben,
 * Boden bei y = 0. Winkel in Grad, mathematisch: 0 = nach vorn, 90 = nach oben, -90 = nach unten, 180 = nach hinten.
 * Jeder Winkel ist ABSOLUT (Richtung des Körperteils im Bild), nicht relativ zum vorigen Gelenk – so lassen sich
 * Haltungen direkt vom Foto oder der Beschreibung ablesen („Oberschenkel waagerecht“ = 0 bzw. 180).
 */

/** Ansichtsbox aller Bilder (Breite × Höhe) und Lage der Bodenlinie. */
export const VIEW_WIDTH = 240;
export const VIEW_HEIGHT = 180;
export const GROUND_Y = 170;
/** Mindestabstand zum Bildrand. */
export const VIEW_MARGIN = 4;

/** Proportionen der Figur (Einheiten = Pixel der Ansichtsbox). Stehend ca. 130 hoch. */
export const BODY = {
  torso: 40,
  neck: 5,
  headR: 9,
  upperArm: 24,
  forearm: 22,
  hand: 5,
  thigh: 34,
  shin: 32,
  foot: 11,
  /** Abstand Schultergelenk unter dem oberen Rumpfende. */
  shoulderDrop: 3,
} as const;

/** Strichstärken (gleich in jedem Bild). */
export const STROKE = {
  upperArm: 8,
  forearm: 7,
  hand: 5.5,
  thigh: 11,
  shin: 9,
  foot: 5.5,
  /** Kontur des Rumpfes (rundet die Ecken). */
  torsoOutline: 5,
  ground: 2,
  /** Rand um vordere Glieder (Hintergrundfarbe). */
  gap: 1.6,
} as const;

/** Halbe Rumpfbreite an Schulter und Hüfte je Ansicht; Abstand der Gelenke von der Mittellinie. */
const TORSO_SHAPE = {
  side: { shoulderHalf: 8, hipHalf: 7.5, shoulderOffset: 0, hipOffset: 0 },
  front: { shoulderHalf: 12, hipHalf: 8, shoulderOffset: 12, hipOffset: 6 },
} as const;

export type ViewKind = 'side' | 'front';
/** [Oberarm, Unterarm, Hand?] bzw. [Oberschenkel, Unterschenkel, Fuß?] – absolute Winkel. */
export type Limb = readonly [number, number, number?];

/**
 * Alternativ Zielpunkt für Handgelenk bzw. Fußknöchel (zweigliedrige inverse Kinematik): `bend` legt fest, wohin
 * Ellbogen/Knie zeigt. Nur mit festem Becken (`pelvis`) erlaubt.
 */
export interface LimbTarget {
  readonly ik: readonly [number, number];
  readonly bend: 'up' | 'down' | 'fwd' | 'back';
  /** Winkel von Hand bzw. Fuß. */
  readonly end?: number;
}

export interface SidePose {
  readonly arm: Limb | LimbTarget;
  readonly leg: Limb | LimbTarget;
  /** Verkürzung (perspektivisch, z. B. Unterarm zeigt zum Betrachter): Faktoren für [oben, unten]. */
  readonly armScale?: readonly [number, number];
  readonly legScale?: readonly [number, number];
}

export type Joint =
  | 'pelvis'
  | 'neck'
  | 'head'
  | `${'near' | 'far'}${'Shoulder' | 'Elbow' | 'Wrist' | 'Hand' | 'Hip' | 'Knee' | 'Ankle' | 'Toe'}`;

/** Punkt: absolut in Weltkoordinaten oder relativ zu einem Gelenk. */
export type Point =
  readonly [number, number] | { readonly j: Joint; readonly dx?: number; readonly dy?: number };

/** Farbrolle – die Farben selbst stehen in palette.ts (hell/dunkel). */
export type Role =
  | 'figure'
  | 'figureFar'
  | 'equip'
  | 'equipSoft'
  | 'furniture'
  | 'furnitureLine'
  | 'ground'
  /** Hintergrund der Karte (Trennrand um vordere Glieder). */
  | 'gap';

export type Prop =
  | {
      readonly t: 'line';
      readonly points: readonly Point[];
      readonly role: Role;
      readonly w: number;
      readonly front?: boolean;
    }
  | {
      readonly t: 'poly';
      readonly points: readonly Point[];
      readonly role: Role;
      readonly front?: boolean;
    }
  | {
      readonly t: 'rect';
      /** linke untere Ecke (Welt) */
      readonly at: Point;
      readonly w: number;
      readonly h: number;
      readonly role: Role;
      readonly r?: number;
      readonly front?: boolean;
    }
  | {
      readonly t: 'circle';
      readonly at: Point;
      readonly r: number;
      readonly role: Role;
      /** nur Ring mit dieser Strichstärke statt Fläche */
      readonly ring?: number;
      readonly front?: boolean;
    };

export interface PoseSpec {
  readonly view: ViewKind;
  /** Richtung Hüfte → Schulter. */
  readonly torso: number;
  /** Richtung Hals → Kopf (Standard: wie Rumpf). */
  readonly head?: number;
  /** Seitenansicht: near = dem Betrachter zugewandte Seite (vorn gezeichnet). Vorderansicht: near = rechte Körperseite (Bild links). */
  readonly near: SidePose;
  readonly far: SidePose;
  /** Becken fest setzen; sonst steht/liegt der tiefste Körperpunkt auf `rest` (Standard Boden = 0). */
  readonly pelvis?: readonly [number, number];
  readonly rest?: number;
  /** Kopf über die Arme zeichnen (Arme über dem Kopf, z. B. Klimmzug). */
  readonly headOnTop?: boolean;
  readonly props?: readonly Prop[];
}

type Vec = readonly [number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): Vec => [Math.cos(rad(deg)), Math.sin(rad(deg))];
const add = (a: Vec, b: Vec, scale = 1): Vec => [a[0] + b[0] * scale, a[1] + b[1] * scale];

interface Segment {
  readonly from: Vec;
  readonly to: Vec;
  readonly w: number;
  readonly role: Role;
}

export interface Skeleton {
  readonly joints: Readonly<Record<Joint, Vec>>;
  readonly torso: readonly Vec[];
  readonly head: { readonly c: Vec; readonly r: number };
  /** Glieder je Seite (Bein: Ober-, Unterschenkel, Fuß; Arm: Ober-, Unterarm, Hand). */
  readonly limbs: Readonly<
    Record<'near' | 'far', { readonly leg: readonly Segment[]; readonly arm: readonly Segment[] }>
  >;
}

const isTarget = (spec: Limb | LimbTarget): spec is LimbTarget => !Array.isArray(spec);

/** Winkel aus Zielpunkt (Kosinussatz); unerreichbare Ziele werden gestreckt angepeilt. */
function solve(root: Vec, spec: Limb | LimbTarget, a: number, b: number): Limb {
  if (!isTarget(spec)) return spec;
  const dx = spec.ik[0] - root[0];
  const dy = spec.ik[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos((a * a + d * d - b * b) / (2 * a * d));
  const target: Vec = [root[0] + d * Math.cos(base), root[1] + d * Math.sin(base)];
  const options = [base + alpha, base - alpha].map((angle) => {
    const mid: Vec = [root[0] + a * Math.cos(angle), root[1] + a * Math.sin(angle)];
    return { angle, mid };
  });
  const pick = {
    up: (m: Vec) => m[1],
    down: (m: Vec) => -m[1],
    fwd: (m: Vec) => m[0],
    back: (m: Vec) => -m[0],
  }[spec.bend];
  const best = pick(options[0]!.mid) >= pick(options[1]!.mid) ? options[0]! : options[1]!;
  const lower = Math.atan2(target[1] - best.mid[1], target[0] - best.mid[0]);
  const deg = (r: number) => (r * 180) / Math.PI;
  return [deg(best.angle), deg(lower), spec.end];
}

function limb(
  root: Vec,
  angles: Limb,
  lens: readonly [number, number, number],
): [Vec, Vec, Vec, Vec] {
  const mid = add(root, dir(angles[0]), lens[0]);
  const end = add(mid, dir(angles[1]), lens[1]);
  const tip = add(end, dir(angles[2] ?? angles[1]), lens[2]);
  return [root, mid, end, tip];
}

/** Skelett aus Winkeln, Becken bei `pelvis`. */
export function buildSkeleton(pose: PoseSpec, pelvis: Vec): Skeleton {
  const shape = TORSO_SHAPE[pose.view];
  const up = dir(pose.torso);
  const perp = dir(pose.torso - 90);
  const neck = add(pelvis, up, BODY.torso);
  const shoulderMid = add(pelvis, up, BODY.torso - BODY.shoulderDrop);
  const headC = add(neck, dir(pose.head ?? pose.torso), BODY.neck + BODY.headR);
  // Vorderansicht: rechte Körperseite (near) liegt im Bild links (−perp bei aufrechtem Rumpf).
  const sideSign = { near: -1, far: 1 } as const;
  const joints = { pelvis, neck, head: headC } as Record<Joint, Vec>;
  const limbs = {} as Record<'near' | 'far', { leg: Segment[]; arm: Segment[] }>;
  for (const side of ['near', 'far'] as const) {
    const s = sideSign[side];
    const shoulder = add(shoulderMid, perp, s * shape.shoulderOffset);
    const hip = add(pelvis, perp, s * shape.hipOffset);
    const role: Role = pose.view === 'side' && side === 'far' ? 'figureFar' : 'figure';
    const sp = pose[side];
    const [ua, fa] = sp.armScale ?? [1, 1];
    const [th, sh] = sp.legScale ?? [1, 1];
    const armLens = [BODY.upperArm * ua, BODY.forearm * fa, BODY.hand] as const;
    const legLens = [BODY.thigh * th, BODY.shin * sh, 0] as const;
    const [, elbow, wrist, hand] = limb(
      shoulder,
      solve(shoulder, sp.arm, armLens[0], armLens[1]),
      armLens,
    );
    const legAngles = solve(hip, sp.leg, legLens[0], legLens[1]);
    const [, knee, ankle] = limb(hip, legAngles, legLens);
    // Vorderansicht: Fuß zeigt zum Betrachter und erscheint nur als kurzer Ansatz.
    const footLen = pose.view === 'front' ? BODY.foot * 0.45 : BODY.foot;
    const footAngle = legAngles[2] ?? (pose.view === 'front' ? (side === 'near' ? 200 : -20) : 0);
    const toe = add(ankle, dir(footAngle), footLen);
    Object.assign(joints, {
      [`${side}Shoulder`]: shoulder,
      [`${side}Elbow`]: elbow,
      [`${side}Wrist`]: wrist,
      [`${side}Hand`]: hand,
      [`${side}Hip`]: hip,
      [`${side}Knee`]: knee,
      [`${side}Ankle`]: ankle,
      [`${side}Toe`]: toe,
    });
    limbs[side] = {
      leg: [
        { from: hip, to: knee, w: STROKE.thigh, role },
        { from: knee, to: ankle, w: STROKE.shin, role },
        { from: ankle, to: toe, w: STROKE.foot, role },
      ],
      arm: [
        { from: shoulder, to: elbow, w: STROKE.upperArm, role },
        { from: elbow, to: wrist, w: STROKE.forearm, role },
        { from: wrist, to: hand, w: STROKE.hand, role },
      ],
    };
  }
  const top = add(pelvis, up, BODY.torso - 2);
  const torso: Vec[] = [
    add(top, perp, -shape.shoulderHalf),
    add(top, perp, shape.shoulderHalf),
    add(pelvis, perp, shape.hipHalf),
    add(pelvis, perp, -shape.hipHalf),
  ];
  return {
    joints,
    torso,
    head: { c: headC, r: BODY.headR },
    limbs,
  };
}

/** Tiefster Punkt der Körperkontur (inkl. Strichbreite). */
function lowestBodyPoint(sk: Skeleton): number {
  let min = sk.head.c[1] - sk.head.r;
  const all = [sk.limbs.near, sk.limbs.far].flatMap((l) => [...l.leg, ...l.arm]);
  for (const s of all) {
    min = Math.min(min, s.from[1] - s.w / 2, s.to[1] - s.w / 2);
  }
  for (const p of sk.torso) min = Math.min(min, p[1] - STROKE.torsoOutline / 2);
  return min;
}

/** Skelett an seiner endgültigen Stelle (Becken gesetzt oder auf Boden/Unterlage gestellt). */
export function placeSkeleton(pose: PoseSpec): Skeleton {
  if (pose.pelvis) return buildSkeleton(pose, pose.pelvis);
  const usesTargets = (['near', 'far'] as const).some(
    (side) => isTarget(pose[side].arm) || isTarget(pose[side].leg),
  );
  if (usesTargets) throw new Error('Zielpunkte (ik) brauchen ein festes Becken (pelvis).');
  const probe = buildSkeleton(pose, [0, 0]);
  return buildSkeleton(pose, [0, (pose.rest ?? 0) - lowestBodyPoint(probe)]);
}

function resolve(p: Point, sk: Skeleton): Vec {
  if (Array.isArray(p)) return p as Vec;
  const ref = p as { j: Joint; dx?: number; dy?: number };
  const base = sk.joints[ref.j];
  return [base[0] + (ref.dx ?? 0), base[1] + (ref.dy ?? 0)];
}

/** Ein Element im Bild (Weltkoordinaten), noch ohne Farbe. */
type Shape =
  | { k: 'line'; pts: Vec[]; w: number; role: Role }
  | { k: 'poly'; pts: Vec[]; role: Role; outline?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; r: number; role: Role }
  | { k: 'circle'; c: Vec; r: number; role: Role; ring?: number };

function propShape(prop: Prop, sk: Skeleton): Shape {
  switch (prop.t) {
    case 'line':
      return { k: 'line', pts: prop.points.map((p) => resolve(p, sk)), w: prop.w, role: prop.role };
    case 'poly':
      return { k: 'poly', pts: prop.points.map((p) => resolve(p, sk)), role: prop.role };
    case 'rect': {
      const [x, y] = resolve(prop.at, sk);
      return { k: 'rect', x, y, w: prop.w, h: prop.h, r: prop.r ?? 0, role: prop.role };
    }
    case 'circle':
      return { k: 'circle', c: resolve(prop.at, sk), r: prop.r, role: prop.role, ring: prop.ring };
  }
}

function bounds(shape: Shape): [number, number, number, number] {
  switch (shape.k) {
    case 'line': {
      const h = shape.w / 2;
      const xs = shape.pts.map((p) => p[0]);
      const ys = shape.pts.map((p) => p[1]);
      return [Math.min(...xs) - h, Math.min(...ys) - h, Math.max(...xs) + h, Math.max(...ys) + h];
    }
    case 'poly': {
      const h = (shape.outline ?? 0) / 2;
      const xs = shape.pts.map((p) => p[0]);
      const ys = shape.pts.map((p) => p[1]);
      return [Math.min(...xs) - h, Math.min(...ys) - h, Math.max(...xs) + h, Math.max(...ys) + h];
    }
    case 'rect':
      return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h];
    case 'circle': {
      const h = shape.r + (shape.ring ?? 0) / 2;
      return [shape.c[0] - h, shape.c[1] - h, shape.c[0] + h, shape.c[1] + h];
    }
  }
}

/** Fertige Szene: alle Formen in Zeichenreihenfolge, in Bildkoordinaten. */
export interface Scene {
  readonly shapes: readonly Shape[];
  /** Verschiebung Welt → Bild in x. */
  readonly offsetX: number;
  /** Umriss in Bildkoordinaten [x0, y0, x1, y1]. */
  readonly box: readonly [number, number, number, number];
}

export function buildScene(pose: PoseSpec): Scene {
  const sk = placeSkeleton(pose);
  const props = pose.props ?? [];
  const backProps = props.filter((p) => !p.front).map((p) => propShape(p, sk));
  const frontProps = props.filter((p) => p.front).map((p) => propShape(p, sk));
  const seg = (s: Segment): Shape => ({ k: 'line', pts: [s.from, s.to], w: s.w, role: s.role });
  // Vordere Glieder bekommen einen schmalen Rand in Hintergrundfarbe, damit sie sich vom Rumpf abheben.
  const outlined = (segs: readonly Segment[]): Shape[] => [
    ...segs.map((s) => ({ ...seg(s), w: s.w + 2 * STROKE.gap, role: 'gap' as const })),
    ...segs.map(seg),
  ];
  const head: Shape[] = pose.headOnTop
    ? [
        { k: 'circle', c: sk.head.c, r: sk.head.r + STROKE.gap, role: 'gap' },
        { k: 'circle', c: sk.head.c, r: sk.head.r, role: 'figure' },
      ]
    : [{ k: 'circle', c: sk.head.c, r: sk.head.r, role: 'figure' }];
  const torso: Shape[] = [
    { k: 'poly', pts: [...sk.torso], role: 'figure', outline: STROKE.torsoOutline },
    ...(pose.headOnTop ? [] : head),
  ];
  const { near, far } = sk.limbs;
  const body: Shape[] = [
    ...(pose.view === 'side'
      ? [
          ...far.leg.map(seg),
          ...far.arm.map(seg),
          ...torso,
          ...outlined(near.leg),
          ...outlined(near.arm),
        ]
      : [
          ...torso,
          ...outlined(near.leg),
          ...outlined(far.leg),
          ...outlined(near.arm),
          ...outlined(far.arm),
        ]),
    ...(pose.headOnTop ? head : []),
  ];
  const shapes: Shape[] = [...backProps, ...body, ...frontProps];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  // Der Trennrand ist auf der Karte unsichtbar und zählt nicht zum Umriss.
  for (const s of shapes.filter((shape) => shape.role !== 'gap')) {
    const [a, b, c, d] = bounds(s);
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  }
  // Waagerecht mittig, senkrecht fest auf der Bodenlinie.
  const offsetX = VIEW_WIDTH / 2 - (x0 + x1) / 2;
  return {
    shapes,
    offsetX,
    box: [x0 + offsetX, GROUND_Y - y1, x1 + offsetX, GROUND_Y - y0],
  };
}

const num = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

/** SVG-Text mit Farbmarken `{rolle}`; palette.ts setzt die Farben ein. */
export function renderTemplate(pose: PoseSpec): string {
  const scene = buildScene(pose);
  const X = (x: number) => num(x + scene.offsetX);
  const Y = (y: number) => num(GROUND_Y - y);
  const pts = (list: readonly Vec[]) => list.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ');
  const parts: string[] = [
    `<line x1="${VIEW_MARGIN * 2}" y1="${GROUND_Y + STROKE.ground / 2}" x2="${VIEW_WIDTH - VIEW_MARGIN * 2}" y2="${GROUND_Y + STROKE.ground / 2}" stroke="{ground}" stroke-width="${STROKE.ground}" stroke-linecap="round"/>`,
  ];
  for (const s of scene.shapes) {
    const color = `{${s.role}}`;
    switch (s.k) {
      case 'line':
        parts.push(
          s.pts.length === 2
            ? `<line x1="${X(s.pts[0]![0])}" y1="${Y(s.pts[0]![1])}" x2="${X(s.pts[1]![0])}" y2="${Y(s.pts[1]![1])}" stroke="${color}" stroke-width="${num(s.w)}" stroke-linecap="round"/>`
            : `<polyline points="${pts(s.pts)}" fill="none" stroke="${color}" stroke-width="${num(s.w)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        );
        break;
      case 'poly':
        parts.push(
          s.outline
            ? `<polygon points="${pts(s.pts)}" fill="${color}" stroke="${color}" stroke-width="${num(s.outline)}" stroke-linejoin="round"/>`
            : `<polygon points="${pts(s.pts)}" fill="${color}"/>`,
        );
        break;
      case 'rect':
        parts.push(
          `<rect x="${X(s.x)}" y="${Y(s.y + s.h)}" width="${num(s.w)}" height="${num(s.h)}"${s.r ? ` rx="${num(s.r)}"` : ''} fill="${color}"/>`,
        );
        break;
      case 'circle':
        parts.push(
          s.ring
            ? `<circle cx="${X(s.c[0])}" cy="${Y(s.c[1])}" r="${num(s.r)}" fill="none" stroke="${color}" stroke-width="${num(s.ring)}"/>`
            : `<circle cx="${X(s.c[0])}" cy="${Y(s.c[1])}" r="${num(s.r)}" fill="${color}"/>`,
        );
        break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" width="${VIEW_WIDTH}" height="${VIEW_HEIGHT}">${parts.join('')}</svg>`;
}
