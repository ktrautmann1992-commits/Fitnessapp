/**
 * Inhaltsart „Supplemente“ (content/supplements, docs/PLAN-PHASE-6.md Abschnitt 6, Etappe SU2).
 *
 * Eine Zelle je bekanntem Supplement (`SUPPLEMENT_CONTENT_IDS`: die fünf aus `SUPPLEMENT_IDS` und die Liste „Nicht
 * empfohlen“). Das Modell schreibt NUR die Texte (Name, Beschreibung, Anwendung bzw. Grund). Stufe, Kategorie und
 * zugelassene Angaben setzt der Code aus dem Core (eine Wahrheit); Quellen bleiben leer und werden von einem Menschen mit
 * geprüfter DOI/PMID eingetragen – eine KI erfindet sonst leicht DOIs (SK6 meldet die fehlende Quelle rot am Entwurf).
 * Dosis, Gegenanzeigen, Zeitpunkte und Pflichthinweise stehen nie im Inhalt (Plan 6). Den Startbestand hat eine
 * Claude-Sitzung geschrieben (SU-G13); diese Art braucht man nur für spätere Ergänzungen. Ein Eintrag gilt als
 * vorhanden, solange er nicht zurückgezogen ist – wer einen Text neu erzeugen will, setzt ihn erst auf „archived“.
 */
import {
  APPROVED_CLAIMS,
  expectedEvidenceLevel,
  expectedSupplementCategory,
  FORBIDDEN_BRANDS,
  FORBIDDEN_MEDICAL_TERMS,
  HEALTH_CLAIM_TERMS,
  isNotRecommendedSupplementId,
  isSupplementId,
  SUPPLEMENT_CONTENT_IDS,
  SUPPLEMENT_CONTENT_PLACEHOLDERS,
  SUPPLEMENT_FORBIDDEN_TERMS,
  supplementContentSchema,
} from '@fitnessapp/core';
import { z } from 'zod';

import { MODEL_FLASH } from '../config';

import { countsAsPresent } from './present';
import { OUTPUT_FORMAT_TEXT, ROLE_TEXT } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/** max_tokens je Anfrage (kurze Texte, inkl. Denken). */
export const SUPPLEMENT_MAX_TOKENS = 6_000;

/** Feldreihenfolge der Dateien (wie supplementContentSchema). */
const FIELD_ORDER = Object.keys(supplementContentSchema.shape);

/** Gruppen der Matrix: eingeordnet (inkl. Koffein-Info) bzw. Liste „Nicht empfohlen“ (Stufe C). */
export const SUPPLEMENT_GROUPS = {
  empfohlen: { labelDe: 'Startliste (inkl. Koffein-Info)', aliases: ['startliste', 'info'] },
  nicht_empfohlen: {
    labelDe: 'Nicht empfohlen (Stufe C)',
    aliases: ['nicht-empfohlen', 'stufe-c', 'c'],
  },
} as const;
export type SupplementGroup = keyof typeof SUPPLEMENT_GROUPS;

/**
 * Name je Supplement für Anfrage und Bericht – gleich wie `name_de` im Startbestand (Test). Ohne verbotene Wörter
 * (kein „Fatburner“, „Booster“), weil der Name auch im Anfrage-Text steht.
 */
export const SUPPLEMENT_LABELS_DE: Readonly<Record<string, string>> = {
  creatine: 'Kreatin-Monohydrat',
  caffeine: 'Koffein',
  protein_powder: 'Proteinpulver',
  vitamin_d: 'Vitamin D',
  omega3: 'Omega-3 (EPA und DHA)',
  bcaa: 'BCAA (verzweigtkettige Aminosäuren)',
  glutamine: 'Glutamin',
  l_carnitine: 'L-Carnitin',
  cla: 'CLA (konjugierte Linolsäure)',
  fat_burner: 'Abnehm-Kapseln und -Pulver',
  testo_booster: 'Tribulus, D-Asparaginsäure und ähnliche Mischungen',
  pre_workout: 'Pre-Workout-Mischungen',
  hmb: 'HMB (Beta-Hydroxy-Beta-Methylbutyrat)',
  ashwagandha: 'Ashwagandha (Schlafbeere)',
  collagen: 'Kollagen-Pulver',
  multivitamin: 'Multivitamin-Präparate',
  iron: 'Eisen-Präparate',
  melatonin: 'Melatonin',
};

function groupOf(id: string): SupplementGroup {
  return isNotRecommendedSupplementId(id) ? 'nicht_empfohlen' : 'empfohlen';
}

function cellFor(id: string, targetId: string = id): GenerationCell {
  return {
    customId: `supp-${targetId}`.slice(0, 64),
    targetId,
    label: `${SUPPLEMENT_LABELS_DE[id] ?? id} (${SUPPLEMENT_GROUPS[groupOf(id)].labelDe})`,
    values: { gruppe: groupOf(id), supplement: id },
  };
}

