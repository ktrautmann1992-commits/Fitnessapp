import type { ContentStatus } from '../enums';

/**
 * Regeltabelle der Plausibilitäts-Checks (docs/PLAN-PHASE-2.md Abschnitt 7).
 * Rot (`error`) = Fehler, blockiert Freigabe und Einspielen. Gelb (`warning`) = Hinweis, blockiert nichts.
 * Zusätzlich zwei Datei-Regeln ohne Nummer im Plan: DATEI (Dateiname = ID, ID eindeutig, gültiges JSON) und
 * VERSION (Abschnitt 5, Punkt 6: Ändert sich ein freigegebener Inhalt, steigt `version`).
 */
export const CONTENT_RULES = {
  DATEI: { severity: 'error', title: 'Datei: gültiges JSON, Dateiname = ID, ID eindeutig' },
  VERSION: { severity: 'error', title: 'Geänderter freigegebener Inhalt hat eine höhere Version' },
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
} as const satisfies Record<string, { severity: IssueSeverity; title: string }>;

export type ContentRuleId = keyof typeof CONTENT_RULES;
export type IssueSeverity = 'error' | 'warning';
/** Worauf sich ein Befund bezieht. `library` = ganze Übungsbibliothek (Regel Ü5). */
export type ContentKind = 'exercise' | 'plan_template' | 'library';

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
const ALWAYS_BLOCKING: readonly ContentRuleId[] = ['DATEI', 'Ü1', 'VERSION'];

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
