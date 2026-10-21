import { brandColors } from '@fitnessapp/ui';

import type { Role } from './rig';

/**
 * Farben der Übungs-Illustrationen hell/dunkel (docs/DESIGN.md „Übungs-Illustrationen“). Markenfarben aus
 * packages/ui (theme.css), Zwischentöne wie bei der Muskelkarte. Die SVG-Dateien unter apps/mobile/assets/ sind in den
 * hellen Farben gespeichert; die App setzt je nach Modus die passende Palette in die Vorlage ein.
 */
export const ILLUSTRATION_PALETTE: Readonly<
  Record<'light' | 'dark', Readonly<Record<Role, string>>>
> = {
  light: {
    figure: brandColors.graphitHell.toLowerCase(),
    figureFar: '#8a93a6',
    equip: brandColors.blau.toLowerCase(),
    equipSoft: brandColors.himmel.toLowerCase(),
    furniture: '#d5dbe5',
    furnitureLine: '#9aa4b8',
    ground: brandColors.grauDunkel.toLowerCase(),
    gap: brandColors.weiss.toLowerCase(),
  },
  dark: {
    figure: brandColors.eisblau.toLowerCase(),
    figureFar: '#7d869a',
    equip: '#4d7dff',
    equipSoft: '#3b5bab',
    furniture: '#2c3342',
    furnitureLine: '#4f5a70',
    ground: '#3a4254',
    gap: brandColors.graphit.toLowerCase(),
  },
};

/** Setzt die Farben einer Palette in eine Vorlage mit Marken `{rolle}` ein. */
export function applyPalette(template: string, palette: Readonly<Record<Role, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, role: string) =>
    Object.hasOwn(palette, role) ? palette[role as Role] : match,
  );
}
