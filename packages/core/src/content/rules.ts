import type { ContentStatus } from '../enums';

/**
 * Regeltabelle der Plausibilitäts-Checks (docs/PLAN-PHASE-2.md Abschnitt 7).
 * Rot (`error`) = Fehler, blockiert Freigabe und Einspielen. Gelb (`warning`) = Hinweis, blockiert nichts.
 * Zusätzlich zwei Datei-Regeln ohne Nummer im Plan: DATEI (Dateiname = ID, ID eindeutig, gültiges JSON) und
 * VERSION (Abschnitt 5, Punkt 6: Ändert sich ein freigegebener Inhalt, steigt `version`).
 * Dazu PROBELAUF (Wächter-Hinweis Etappe B): Beispiel-Inhalte aus dem Probelauf dürfen nie `published` sein.
 * Phase 5 (docs/PLAN-PHASE-5.md 5.3): R1–R19 für Lebensmittel und Rezepte (R1 Schema und R15 Version blockieren
 * wie Ü1/VERSION immer); R20–R22 für Meal-Prep-Pläne, Ratgeber und Kategorien (19.4); R23 für die Austausch-Tabelle
 * (19.7 N9).
 */
export const CONTENT_RULES = {
  DATEI: { severity: 'error', title: 'Datei: gültiges JSON, Dateiname = ID, ID eindeutig' },
  VERSION: { severity: 'error', title: 'Geänderter freigegebener Inhalt hat eine höhere Version' },
  PROBELAUF: {
    severity: 'error',
    title: 'Probelauf-Inhalte (ohne KI, nur zum Testen der Pipeline) werden nie freigegeben',
  },
  Ü1: {
    severity: 'error',
    title: 'Schema korrekt (Pflichtfelder, Mindest-/Höchstwerte, Textlängen)',
  },
  Ü2: { severity: 'error', title: 'Alle Geräte der Übung existieren im Katalog' },
  Ü3: {
    severity: 'error',
    title: 'Alternative existiert, ist nicht die Übung selbst, kein Doppel',
  },
  Ü4: { severity: 'error', title: 'Alternative hat dasselbe Bewegungsmuster' },
  Ü5: {
    severity: 'warning',
    title: 'Jedes Bewegungsmuster hat eine Variante ohne Geräte oder nur mit Band',
  },
  Ü6: {
    severity: 'error',
    title: 'Textregeln: keine Heilversprechen oder medizinischen Aussagen, keine Marken',
  },
  V1: {
    severity: 'error',
    title: 'Anzahl Einheiten = Tage pro Woche, day_index eindeutig, jede Übung existiert',
  },
  V2: {
    severity: 'error',
    title:
      'Geräte im Katalog; Zuhause-Vorlage nutzt nur ihre Pflicht-/Optional-Geräte (bzw. Alternativen)',
  },
  V3: { severity: 'error', title: 'Freigegebene Vorlage enthält nur freigegebene Übungen' },
  V4: {
    severity: 'error',
    title: 'Wdh. 3–30, Sätze 1–6, RPE 5–9 (Einsteiger höchstens 8), keine Maximaltests',
  },
  V5: { severity: 'warning', title: 'Pausen: Grundübungen 90–240 s, Isolationsübungen 45–120 s' },
  V6: { severity: 'warning', title: 'Geschätzte Dauer je Einheit in der Minuten-Spanne ±15 %' },
  V7: { severity: 'warning', title: 'Drücken : Ziehen pro Woche etwa 1 : 1 (höchstens ±30 %)' },
  V8: { severity: 'error', title: 'Höchstens 8 Übungen pro Einheit' },
  V9: { severity: 'error', title: 'Wochensätze pro Muskelgruppe: Obergrenze' },
  V10: { severity: 'error', title: 'Wochensätze: Untergrenze große Muskelgruppen' },
  V11: { severity: 'warning', title: 'Wochensätze: Untergrenze kleine Muskelgruppen' },
  V12: {
    severity: 'error',
    title: 'Körpergewicht-Vorlage (Zuhause ohne Geräte) enthält nur Übungen ohne Geräte',
  },
  V13: {
    severity: 'warning',
    title:
      'Jede Einheit passt gekürzt in minutes_min (Körpergewicht: mit Rumpf, Ziehen und Hüftbeugen)',
  },
  // Phase 5 · Lebensmittel und Rezepte (docs/PLAN-PHASE-5.md 5.3)
  R1: {
    severity: 'error',
    title:
      'Schema korrekt (Rezept und Lebensmittel), inkl. Pflichtangabe „heated“ bei tierischen Zutaten',
  },
  R2: {
    severity: 'error',
    title: 'Jedes Lebensmittel existiert, Einheit ist in Gramm umrechenbar',
  },
  R3: {
    severity: 'error',
    title: 'Makro-Plausibilität je Portion: kcal ±10 % (mind. ±20 kcal), Makros ±15 % (mind. ±3 g)',
  },
  R4: {
    severity: 'error',
    title:
      'Atwater je Lebensmittel (LMIV Anhang XIV): 4·Eiweiß + 4·KH + 9·Fett + 2·Ballaststoffe, dazu 3·org. Säuren + 7·Alkohol, Polyole 2,4 = kcal ±15 %',
  },
  R5: {
    severity: 'warning',
    title: 'kcal je Portion: Frühstück 200–900, Hauptgericht 300–1.200, Snack 80–500',
  },
  R6: {
    severity: 'error',
    title: 'Deklarierte Ernährungsform = berechnete (inkl. optionaler Zutaten)',
  },
  R7: {
    severity: 'error',
    title: 'Deklarierte Allergene enthalten alle berechneten (inkl. optionaler Zutaten)',
  },
  R8: {
    severity: 'error',
    title: '„contains_pork“ = berechnet (Gelatine unbekannter Herkunft zählt als Schwein)',
  },
  R9: {
    severity: 'error',
    title:
      'Meal-Prep: Haltbarkeit ≤ kürzeste Haltbarkeit der Zutaten und ≤ 3 Tage, sonst nur einfrierbar',
  },
  R10: {
    severity: 'error',
    title:
      'Textregeln: keine Heil- oder Gesundheitsversprechen, keine Nährwert-Schlagworte, keine Marken',
  },
  R11: {
    severity: 'warning',
    title: 'Mengen je Portion plausibel (Salz ≤ 2,5 g, Öl ≤ 30 g, Zutat ≤ 600 g)',
  },
  R12: { severity: 'error', title: 'Kein Alkohol' },
  R13: {
    severity: 'error',
    title:
      'Schwangerschafts-Vorsicht aus Zutaten und Zubereitung berechnet = „declared_pregnancy_caution“',
  },
  R14: {
    severity: 'error',
    title: 'Ohne Kochen („no_cook“): Kochzeit 0 und keine Herd-/Ofen-Geräte',
  },
  R15: { severity: 'error', title: 'Geänderter freigegebener Inhalt hat eine höhere Version' },
  R16: {
    severity: 'warning',
    title:
      'Abdeckung: mindestens 7 Rezepte je Mahlzeit × Ernährungsform × häufige Unverträglichkeit',
  },
  R17: {
    severity: 'error',
    title: 'Nährwerte = Quellauszug, Quell-ID existiert, Lizenz eingetragen',
  },
  R18: {
    severity: 'error',
    title:
      'Allergen-Pflichtregeln (alle 23 Gruppen, Schwein, Schwangerschaft), Erwartungsliste, Ersatzprodukte',
  },
  R18H: {
    severity: 'warning',
    title: 'Kernwort mitten im zusammengesetzten Wort – Gruppe von Menschen prüfen',
  },
  R19: {
    severity: 'error',
    title: 'Lebensmittel katalog-geprüft (sonst ist das Rezept nicht nutzbar)',
  },
  // Erweiterungen 2 (docs/PLAN-PHASE-5.md 19.4, Etappe N2c)
  R20: {
    severity: 'error',
    title:
      'Meal-Prep-Plan: Rezepte existieren und sind Meal-Prep-geeignet, Kochschritte aufsteigend, Aufbewahrung Mo–Fr vollständig und nach R9; Haltbarkeit im Text nicht länger als R9',
  },
  R20H: {
    severity: 'warning',
    title: 'Meal-Prep-Plan: Haltbarkeitsangabe („N Tage“) im Text – fachlich prüfen',
  },
  R21: {
    severity: 'error',
    title:
      'Ratgeber: Textregeln (keine Heil-/Gesundheitsversprechen, keine Marken), fester Hinweis beim Carb-Loading',
  },
  R21H: {
    severity: 'warning',
    title:
      'Ratgeber: Mengen je kg Körpergewicht oder je Stunde, mg-Angaben und Supplement-Dosierungen – Fachprüfung',
  },
  R22: {
    severity: 'warning',
    title:
      'Kategorie plausibel: „schnell“ ⇔ Gesamtzeit ≤ 10 Min., Pre-/Post-Workout ⇔ Trainings-Angabe, „meal-prep“ ⇔ Meal-Prep-geeignet',
  },
  // Zutaten-Austausch (docs/PLAN-PHASE-5.md 19.7 N9)
  R23: {
    severity: 'error',
    title:
      'Austausch: beide Lebensmittel existieren und sind katalog-geprüft (freigegeben nur mit freigegebenen), kein Alkohol, Faktor hält die Messgröße der Rolle ±10 %, Paar nicht doppelt',
  },
  R23H: {
    severity: 'warning',
    title:
      'Austausch: Süße (Süßkraft laut Hinweis) bzw. Ersatz muss durchgegart werden, das Original nicht – menschlich prüfen',
  },
} as const satisfies Record<string, { severity: IssueSeverity; title: string }>;