function supplementOf(cell: GenerationCell): string {
  const id = cell.values.supplement;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Zelle ${cell.customId} ohne Supplement.`);
  }
  return id;
}

const S = supplementContentSchema.shape;

/** Zod-Schema der Modell-Antwort: nur Texte; bei Stufe C Grund statt Anwendung. */
export function supplementOutputSchema(cell: GenerationCell) {
  const id = supplementOf(cell);
  return isNotRecommendedSupplementId(id)
    ? z.strictObject({
        name_de: S.name_de,
        summary_de: S.summary_de,
        not_recommended_reason_de: S.not_recommended_reason_de.unwrap(),
      })
    : z.strictObject({
        name_de: S.name_de,
        summary_de: S.summary_de,
        how_to_de: S.how_to_de.unwrap(),
      });
}

function labels(rules: readonly { label: string }[]): string {
  return rules.map((rule) => rule.label).join(', ');
}

function systemPrompt(): string {
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Schreibe für EIN Nahrungsergänzungsmittel (Supplement) einen kurzen, neutralen Info-Text für die App. Die App ist kein Shop und macht keine Werbung.',
    '',
    'Rechtlicher Rahmen (streng): Health-Claims-Verordnung VO (EG) 1924/2006 und VO (EU) 432/2012. Wirkaussagen gibt es in der App NUR aus einer festen Liste zugelassener Angaben – die fügt die App selbst hinzu. Du schreibst deshalb KEINE Wirkung, keinen Nutzen, kein Versprechen.',
    '',
    'Regeln:',
    '- name_de: üblicher deutscher Name (höchstens 80 Zeichen).',
    '- summary_de: zwei bis drei kurze Sätze – was es ist und woher es kommt (z. B. „steckt in Fleisch und Fisch“). Höchstens 600 Zeichen.',
    '- how_to_de (nur Startliste): praktische Anwendung (Form, Zubereitung, worauf man beim Produkt achtet). Mengen nur als Platzhalter, z. B. „Rühre {dose} in ein Getränk.“ Nur die Platzhalter aus der Anfrage. Keine Uhrzeiten, keine Gegenanzeigen, keine Pflichthinweise – das ergänzt die App.',
    '- not_recommended_reason_de (nur „Nicht empfohlen“): ein bis drei sachliche Sätze, warum die App es nicht empfiehlt (z. B. „Für eine Empfehlung reicht die Studienlage nicht aus.“, Risiken wie Verunreinigung). Keine Warnung vor Marken.',
    '- KEINE Ziffern, keine Zahlwörter (eins bis zwölf, hundert, tausend) und keine Einheiten (mg, g, µg, IE, kg) im Text.',
    '- Keine Heilversprechen, keine Diagnosen, keine Krankheiten. Statt „Mangel“: „Lass deine Blutwerte ärztlich prüfen.“',
    `- Verboten (inkl. Wortformen): ${labels(SUPPLEMENT_FORBIDDEN_TERMS)}.`,
    `- Ebenfalls verboten: ${labels(FORBIDDEN_MEDICAL_TERMS)}; ${labels(HEALTH_CLAIM_TERMS)}.`,
    `- Keine Marken- oder Herstellernamen (z. B. ${labels(FORBIDDEN_BRANDS)}).`,
    '- Koffein: nur neutrale Sicherheits-Info – kein Zweck (nicht „für mehr Leistung“, „Ausdauer“, „Kraft“, „Fokus“, „Energie“, „Power“, „Schwung“, „munter“, „wach“), keine Studienlage, keine Wirkung.',
    '- Sprache: Deutsch, Du-Form, kurze Sätze. Kein Text am Anfang oder Ende mit Leerzeichen; keine Emojis, kein Markdown.',
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell): string {
  const id = supplementOf(cell);
  const level = expectedEvidenceLevel(id);
  const placeholders = isSupplementId(id) ? SUPPLEMENT_CONTENT_PLACEHOLDERS[id] : [];
  const claims = APPROVED_CLAIMS.filter((claim) => claim.supplementId === id).map(
    (claim) => `„${claim.textDe}“`,
  );
  return [
    `Supplement: ${id} – ${SUPPLEMENT_LABELS_DE[id] ?? id}`,
    `Gruppe: ${SUPPLEMENT_GROUPS[groupOf(id)].labelDe}`,
    level === null
      ? 'Stufe: keine (nur Sicherheits-Info)'
      : `Stufe (intern): ${String(level).toUpperCase()}`,
    `Kategorie: ${expectedSupplementCategory(id) ?? '–'}`,
    `Erlaubte Platzhalter: ${placeholders.length > 0 ? placeholders.map((p) => `{${p}}`).join(', ') : 'keine'}`,
    claims.length > 0
      ? `Zugelassene Angaben (fügt die App selbst hinzu – NICHT wiederholen, nicht umschreiben): ${claims.join(' ')}`
      : 'Zugelassene Angaben: keine – schreibe keine Wirkung.',
  ].join('\n');
}

function toContents(
  output: unknown,
  cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> }[] {
  const data = output as {
    name_de: string;
    summary_de: string;
    how_to_de?: string;
    not_recommended_reason_de?: string;
  };
  const supplement = supplementOf(cell);
  const id = cell.targetId ?? supplement;
  const level = expectedEvidenceLevel(supplement);
  const category = expectedSupplementCategory(supplement);
  if (level === undefined || category === undefined) {
    throw new Error(`Unbekanntes Supplement „${supplement}“.`);
  }
  const notRecommended = isNotRecommendedSupplementId(supplement);
  const merged: Record<string, unknown> = {
    id,
    version: 1,
    status: 'draft',
    name_de: data.name_de,
    evidence_level: level,
    category,
    summary_de: data.summary_de,
    how_to_de: notRecommended ? null : (data.how_to_de ?? null),
    claim_ids:
      notRecommended || supplement === 'caffeine'
        ? []
        : APPROVED_CLAIMS.filter((claim) => claim.supplementId === supplement).map((c) => c.id),
    // Quellen trägt ein Mensch mit geprüfter DOI/PMID ein (SK6).
    sources: [],
    not_recommended_reason_de: notRecommended ? (data.not_recommended_reason_de ?? null) : null,
    meta,
  };
  return [{ id, content: Object.fromEntries(FIELD_ORDER.map((key) => [key, merged[key]])) }];
}

/**
 * Probelauf (ohne KI): eine gültige Antwort aus der Startliste, eine aus „Nicht empfohlen“, eine absichtlich ungültige
 * (Beschreibung zu kurz) und eine Ablehnung. Probelauf-IDs (`probelauf-…`) meldet SK2 als unbekannt (rot am Entwurf);
 * freigegeben werden können sie nie (PROBELAUF).
 */
function dryRunFixtures() {
  return [
    {
      cell: cellFor('creatine', 'probelauf-creatine'),
      response: {
        kind: 'json' as const,
        data: {
          name_de: 'Kreatin-Monohydrat',
          summary_de:
            'Probelauf: Kreatin bildet dein Körper selbst. Es steckt auch in Fleisch und Fisch.',
          how_to_de: 'Rühre {dose} Kreatin-Monohydrat in ein Getränk oder in Joghurt.',
        },
      },
    },
    {
      cell: cellFor('bcaa', 'probelauf-bcaa'),
      response: {
        kind: 'json' as const,
        data: {
          name_de: 'BCAA (verzweigtkettige Aminosäuren)',
          summary_de:
            'Probelauf: BCAA sind Aminosäuren, die in eiweißhaltigen Lebensmitteln stecken.',
          not_recommended_reason_de: 'Für eine Empfehlung reicht die Studienlage nicht aus.',
        },
      },
    },
    {
      // Absichtlich ungültig: Beschreibung zu kurz (prüft Zod).
      cell: cellFor('omega3', 'probelauf-omega3'),
      response: {
        kind: 'json' as const,
        data: { name_de: 'Omega-3', summary_de: 'Kurz.', how_to_de: 'Rühre {dose} ein.' },
      },
    },
    {
      cell: cellFor('caffeine', 'probelauf-caffeine'),
      response: { kind: 'refusal' as const },
    },
  ];
}

export const supplementKind: ContentKindDefinition = {
  kind: 'supplement',
  inputName: 'supplements',
  labelDe: 'Supplemente',
  folder: 'supplements',
  contentSchema: supplementContentSchema,
  // Rechtlich heikle Texte: das stärkere Modell, mittlere Denktiefe (Gründer-Vorgabe „so günstig wie sinnvoll“).
  defaultModel: MODEL_FLASH,
  defaultEffort: 'medium',
  maxTokens: SUPPLEMENT_MAX_TOKENS,
  dimensions: [
    {
      key: 'gruppe',
      labelDe: 'Gruppe',
      values: (Object.keys(SUPPLEMENT_GROUPS) as SupplementGroup[]).map((value) => ({
        value,
        aliases: [...SUPPLEMENT_GROUPS[value].aliases],
      })),
    },
    {
      key: 'supplement',
      labelDe: 'Supplement',
      values: SUPPLEMENT_CONTENT_IDS.map((value) => ({ value, aliases: [] })),
    },
  ],
  cells: () => SUPPLEMENT_CONTENT_IDS.map((id) => cellFor(id)),
  isPresent: (cell, context: LibraryContext) =>
    context.supplements.some((entry) => countsAsPresent(entry) && entry.id === cell.targetId),
  systemPrompt,
  userPrompt,
  outputSchema: supplementOutputSchema,
  toContents,
  dryRunFixtures,
};
