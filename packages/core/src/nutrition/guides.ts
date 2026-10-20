import { checkGuide } from '../content/guide-checks';
import { type Guide, guideSchema } from '../content/guide-schema';
import { isPublishedWithoutExpertReview } from '../content/seed-settings';
import { isDryRunContent } from '../content/validate';

/**
 * Ratgeber in der App (docs/PLAN-PHASE-5.md 19.6, KONZEPT 6.8, Etappe N5c): gratis, offline (mit der App gebündelt),
 * ohne Echtzeit-KI. Auflagen des Wächters (N5a): nur freigegebene Ratgeber, Prüfung gegen Heil- und
 * Gesundheitsversprechen (Health-Claims-Verordnung) und „Kalorienzahlen aus“ gilt auch hier.
 */

export interface ReadableGuidesOptions {
  /** Testmodus: Entwürfe ohne roten Befund erlaubt (gekennzeichnet). Live: nur `published`. */
  readonly allowDrafts: boolean;
}

/**
 * Ratgeber, die angezeigt werden dürfen – zusätzlich zu `selectNutritionContent` (Verteidigung in der Tiefe, falls
 * ein Ratgeber an der Prüfung vorbei in den Bestand käme): Schema gültig, Status `published` (im Testmodus auch
 * `draft`), nie `archived` oder Probelauf, und **kein roter Befund aus R21** (Heil-/Gesundheits- und
 * Nährwertversprechen, Marken, fehlender Carb-Loading-Hinweis). Gelbe Befunde (R21H, Fachprüfung der Mengen)
 * schließen nicht aus – sie werden vor der Freigabe geprüft. Reihenfolge nach Titel, dann ID.
 */