export type ContentRuleId = keyof typeof CONTENT_RULES;
export type IssueSeverity = 'error' | 'warning';
/**
 * Worauf sich ein Befund bezieht. `library` = ganze Übungsbibliothek (Regel Ü5), `recipe_library` = ganzer
 * Rezeptbestand (Regel R16), `meal_prep_plan`/`guide` = Meal-Prep-Plan bzw. Ratgeber (R20/R21).
 */
export type ContentKind =
  | 'exercise'
  | 'plan_template'
  | 'library'
  | 'food'
  | 'recipe'
  | 'recipe_library'
  | 'meal_prep_plan'
  | 'guide'
  | 'ingredient_substitution';

export interface ContentIssue {
  readonly rule: ContentRuleId;
  readonly severity: IssueSeverity;
  readonly kind: ContentKind;
  /** ID des Inhalts (bei Dateifehlern der Dateiname, bei Ü5 das Bewegungsmuster). */
  readonly id: string;
  /** Status des Inhalts, soweit bekannt (null = Datei nicht lesbar). */
  readonly status: ContentStatus | null;
  /** Feld, z. B. `sessions.0.exercises.2.rpe_target`. */
  readonly path?: string;
  readonly message: string;
}

/** Regeln, die IMMER blockieren – auch bei Entwürfen (Plan Abschnitt 7, „Was liegen darf“). */
const ALWAYS_BLOCKING: readonly ContentRuleId[] = ['DATEI', 'Ü1', 'VERSION', 'R1', 'R15'];

/**
 * true = der Befund lässt `content:validate` (und damit ci, content-review, content-collect, content-seed)
 * fehlschlagen: Schema-/Dateifehler immer, sonst rote Fehler an FREIGEGEBENEN Inhalten.
 */
export function isBlockingIssue(issue: ContentIssue): boolean {
  if (issue.severity !== 'error') {
    return false;
  }
  return ALWAYS_BLOCKING.includes(issue.rule) || issue.status === 'published';
}

/** Baut einen Befund; die Stufe (rot/gelb) kommt fest aus der Regeltabelle. */
export function makeIssue(
  rule: ContentRuleId,
  target: { kind: ContentKind; id: string; status: ContentStatus | null },
  message: string,
  path?: string,
): ContentIssue {
  return {
    rule,
    severity: CONTENT_RULES[rule].severity,
    kind: target.kind,
    id: target.id,
    status: target.status,
    ...(path === undefined ? {} : { path }),
    message,
  };
}
