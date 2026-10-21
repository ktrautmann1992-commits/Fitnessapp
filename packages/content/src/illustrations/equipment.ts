import type { Point, Prop } from './rig';

/**
 * Bausteine für Geräte und Möbel der Übungs-Illustrationen. Alles flach und angedeutet: Geräte in Markenblau
 * (`equip`), Möbel/Maschinen in Grau (`furniture`, `furnitureLine`). Koordinaten wie im Rig (Boden y = 0, x nach vorn).
 */

type Vec = readonly [number, number];
const rad = (deg: number) => (deg * Math.PI) / 180;
export const along = (from: Vec, angle: number, len: number): Vec => [
  from[0] + Math.cos(rad(angle)) * len,
  from[1] + Math.sin(rad(angle)) * len,
];

/** Langhantel von der Seite (Stange zeigt zum Betrachter): Hantelscheibe als Ring mit Nabe – Hände bleiben sichtbar. */
export function barbellEnd(at: Point): Prop[] {
  return [
    { t: 'circle', at, r: 14, ring: 3.5, role: 'equip', front: true },
    { t: 'circle', at, r: 3, role: 'equip', front: true },
  ];
}

/** Langhantel von vorn: waagerechte Stange mit Scheiben. */
export function barbellFront(center: Vec, halfWidth = 62): Prop[] {
  const [x, y] = center;
  return [
    {
      t: 'line',
      points: [
        [x - halfWidth, y],
        [x + halfWidth, y],
      ],
      w: 3,
      role: 'equip',
      front: true,
    },
    { t: 'rect', at: [x - halfWidth - 2, y - 14], w: 6, h: 28, r: 2, role: 'equip', front: true },
    { t: 'rect', at: [x + halfWidth - 4, y - 14], w: 6, h: 28, r: 2, role: 'equip', front: true },
  ];
}

/** Kurzhantel, Griff zeigt zum Betrachter (Ansicht von der Stirnseite). */
export function dumbbellEnd(at: Point, front = true): Prop[] {
  return [
    { t: 'circle', at, r: 6, role: 'equip', front },
    { t: 'circle', at, r: 2, role: 'equipSoft', front },
  ];
}

/** Punkt verschoben (auch Gelenkbezüge). */
export function offset(p: Point, dx: number, dy: number): Point {
  if (Array.isArray(p)) return [(p as Vec)[0] + dx, (p as Vec)[1] + dy];
  const ref = p as { j: Extract<Point, { j: unknown }>['j']; dx?: number; dy?: number };
  return { j: ref.j, dx: (ref.dx ?? 0) + dx, dy: (ref.dy ?? 0) + dy };
}

/** Kurzhantel im Profil: Griff in Richtung `angle` (0 = waagerecht nach vorn, 90 = senkrecht). */
export function dumbbellSide(at: Point, angle = 0, front = true): Prop[] {
  const [ax, ay] = along([0, 0], angle, 7);
  const [px, py] = along([0, 0], angle + 90, 5.5);
  const a = offset(at, ax, ay);
  const b = offset(at, -ax, -ay);
  const plate = (c: Point): Prop => ({
    t: 'line',
    points: [offset(c, px, py), offset(c, -px, -py)],
    w: 4.5,
    role: 'equip',
    front,
  });
  return [{ t: 'line', points: [a, b], w: 3, role: 'equip', front }, plate(a), plate(b)];
}

export function kettlebell(base: Vec): Prop[] {
  const [x, y] = base;
  return [
    { t: 'circle', at: [x, y + 18], r: 5, ring: 3, role: 'equip', front: true },
    { t: 'circle', at: [x, y + 8], r: 8, role: 'equip', front: true },
  ];
}

/** Widerstandsband als Linie (Punkte dürfen Gelenke sein). */
export function band(points: Point[], front = true): Prop {
  return { t: 'line', points, w: 2.5, role: 'equip', front };
}

/** Flachbank im Profil: Polster von x0 bis x1, Oberkante bei `top`. */
export function bench(x0: number, x1: number, top = 32): Prop[] {
  return [
    { t: 'rect', at: [x0 + 6, 0], w: 4, h: top - 6, role: 'furnitureLine' },
    { t: 'rect', at: [x1 - 10, 0], w: 4, h: top - 6, role: 'furnitureLine' },
    { t: 'rect', at: [x0, top - 7], w: x1 - x0, h: 7, r: 3, role: 'furnitureLine' },
  ];
}

/** Bank quer zur Blickrichtung (Stirnseite sichtbar). */
export function benchEnd(x: number, top = 32, width = 26): Prop[] {
  return [
    { t: 'rect', at: [x + 4, 0], w: width - 8, h: top - 6, role: 'furniture' },
    { t: 'rect', at: [x, top - 7], w: width, h: 7, r: 3, role: 'furnitureLine' },
  ];
}

