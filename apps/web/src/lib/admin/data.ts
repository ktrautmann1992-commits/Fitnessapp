/**
 * Katalog des Redaktionsbereichs aus den beim Bauen gebündelten Repository-Dateien
 * (scripts/bundle-content.mjs → src/generated/content-files.ts). Einmal je Server-Instanz berechnet.
 */
import { CONTENT_BUNDLE } from '@/generated/content-files';

import { buildCatalog, type Catalog } from './catalog';

let cached: Catalog | undefined;

export function getCatalog(): Catalog {
  cached ??= buildCatalog(CONTENT_BUNDLE.files, CONTENT_BUNDLE.strayFiles);
  return cached;
}
