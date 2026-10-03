/**
 * Textregeln für Inhalte (Regel Ü6, rot): keine Heilversprechen, keine medizinischen Aussagen, keine Marken.
 *
 * Hintergrund: Übungstexte beschreiben Technik, keine Behandlung (Abgrenzung zum Medizinprodukt, MDR;
 * Health-Claims-Verordnung (EG) Nr. 1924/2006 für gesundheitsbezogene Aussagen; docs/KONZEPT.md Abschnitt 14,
 * docs/PLAN-PHASE-2.md Abschnitt 8). Die Listen sind bewusst streng und nicht abschließend – im Zweifel
 * umformulieren. Wortgrenzen beachten Umlaute (\p{L}), damit z. B. „Medizinball“ erlaubt bleibt.
 */

interface TermRule {
  /** Anzeige im Prüfbericht. */
  readonly label: string;
  /** Wortanfang (Präfix) bzw. ganzes Wort, ohne Groß-/Kleinschreibung. */
  readonly pattern: string;
  /** true = nur ganzes Wort, false = Wortanfang (z. B. „therap“ trifft „Therapie“, „therapeutisch“). */
  readonly wholeWord: boolean;
}

/** Medizinische Aussagen und Heilversprechen. */
export const FORBIDDEN_MEDICAL_TERMS: readonly TermRule[] = [
  { label: 'heilen/Heilung', pattern: 'heil', wholeWord: false },
  { label: 'Therapie', pattern: 'therap', wholeWord: false },
  { label: 'Diagnose', pattern: 'diagnos', wholeWord: false },
  { label: 'garantiert', pattern: 'garant', wholeWord: false },
  { label: 'schmerzfrei', pattern: 'schmerzfrei', wholeWord: false },
  { label: 'Reha', pattern: 'reha', wholeWord: false },
  { label: 'lindern', pattern: 'linder', wholeWord: false },
  { label: 'kurieren', pattern: 'kurier', wholeWord: false },
  { label: 'Behandlung', pattern: 'behandl', wholeWord: false },
  { label: 'behandeln', pattern: 'behandel', wholeWord: false },
  { label: 'medizinisch', pattern: 'medizin(?!ball)', wholeWord: false },
  { label: 'Krankheit', pattern: 'krankheit', wholeWord: false },
  { label: 'Erkrankung', pattern: 'erkrank', wholeWord: false },
  { label: 'Prävention', pattern: 'präventi', wholeWord: false },
  { label: 'Arthrose', pattern: 'arthros', wholeWord: false },
  { label: 'Bandscheibe', pattern: 'bandscheib', wholeWord: false },
  { label: 'Osteoporose', pattern: 'osteopor', wholeWord: false },
  { label: 'Diabetes', pattern: 'diabet', wholeWord: false },
  { label: 'Bluthochdruck', pattern: 'bluthochdruck', wholeWord: false },
  { label: 'Depression', pattern: 'depressi', wholeWord: false },
  { label: 'Wundermittel', pattern: 'wunder(?:mittel|waffe)', wholeWord: false },
];

/**
 * Marken (herstellerneutrale Inhalte, CLAUDE.md „Affiliate & Werbung“). Nicht abschließend.
 * Bindestrich und Leerzeichen sind optional: „Thera-Band“ trifft auch „Theraband“, „Concept 2“ auch „Concept2“.
 */
export const FORBIDDEN_BRANDS: readonly TermRule[] = [
  'TRX',
  'Thera-Band',
  'Blackroll',
  'Bosu',
  'Technogym',
  'Life Fitness',
  'Gym80',
  'Hammer Strength',
  'Concept 2',
  'Kettler',
  'Peloton',
  'Bowflex',
  'Rogue',
  'Eleiko',
  'Nike',
  'Adidas',
  'Reebok',
  'Under Armour',
  'Gymshark',
  'Garmin',
  'Fitbit',
].map((brand) => ({
  label: brand,
  pattern: brand.replace(/-/g, '-?').replace(/ /g, '\\s*'),
  wholeWord: true,
}));

function compile(rule: TermRule): RegExp {
  const end = rule.wholeWord ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${rule.pattern})${end}`, 'iu');
}

const COMPILED = [
  ...FORBIDDEN_MEDICAL_TERMS.map((rule) => ({ kind: 'medical' as const, rule, re: compile(rule) })),
  ...FORBIDDEN_BRANDS.map((rule) => ({ kind: 'brand' as const, rule, re: compile(rule) })),
];

export interface TextRuleHit {
  readonly kind: 'medical' | 'brand';
  /** Gefundene Stelle im Text. */
  readonly match: string;
  readonly label: string;
}

/** Alle Verstöße in einem Text (leer = in Ordnung). */
export function findTextRuleHits(text: string): TextRuleHit[] {
  const hits: TextRuleHit[] = [];
  for (const { kind, rule, re } of COMPILED) {
    const found = re.exec(text);
    if (found) {
      hits.push({ kind, match: found[0], label: rule.label });
    }
  }
  return hits;
}
