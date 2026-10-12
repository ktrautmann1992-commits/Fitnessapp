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

/**
 * Gesundheitsbezogene und nährwertbezogene Angaben (Phase 5, Regel R10; docs/PLAN-PHASE-5.md Abschnitt 10):
 * VO (EG) Nr. 1924/2006 (Health-Claims-Verordnung) und VO (EU) Nr. 432/2012 (Liste zulässiger Angaben).
 * Rezept- und Lebensmitteltexte nennen neutrale Zahlen statt Versprechen oder Schlagworten. Nicht abschließend.
 */
export const HEALTH_CLAIM_TERMS: readonly TermRule[] = [
  { label: 'Immunsystem stärken', pattern: 'immunsystem', wholeWord: false },
  { label: 'Abwehrkräfte', pattern: 'abwehrkr(?:a|ä)ft', wholeWord: false },
  { label: 'Cholesterin senken', pattern: 'cholesterin', wholeWord: false },
  { label: 'entgiften', pattern: 'entgift', wholeWord: false },
  { label: 'Detox', pattern: 'detox', wholeWord: false },
  { label: 'Fatburner', pattern: 'fat\\s*-?\\s*burn', wholeWord: false },
  { label: 'Fettverbrennung', pattern: 'fettverbrenn', wholeWord: false },
  { label: 'Stoffwechsel ankurbeln', pattern: 'stoffwechsel', wholeWord: false },
  { label: 'Superfood', pattern: 'super\\s*-?\\s*food', wholeWord: false },
  { label: 'basisch', pattern: 'basisch', wholeWord: false },
  { label: 'Anti-Aging', pattern: 'anti\\s*-?\\s*aging', wholeWord: false },
  { label: 'schützt vor', pattern: 'sch(?:ü|ue)tz(?:t|en)\\s+vor', wholeWord: false },
  { label: 'eiweißreich', pattern: 'eiwei(?:ß|ss)reich', wholeWord: false },
  { label: 'proteinreich', pattern: 'proteinreich', wholeWord: false },
  { label: 'High Protein', pattern: 'high\\s*-?\\s*protein', wholeWord: false },
  { label: 'zuckerfrei', pattern: 'zuckerfrei', wholeWord: false },
  { label: 'ohne Zuckerzusatz', pattern: 'ohne\\s+zuckerzusatz', wholeWord: false },
  { label: 'light', pattern: 'light', wholeWord: true },
  { label: 'ballaststoffreich', pattern: 'ballaststoffreich', wholeWord: false },
  { label: 'vitaminreich', pattern: 'vitaminreich', wholeWord: false },
  { label: 'gesund', pattern: 'gesund(?!heits-?check)', wholeWord: false },
  // Nährwertbezogene Angaben aus dem Anhang der VO (EG) Nr. 1924/2006 und ähnliche Schlagworte (Wächter N2c, S1).
  // „fettreduziert“ bewusst NICHT: steht in Produktbezeichnungen von Zutaten (z. B. Kokosmilch fettreduziert).
  { label: 'fettarm', pattern: 'fettarm', wholeWord: false },
  { label: 'fettfrei', pattern: 'fettfrei', wholeWord: false },
  { label: 'kalorienarm', pattern: 'kalorienarm', wholeWord: false },
  { label: 'energiearm', pattern: 'energiearm', wholeWord: false },
  { label: 'zuckerarm', pattern: 'zuckerarm', wholeWord: false },
  { label: 'salzarm', pattern: 'salzarm', wholeWord: false },
  { label: 'natriumarm', pattern: 'natriumarm', wholeWord: false },
  { label: 'Low Carb/Low Fat', pattern: 'low\\s*-?\\s*(?:carb|fat)', wholeWord: false },
  { label: 'reich an', pattern: 'reich\\s+an', wholeWord: true },
  {
    label: 'Eiweiß-/Protein-/Ballaststoffquelle',
    pattern: '(?:eiwei(?:ß|ss)|protein|ballaststoff)-?quelle',
    wholeWord: false,
  },
  { label: 'schlank', pattern: 'schlank', wholeWord: false },
];

/** Lebensmittel-Marken (herstellerneutrale Rezepte: nur Produktarten, Gründer-Entscheidung 16 A Nr. 18). */
export const FORBIDDEN_FOOD_BRANDS: readonly TermRule[] = [
  'Nutella',
  'Philadelphia',
  'Maggi',
  'Knorr',
  'Alpro',
  'Oatly',
  'Barilla',
  'Kellogg',
  'Danone',
  'Activia',
  'Ehrmann',
  'Dr. Oetker',
  'Coca-Cola',
  'Red Bull',
  'Milka',
  'Lindt',
  'Haribo',
  'Heinz',
  'Tabasco',
  'Kerrygold',
  'Leerdammer',
  'Babybel',
  'Nesquik',
  'Nescafé',
  'Ovomaltine',
  'Lurpak',
  'Weihenstephan',
  'Rama',
].map((brand) => ({
  label: brand,
  pattern: brand.replace(/\./g, '\\.').replace(/-/g, '-?').replace(/ /g, '\\s*'),
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

const COMPILED_NUTRITION = [
  ...COMPILED,
  ...HEALTH_CLAIM_TERMS.map((rule) => ({ kind: 'health_claim' as const, rule, re: compile(rule) })),
  ...FORBIDDEN_FOOD_BRANDS.map((rule) => ({ kind: 'brand' as const, rule, re: compile(rule) })),
];

export interface TextRuleHit {
  readonly kind: 'medical' | 'brand' | 'health_claim';
  /** Gefundene Stelle im Text. */
  readonly match: string;
  readonly label: string;
}

function findHits(text: string, compiled: typeof COMPILED_NUTRITION): TextRuleHit[] {
  const hits: TextRuleHit[] = [];
  // NFC: zerlegte Umlaute (z. B. aus macOS-Kopien) wie zusammengesetzte behandeln (Wächter N2a, B2).
  const normalized = text.normalize('NFC');
  for (const { kind, rule, re } of compiled) {
    const found = re.exec(normalized);
    if (found) {
      hits.push({ kind, match: found[0], label: rule.label });
    }
  }
  return hits;
}

/** Alle Verstöße in einem Text (leer = in Ordnung). Übungen und Vorlagen (Regel Ü6). */
export function findTextRuleHits(text: string): TextRuleHit[] {
  return findHits(text, COMPILED);
}

/**
 * Wie `findTextRuleHits`, zusätzlich Health-Claims, Nährwert-Schlagworte und Lebensmittel-Marken – für
 * Rezepte und Lebensmittel (Regel R10).
 */
export function findNutritionTextRuleHits(text: string): TextRuleHit[] {
  return findHits(text, COMPILED_NUTRITION);
}
