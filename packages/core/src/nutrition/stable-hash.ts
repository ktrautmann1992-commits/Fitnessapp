/**
 * Deterministisches Gleichstand-Auflösen im Essensplan (docs/PLAN-PHASE-5.md 4.1 `stable-hash.ts`, 6.3 Nr. 4):
 * FNV-1a (32 Bit) über einen Text. Kein `Math.random` – gleiche Eingabe, gleicher Plan.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32 Bit über die UTF-16-Code-Units des Texts (Ergebnis 0 … 2³² − 1). */
export function stableHash(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** Hash der mit „|“ verbundenen Teile, z. B. `stableHashKey(woche, platz, rezept, variante)`. */
export function stableHashKey(...parts: readonly (string | number)[]): number {
  return stableHash(parts.map(String).join('|'));
}

/** Hash als Zahl in [0; 1) – für feste „Streuung“ ohne Zufall. */
export function stableUnit(...parts: readonly (string | number)[]): number {
  return stableHashKey(...parts) / 2 ** 32;
}
