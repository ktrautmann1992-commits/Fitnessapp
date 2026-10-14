import { type Food, isCatalogReviewed } from './food-schema';
import { type PackageSize, packageSizeContentId } from './package-size-schema';
import { type ContentIssue, makeIssue } from './rules';

/**
 * Regel R24 für die Packungsgrößen (docs/PLAN-PHASE-5.md 19.7 N11), rot:
 * - das Lebensmittel existiert, ist nicht zurückgezogen und katalog-geprüft (R19); ein freigegebener Eintrag nur mit
 *   freigegebenem Lebensmittel;
 * - eine Packung ist nicht kleiner als ein Stück des Lebensmittels (`units.piece_g`, Plausibilität);
 * - je Lebensmittel nur ein Eintrag (nicht zurückgezogen);
 * - die ID passt zum Lebensmittel (`packung-<lebensmittel>`, `packageSizeContentId`) – sonst überspränge die Pipeline
 *   das genannte Lebensmittel und die ID des anderen wäre belegt (Wächter N11 H6).
 * Der Wertebereich 1–5.000 g ist Teil des Schemas (R1, rot auch bei Entwürfen).
 */

type Target = Parameters<typeof makeIssue>[1];

function target(entry: Pick<PackageSize, 'id' | 'status'>): Target {
  return { kind: 'package_size', id: entry.id, status: entry.status };
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** Prüft einen Packungsgrößen-Eintrag gegen den Katalog (R24). */
export function checkPackageSize(
  entry: PackageSize,
  foods: ReadonlyMap<string, Food>,
): ContentIssue[] {
  const t = target(entry);
  const idIssues =
    entry.id === packageSizeContentId(entry.food_id)
      ? []
      : [
          makeIssue(
            'R24',
            t,
            `ID passt nicht zum Lebensmittel – erwartet „${packageSizeContentId(entry.food_id)}“.`,
            'id',
          ),
        ];
  const food = foods.get(entry.food_id);
  if (food === undefined) {
    return [
      ...idIssues,
      makeIssue('R24', t, `Lebensmittel „${entry.food_id}“ fehlt im Katalog.`, 'food_id'),
    ];
  }
  if (food.status === 'archived') {
    return [
      ...idIssues,
      makeIssue('R24', t, `Lebensmittel „${entry.food_id}“ ist zurückgezogen.`, 'food_id'),
    ];
  }
  const issues: ContentIssue[] = [...idIssues];
  if (!isCatalogReviewed(food)) {
    issues.push(
      makeIssue(
        'R24',
        t,
        `Lebensmittel „${entry.food_id}“ ist noch nicht katalog-geprüft (R19).`,
        'food_id',
      ),
    );
  }
  if (entry.status === 'published' && food.status !== 'published') {
    issues.push(
      makeIssue(
        'R24',
        t,
        `Freigegebene Packungsgröße zum nicht freigegebenen Lebensmittel „${entry.food_id}“.`,
        'food_id',
      ),
    );
  }
  const piece = food.units.piece_g;
  if (piece !== undefined && entry.package_size_g < piece) {
    issues.push(
      makeIssue(
        'R24',
        t,
        `Packung ${fmt(entry.package_size_g)} g ist kleiner als ein Stück „${food.name_de}“ (${fmt(piece)} g).`,
        'package_size_g',
      ),
    );
  }
  return issues;
}

/** Je Lebensmittel nur ein (nicht zurückgezogener) Eintrag (R24). */
export function checkPackageSizeLibrary(entries: readonly PackageSize[]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Map<string, string>();
  for (const entry of [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (entry.status === 'archived') continue;
    const first = seen.get(entry.food_id);
    if (first !== undefined) {
      issues.push(
        makeIssue(
          'R24',
          target(entry),
          `Für „${entry.food_id}“ gibt es schon eine Packungsgröße („${first}“).`,
          'food_id',
        ),
      );
      continue;
    }
    seen.set(entry.food_id, entry.id);
  }
  return issues;
}

/**
 * Packungsgröße je Lebensmittel aus einem schon ausgewählten Bestand (`NutritionLibrary.packageSizes`): je
 * Lebensmittel der erste Eintrag nach ID. Für die Resteplanung (N13/N14).
 */
export function packageSizeLookup(entries: readonly PackageSize[]): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (const entry of [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!map.has(entry.food_id)) map.set(entry.food_id, entry.package_size_g);
  }
  return map;
}
