import { findNutritionTextRuleHits } from '../content/text-rules';
import { SUPPLEMENT_PLACEHOLDERS } from './notices';

/**
 * Formulierungsregeln für Supplement-Texte (docs/PLAN-PHASE-6.md 3.8 Nr. 2 und 3): keine Heilversprechen, keine
 * Leistungsversprechen, keine Diagnose-Wörter, keine Marken, keine Zahlen im Freitext. Gilt für alle Freitexte –
 * Hinweise im Core, App-Texte (`i18n/de-supplements.ts`, SU4) und Inhalte (`content/supplements`, SK3/SK5 in SU2).
 * Die Angaben aus `APPROVED_CLAIMS` und die Pflichtsätze haben einen eigenen Prüfweg und sind hier ausgenommen.
 * Nicht abschließend – im Zweifel umformulieren. Wortgrenzen beachten Umlaute, Groß-/Kleinschreibung egal.
 */

interface SupplementTermRule {
  readonly label: string;
  /** Regulärer Ausdruck ab Wortanfang. */
  readonly pattern: string;
  /** true = nur ganzes Wort. */
  readonly wholeWord: boolean;
}

/** Neue Wörter nur für Supplemente (Plan 3.8 Nr. 2), zusätzlich zu den bestehenden Listen. */
export const SUPPLEMENT_FORBIDDEN_TERMS: readonly SupplementTermRule[] = [
  // Auch abgeleitete Formen („gesteigerte“, „Energiebooster“, „gestärkt“, „stärker“), Wächter SU1 Befund 2.
  { label: 'steigert', pattern: '(?:ge)?steiger(?:t|te|ten|ter|n|e|st|ung)', wholeWord: false },
  { label: 'Leistungssteigerung', pattern: 'leistungs-?steiger', wholeWord: false },
  { label: 'leistungsfähig', pattern: 'leistungsf(?:ä|ae)hig', wholeWord: false },
  { label: 'verbessert', pattern: 'verbesser', wholeWord: false },
  { label: 'boost/Booster', pattern: '\\p{L}*boost', wholeWord: false },
  { label: 'beschleunigt', pattern: 'beschleunig', wholeWord: false },
  { label: 'Konzentration', pattern: 'konzentr(?:ation|ier)', wholeWord: false },
  { label: 'wach', pattern: 'wach(?:er|e|en|em|es|heit|macher)?', wholeWord: true },
  { label: 'anabol', pattern: 'anabol', wholeWord: false },
  { label: 'Testosteron', pattern: 'testo', wholeWord: false },
  { label: 'Hormon', pattern: 'hormon', wholeWord: false },
  { label: 'bewiesen', pattern: '(?:bewiesen|beweis)', wholeWord: false },
  {
    label: 'wissenschaftlich belegt',
    pattern: 'wissenschaftlich\\s+(?:belegt|bestätigt|erwiesen)',
    wholeWord: false,
  },
  { label: 'klinisch', pattern: 'klinisch', wholeWord: false },
  // „Mangel“ klingt nach Diagnose (auch in Zusammensetzungen wie „Eisenmangel“, „Vitamin-D-Mangel“).
  { label: 'Mangel', pattern: '\\p{L}*mangel', wholeWord: false },
  { label: 'dopingfrei', pattern: 'doping-?frei', wholeWord: false },
  { label: 'sauber', pattern: 'sauber', wholeWord: false },
  { label: '100 %', pattern: '100\\s*(?:%|prozent)', wholeWord: false },
  { label: 'natürlich', pattern: 'nat(?:ü|ue)rlich', wholeWord: false },
  { label: 'Abnehmen mit', pattern: 'abnehmen\\s+mit', wholeWord: false },
  { label: 'schützt', pattern: 'sch(?:ü|ue)tz(?:t|en|end)', wholeWord: false },
  {
    label: 'stärkt',
    pattern: '(?:ge)?st(?:ä|ae)rk(?:t|te|ter|en|end|ung|er)',
    wholeWord: false,
  },
  // Alle Wortformen („wirksamsten“, „Wirkungsweise“), Wächter SU2 M4.
  { label: 'Wirkung', pattern: 'wirk(?:ung|sam|t|en)\\p{L}*', wholeWord: false },
  { label: 'effektiv', pattern: 'effektiv', wholeWord: false },
  { label: 'verbrennt', pattern: 'verbrenn', wholeWord: false },
  {
    label: 'mehr Kraft/Muskeln/Ausdauer/Energie/Power',
    pattern: 'mehr\\s+(?:kraft|muskel|ausdauer|energie|power)',
    wholeWord: false,
  },
  {
    label: 'erhöht … Kraft/Muskeln',
    pattern: 'erh(?:ö|oe)h\\p{L}*\\s+(?:\\p{L}+\\s+){0,3}?\\p{L}*(?:kraft|muskel)',
    wholeWord: false,
  },
  { label: 'hilft bei', pattern: 'hilf(?:t|en)\\s+(?:dir\\s+|dich\\s+)?beim?', wholeWord: true },
  { label: 'gegen …', pattern: 'gegen\\s+\\p{L}+', wholeWord: false },
  { label: 'fördert', pattern: 'f(?:ö|oe)rder(?:t|n|e|st)', wholeWord: true },
  {
    label: 'erhöht die Leistung',
    pattern: 'erh(?:ö|oe)h(?:t|en|e)\\s+(?:die\\s+|deine\\s+)?(?:\\p{L}+\\s+)?leistung',
    wholeWord: false,
  },
  { label: 'Leistungsplus', pattern: 'leistungs-?plus', wholeWord: false },
  { label: 'Fett verbrennen', pattern: 'fett\\s*-?\\s*verbrenn', wholeWord: false },
];

