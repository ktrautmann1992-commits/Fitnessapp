/**
 * Design-Tokens für App und Website.
 *
 * Die Werte stehen NICHT hier, sondern in packages/ui/theme.css (einzige Quelle).
 * Daraus wird tokens.generated.ts automatisch erzeugt – siehe docs/DESIGN.md.
 */
export {
  areaColors,
  brandColors,
  cardColors,
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  heroColors,
  largeViewColors,
  maxContentWidth,
  radius,
  spacing,
  type AreaColorRole,
  type AreaId,
  type BrandColor,
  type ColorScheme,
  type ColorToken,
} from './tokens.generated';

import type { AreaColorRole } from './tokens.generated';

/** Farben eines Bereichs (Chip-Fläche, Icon/Akzent, kräftig, zart) in einem Modus. */
export type AreaPalette = Record<AreaColorRole, string>;