export function readableGuides(guides: readonly Guide[], options: ReadableGuidesOptions): Guide[] {
  return guides
    .filter((guide) => {
      if (!guideSchema.safeParse(guide).success) return false;
      if (guide.status === 'archived') return false;
      if (guide.status === 'draft' && !options.allowDrafts) return false;
      if (isDryRunContent(guide)) return false;
      return !checkGuide(guide).some((issue) => issue.severity === 'error');
    })
    .sort(
      (a, b) =>
        a.title_de.localeCompare(b.title_de, 'de') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
/** Trenner zwischen Zahl und Einheit: Leerzeichen, Bindestrich, Halbgeviertstrich („500-kcal-Snack“). */
const SEP = String.raw`[\s\-–]*`;
/**
 * Energieangabe mit Zahl: „300 kcal“, „1.200 kJ“, „2 MJ“, „500-kcal-Snack“, „2500-Kalorien-Diät“,
 * „2000 Kalorienbedarf“ (Wortanfang genügt, Wächter N5c S2; K2: auch MJ/Kilojoule).
 */
const ENERGY = new RegExp(
  `${NUMBER}${SEP}(?:kcal|kj|mj|kilokalorie|kalorie|kilojoule|megajoule)`,
  'iu',
);
/** Menge in Gramm (auch „g/kg“, „Gramm“, „30-g-Regel“). */
const GRAMS = new RegExp(`${NUMBER}${SEP}(?:g|gramm)(?![\\p{L}])`, 'iu');
/** Prozentangabe (Wächter N5c K2) – zusammen mit Makro- oder Energie-Wörtern, z. B. „30 % Fett“. */
const PERCENT = new RegExp(`${NUMBER}${SEP}(?:%|prozent)`, 'iu');
/** Makronährstoffe (inkl. Abkürzung „KH“). */
const MACRO_WORDS = /(eiweiß|eiweiss|protein|kohlenhydrat|\bkh\b|fett|zucker|ballaststoff)/iu;
const ENERGY_WORDS = /(energie|kalorie|kcal)/iu;

/**
 * true = Text enthält eine Energie-Zahl (kcal/kJ/MJ) oder eine Makro-Menge in Gramm bzw. Prozent (z. B. „8–10 g
 * Kohlenhydrate pro kg“, „20 g Eiweiß“, „30 % Fett“). Bei „Kalorienzahlen aus“ (16 B (h), S12: keine kcal, keine
 * Makro-Gramm) wird ein solcher Text im Ratgeber ausgeblendet. Sichere Richtung: im Zweifel ausblenden.
 * Redaktionsregel (Wächter N5c K2): Zahlen in Ratgebern immer als Ziffern, Energie in kcal/kJ – Zahlwörter
 * („dreihundert Kalorien“) erkennt der Filter nicht.
 */
export function mentionsEnergyOrMacroGrams(text: string): boolean {
  if (ENERGY.test(text)) return true;
  if (GRAMS.test(text) && MACRO_WORDS.test(text)) return true;
  return PERCENT.test(text) && (MACRO_WORDS.test(text) || ENERGY_WORDS.test(text));
}

/**
 * Text ohne die Sätze, die Energie-Zahlen oder Makro-Mengen nennen (Wächter N6 S1) – dieselbe Erkennung wie im
 * Ratgeber (`mentionsEnergyOrMacroGrams`, eine Quelle). Für Rezept-Beschreibungen wie „… mit fast 30 g Eiweiß“ oder
 * „… bringt über 100 g Kohlenhydrate“: Solche Mengen gelten für das Grundrezept, nicht für die skalierte Portion, und
 * fallen im PDF immer weg (keine Nährwerte je Rezept), in der App bei „Zahlen aus“ bzw. Schwangerschaft/Stillzeit.
 * Sätze enden an „.“, „!“ oder „?“; ein Gedankenstrich-Nachsatz gehört zum Satz (sichere Richtung: ganzer Satz weg).
 * Wörter ohne Menge („viel Eiweiß bei wenig Kalorien“) erkennt der Filter bewusst nicht – das sind Fragen der
 * Health-Claims-Prüfung (R10), keine Zahlen. null = nichts übrig.
 */
export function withoutNutrientAmounts(text: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/u).filter((s) => s.trim() !== '');
  const kept = sentences.filter((sentence) => !mentionsEnergyOrMacroGrams(sentence));
  const result = kept.join(' ').trim();
  return result === '' ? null : result;
}

export interface GuideDisplaySection {
  /** null = Überschrift nennt Zahlen und ist wegen „Zahlen aus“ ausgeblendet (Wächter N5c K1). */
  readonly heading: string | null;
  readonly paragraphs: readonly string[];
  /** Fester Hinweis (z. B. beim Carb-Loading) – immer sichtbar, auch bei „Zahlen aus“. */
  readonly notice: string | null;
  /** Wegen „Kalorienzahlen aus“ ausgeblendete Absätze. */
  readonly hiddenCount: number;
}

export interface GuideDisplayPlace {
  /** null = ausgeblendet (Zahlen, K1). */
  readonly name: string | null;
  readonly good: readonly string[];
  readonly lessOften: readonly string[];
  readonly tip: string | null;
  readonly hiddenCount: number;
}

export interface GuideDisplay {
  readonly id: string;
  /** null = Titel nennt Zahlen und ist wegen „Zahlen aus“ ausgeblendet (K1) – die App zeigt dann „Ratgeber“. */
  readonly title: string | null;
  readonly intro: string | null;
  readonly sections: readonly GuideDisplaySection[];
  readonly places: readonly GuideDisplayPlace[];
  /** Summe aller ausgeblendeten Absätze (Hinweis oben „Zahlenangaben ausgeblendet“). */
  readonly hiddenCount: number;
  readonly isDraft: boolean;
  /** Freigegeben, aber ohne Fachprüfung (Testphase, Gründer-Entscheidung 19.10.2026) → „Testphase – …“. */
  readonly isTestphase: boolean;
}

/**
 * Ratgeber für die Anzeige. `showNumbers = false` („Kalorienzahlen aus“ bzw. Schwangerschaft/Stillzeit): Absätze mit
 * Energie-Zahlen oder Makro-Gramm fallen weg und werden gezählt – auch Titel, Überschriften und Ortsnamen (K1); feste
 * Hinweise (Carb-Loading) bleiben immer.
 */
export function guideForDisplay(guide: Guide, options: { showNumbers: boolean }): GuideDisplay {
  const keep = (text: string) => options.showNumbers || !mentionsEnergyOrMacroGrams(text);
  const split = (texts: readonly string[]) => {
    const kept = texts.filter(keep);
    return { kept, hidden: texts.length - kept.length };
  };
  const introKept = guide.intro_de !== undefined && keep(guide.intro_de);
  const introHidden = guide.intro_de !== undefined && !introKept ? 1 : 0;
  const sections = guide.sections.map((section): GuideDisplaySection => {
    const body = split(section.body_de);
    const headingKept = keep(section.heading_de);
    return {
      heading: headingKept ? section.heading_de : null,
      paragraphs: body.kept,
      notice: section.notice_de ?? null,
      hiddenCount: body.hidden + (headingKept ? 0 : 1),
    };
  });
  const places = (guide.places ?? []).map((place): GuideDisplayPlace => {
    const good = split(place.good_de);
    const less = split(place.less_often_de);
    const tipKept = place.tip_de !== undefined && keep(place.tip_de);
    const nameKept = keep(place.name_de);
    return {
      name: nameKept ? place.name_de : null,
      good: good.kept,
      lessOften: less.kept,
      tip: tipKept ? (place.tip_de ?? null) : null,
      hiddenCount:
        good.hidden +
        less.hidden +
        (place.tip_de !== undefined && !tipKept ? 1 : 0) +
        (nameKept ? 0 : 1),
    };
  });
  const titleKept = keep(guide.title_de);
  return {
    id: guide.id,
    title: titleKept ? guide.title_de : null,
    intro: introKept ? (guide.intro_de ?? null) : null,
    sections,
    places,
    hiddenCount:
      (titleKept ? 0 : 1) +
      introHidden +
      sections.reduce((sum, s) => sum + s.hiddenCount, 0) +
      places.reduce((sum, p) => sum + p.hiddenCount, 0),
    isDraft: guide.status === 'draft',
    isTestphase: isPublishedWithoutExpertReview(guide),
  };
}