/**
 * Mengen-Wörter: Einheiten und Zahlwörter sind wie Ziffern verboten (Dosis nur über Platzhalter, Plan 3.8 Nr. 3;
 * Wächter SU1 Befund 5). „ein/eine“ bleibt erlaubt (Artikel), „auf einmal“ ebenso.
 */
export const SUPPLEMENT_AMOUNT_WORDS: readonly SupplementTermRule[] = [
  {
    label: 'Einheit',
    pattern:
      '(?:mg|g|gr|kg|µg|μg|ug|mcg|ie|i\\.\\s?e\\.|milligramm|gramm|mikrogramm|kilogramm|internationale\\s+einheit(?:en)?)',
    wholeWord: true,
  },
  {
    label: 'Zahlwort',
    pattern:
      '(?:eins|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:ö|oe)lf' +
      // dreizehn–neunzehn (Wächter SU2 M1)
      '|(?:drei|vier|f(?:ü|ue)nf|sech|sieb|acht|neun)zehn' +
      // zwanzig–neunzig, auch „einundzwanzig“ … „neunundneunzig“
      '|(?:(?:ein|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht|neun)und)?(?:zwanzig|drei(?:ß|ss)ig|vierzig|f(?:ü|ue)nfzig|sechzig|siebzig|achtzig|neunzig)' +
      '|dutzend)',
    wholeWord: true,
  },
  // Alles mit hundert/tausend, auch „dreihundert“, „achthundert“ (ohne Wortgrenze am Ende).
  { label: 'Zahlwort', pattern: '\\p{L}*(?:hundert|tausend)', wholeWord: false },
  // Mengen ohne Zahl: halb, halbe, Halbmarathon; doppelt, doppelte (Wächter SU2 M1).
  { label: 'Mengenwort', pattern: '(?:halb|doppel)\\p{L}*', wholeWord: false },
];

export type SupplementTextHitKind =
  'medical' | 'brand' | 'health_claim' | 'supplement' | 'number' | 'unknown_placeholder';

export interface SupplementTextHit {
  readonly kind: SupplementTextHitKind;
  readonly match: string;
  readonly label: string;
}

function compile(rule: SupplementTermRule): RegExp {
  const end = rule.wholeWord ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${rule.pattern})${end}`, 'iu');
}

const COMPILED_SUPPLEMENT = SUPPLEMENT_FORBIDDEN_TERMS.map((rule) => ({
  rule,
  re: compile(rule),
}));

const COMPILED_AMOUNT = SUPPLEMENT_AMOUNT_WORDS.map((rule) => ({ rule, re: compile(rule) }));

const PLACEHOLDER_RE = /\{([^{}]*)\}/g;
const KNOWN_PLACEHOLDERS: ReadonlySet<string> = new Set(SUPPLEMENT_PLACEHOLDERS);

/**
 * Alle Verstöße in einem Supplement-Text (leer = in Ordnung):
 * - bestehende Listen (FORBIDDEN_MEDICAL_TERMS, FORBIDDEN_BRANDS, HEALTH_CLAIM_TERMS, FORBIDDEN_FOOD_BRANDS),
 * - SUPPLEMENT_FORBIDDEN_TERMS,
 * - Zahlen, Zahlwörter und Einheiten im Freitext (Dosis, mg, g, µg, IE nur über Platzhalter, Plan 3.8 Nr. 3),
 * - unbekannte Platzhalter.
 */
export function checkSupplementText(text: string): SupplementTextHit[] {
  const normalized = text.normalize('NFC');
  const hits: SupplementTextHit[] = findNutritionTextRuleHits(normalized).map((hit) => ({
    kind: hit.kind,
    match: hit.match,
    label: hit.label,
  }));
  for (const { rule, re } of COMPILED_SUPPLEMENT) {
    const found = re.exec(normalized);
    if (found) {
      hits.push({ kind: 'supplement', match: found[0], label: rule.label });
    }
  }
  for (const [, name] of normalized.matchAll(PLACEHOLDER_RE)) {
    if (!KNOWN_PLACEHOLDERS.has(name ?? '')) {
      hits.push({
        kind: 'unknown_placeholder',
        match: `{${name}}`,
        label: 'Unbekannter Platzhalter',
      });
    }
  }
  const withoutPlaceholders = normalized.replace(PLACEHOLDER_RE, '');
  const number = /\p{N}/u.exec(withoutPlaceholders);
  if (number) {
    hits.push({ kind: 'number', match: number[0], label: 'Zahl im Freitext' });
  }
  for (const { rule, re } of COMPILED_AMOUNT) {
    const found = re.exec(withoutPlaceholders);
    if (found) {
      hits.push({ kind: 'number', match: found[0], label: rule.label });
    }
  }
  return hits;
}
