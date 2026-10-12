import { normalizeFoodText } from './allergen-rules';
import { CARB_LOADING_NOTICE_DE, type Guide } from './guide-schema';
import { type ContentIssue, makeIssue } from './rules';
import { findNutritionTextRuleHits } from './text-rules';

/**
 * Regel R21 für Ratgeber (docs/PLAN-PHASE-5.md 19.4, S14):
 * - rot: Textregeln wie R10 (Heil-/Gesundheitsversprechen, Nährwert-Schlagworte, Marken); jeder Abschnitt zum
 *   Carb-Loading trägt den festen Hinweis `CARB_LOADING_NOTICE_DE`.
 * - gelb (R21H): Mengen je kg Körpergewicht oder je Stunde (z. B. „8–10 g Kohlenhydrate pro kg“), mg-Angaben und
 *   Supplement-Dosierungen – zur Fachprüfung.
 */

/** Supplemente, deren Dosierung in Ratgebern fachlich geprüft wird (R21H). PRODUKTENTSCHEIDUNG. */
export const GUIDE_SUPPLEMENT_TERMS: readonly string[] = [
  'koffein',
  'kreatin',
  'beta-alanin',
  'natriumbicarbonat',
  'natron',
  'nitrat',
  'eisen',
  'magnesium',
  'vitamin',
];

const AMOUNT = String.raw`\d+(?:[.,]\d+)?(?:\s*(?:[–-]|bis)\s*\d+(?:[.,]\d+)?)?\s*`;
/** Menge in g/mg und im selben Satz „kg“, „Körpergewicht“ oder „pro Stunde“. */
const PER_KG_OR_HOUR = new RegExp(`${AMOUNT}(?:g|mg)\\b`, 'u');
const RELATIVE_WORDS = /\b(kg|körpergewicht|pro stunde|je stunde|\/\s*h)\b/iu;
const MG_AMOUNT = new RegExp(`${AMOUNT}mg\\b`, 'u');

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Gelbe Fundstellen in einem Text (R21H). */
export function findGuideAmountHints(text: string): string[] {
  const hints: string[] = [];
  for (const sentence of sentences(text)) {
    if (PER_KG_OR_HOUR.test(sentence) && RELATIVE_WORDS.test(sentence)) {
      hints.push(`Menge je kg/Stunde: „${sentence}“`);
      continue;
    }
    if (MG_AMOUNT.test(sentence)) {
      hints.push(`mg-Angabe: „${sentence}“`);
      continue;
    }
    const normalized = ` ${normalizeFoodText(sentence)} `;
    const supplement = GUIDE_SUPPLEMENT_TERMS.find((term) =>
      normalized.includes(` ${normalizeFoodText(term)}`),
    );
    if (supplement !== undefined && /\d/.test(sentence)) {
      hints.push(`Supplement-Dosierung („${supplement}“): „${sentence}“`);
    }
  }
  return hints;
}

/** true = Text behandelt Carb-Loading (Schreibweisen „Carb-Loading“, „Carbloading“, „Carb Loading“). */
export function mentionsCarbLoading(text: string): boolean {
  return /carb\s*-?\s*loading/iu.test(text);
}

export function checkGuide(guide: Guide): ContentIssue[] {
  const target = { kind: 'guide' as const, id: guide.id, status: guide.status };
  const issues: ContentIssue[] = [];
  const texts: [string, string][] = [
    ['title_de', guide.title_de],
    ...(guide.intro_de === undefined ? [] : ([['intro_de', guide.intro_de]] as [string, string][])),
    ...guide.sections.flatMap((section, i): [string, string][] => [
      [`sections.${i}.heading_de`, section.heading_de],
      ...section.body_de.map((body, j): [string, string] => [`sections.${i}.body_de.${j}`, body]),
      ...(section.notice_de === undefined
        ? []
        : ([[`sections.${i}.notice_de`, section.notice_de]] as [string, string][])),
    ]),
    ...(guide.places ?? []).flatMap((place, i): [string, string][] => [
      [`places.${i}.name_de`, place.name_de],
      ...place.good_de.map((t, j): [string, string] => [`places.${i}.good_de.${j}`, t]),
      ...place.less_often_de.map((t, j): [string, string] => [`places.${i}.less_often_de.${j}`, t]),
      ...(place.tip_de === undefined
        ? []
        : ([[`places.${i}.tip_de`, place.tip_de]] as [string, string][])),
    ]),
  ];

  for (const [path, value] of texts) {
    for (const hit of findNutritionTextRuleHits(value)) {
      const what =
        hit.kind === 'brand'
          ? `Markenname „${hit.match}“ – nur Produktarten, keine Marken`
          : hit.kind === 'health_claim'
            ? `„${hit.match}“ (${hit.label}) – keine Gesundheits- oder Nährwertversprechen`
            : `„${hit.match}“ (${hit.label}) – keine Heilversprechen oder medizinischen Aussagen`;
      issues.push(makeIssue('R21', target, `Text enthält ${what}.`, path));
    }
    for (const hint of findGuideAmountHints(value)) {
      issues.push(makeIssue('R21H', target, `${hint} – zur Fachprüfung.`, path));
    }
  }

  guide.sections.forEach((section, i) => {
    const aboutCarbLoading =
      mentionsCarbLoading(section.heading_de) || section.body_de.some(mentionsCarbLoading);
    if (aboutCarbLoading && section.notice_de !== CARB_LOADING_NOTICE_DE) {
      issues.push(
        makeIssue(
          'R21',
          target,
          `Abschnitt zum Carb-Loading ohne den festen Hinweis „${CARB_LOADING_NOTICE_DE}“.`,
          `sections.${i}.notice_de`,
        ),
      );
    }
  });
  return issues;
}