/** Stuhl im Profil. `facing` = Richtung, in die man auf ihm sitzt (1 = nach vorn/rechts). */
export function chair(x: number, facing: 1 | -1 = 1, seat = 33, depth = 28): Prop[] {
  const back = facing === 1 ? x : x + depth;
  const front = facing === 1 ? x + depth : x;
  return [
    {
      t: 'line',
      points: [
        [back, 0],
        [back, seat + 34],
      ],
      w: 4,
      role: 'furnitureLine',
    },
    {
      t: 'line',
      points: [
        [front, 0],
        [front, seat],
      ],
      w: 4,
      role: 'furnitureLine',
    },
    {
      t: 'line',
      points: [
        [back, seat],
        [front, seat],
      ],
      w: 5,
      role: 'furnitureLine',
    },
  ];
}

/** Sofa im Profil, Sitzfläche zeigt nach `facing`. */
export function sofa(x: number, facing: 1 | -1 = 1, seat = 30, depth = 56, legs = 0): Prop[] {
  const x0 = facing === 1 ? x : x - depth;
  const backX = facing === 1 ? x0 : x0 + depth - 14;
  return [
    { t: 'rect', at: [x0, legs], w: depth, h: seat - legs, r: 4, role: 'furniture' },
    { t: 'rect', at: [backX, legs], w: 14, h: seat + 26 - legs, r: 5, role: 'furniture' },
    ...(legs > 0
      ? ([
          { t: 'rect', at: [x0 + 3, 0], w: 4, h: legs, role: 'furnitureLine' },
          { t: 'rect', at: [x0 + depth - 7, 0], w: 4, h: legs, role: 'furnitureLine' },
        ] as Prop[])
      : []),
  ];
}

/** Treppenstufe(n): Kasten von x0 bis x1 mit Höhe h. */
export function step(x0: number, x1: number, h = 14): Prop {
  return { t: 'rect', at: [x0, 0], w: x1 - x0, h, r: 1.5, role: 'furniture' };
}

/** Wand bzw. Türrahmen (senkrechter Streifen). */
export function wall(x: number, width = 7, height = 150): Prop {
  return { t: 'rect', at: [x, 0], w: width, h: height, role: 'furniture' };
}

/** Wand im Hintergrund (parallel zur Bildebene, z. B. „seitlich neben einer Wand“). */
export function backWall(x0: number, x1: number, height = 140): Prop {
  return { t: 'rect', at: [x0, 0], w: x1 - x0, h: height, r: 3, role: 'furniture' };
}

/** Tisch im Profil, Platte bei `top`. */
export function table(x0: number, x1: number, top = 56): Prop[] {
  return [
    {
      t: 'line',
      points: [
        [x0 + 4, 0],
        [x0 + 4, top],
      ],
      w: 4,
      role: 'furnitureLine',
    },
    {
      t: 'line',
      points: [
        [x1 - 4, 0],
        [x1 - 4, top],
      ],
      w: 4,
      role: 'furnitureLine',
    },
    {
      t: 'line',
      points: [
        [x0, top],
        [x1, top],
      ],
      w: 6,
      role: 'furnitureLine',
    },
  ];
}

/** Rack-Ständer mit Ablage (Hintergrund). */
export function rack(x: number, hookY: number, height = 150): Prop[] {
  return [
    {
      t: 'line',
      points: [
        [x, 0],
        [x, height],
      ],
      w: 5,
      role: 'furnitureLine',
    },
    {
      t: 'line',
      points: [
        [x - 6, hookY],
        [x + 6, hookY],
        [x + 6, hookY + 5],
      ],
      w: 3,
      role: 'furnitureLine',
    },
  ];
}

/** Klimmzugstange von der Seite (Stange zeigt zum Betrachter) mit Halterung nach oben. */
export function pullUpBar(at: Vec, top = 164): Prop[] {
  return [
    {
      t: 'line',
      points: [
        [at[0] - 14, top],
        [at[0] - 14, at[1] + 6],
        [at[0], at[1]],
      ],
      w: 4,
      role: 'furnitureLine',
    },
    { t: 'circle', at, r: 3.5, role: 'equip', front: true },
  ];
}

/** Kabelzug-Turm mit Rolle; Seil zur Hand bzw. zum Griff. */
export function cableTower(
  x: number,
  pulleyY: number,
  to: Point,
  width = 12,
  height = 150,
): Prop[] {
  return [
    { t: 'rect', at: [x, 0], w: width, h: height, r: 2, role: 'furniture' },
    { t: 'circle', at: [x + width / 2, pulleyY], r: 4, role: 'furnitureLine' },
    { t: 'line', points: [[x + width / 2, pulleyY], to], w: 1.8, role: 'equip', front: true },
  ];
}

/** Kleiner Griff (Seil/Stange) an einem Punkt. */
export function handle(at: Point, front = true): Prop {
  return { t: 'circle', at, r: 3.5, role: 'equip', front };
}

/** Matte/Handtuch flach am Boden. */
export function mat(x0: number, x1: number, h = 3): Prop {
  return { t: 'rect', at: [x0, 0], w: x1 - x0, h, r: 1.5, role: 'equipSoft' };
}
