import { canonicalJson } from '../content/canonical-json';
import { stableHash } from '../nutrition/stable-hash';

/**
 * Stabiler Fingerabdruck einer Anpassung (docs/PLAN-PHASE-4B.md 5.3): Regel, Übung bzw. Einheiten und Basis-Einträge
 * als kanonisches JSON, daraus zwei FNV-1a-Hashes (64 Bit, hex). `unique (user_id, rule, input_fingerprint)` sorgt
 * dafür, dass dieselbe Lage nie zweimal angepasst wird (auch nach „Rückgängig“). Gleiche Eingaben → gleicher Wert.
 */
export function inputFingerprint(rule: string, parts: Readonly<Record<string, unknown>>): string {
  const text = canonicalJson({ rule, ...parts });
  const a = stableHash(text);
  const b = stableHash(`${text.length}|${[...text].reverse().join('')}`);
  return `${rule}:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
