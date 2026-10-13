/**
 * Liste „bestätigte Datenunterschiede“ (docs/PLAN-PHASE-5.md N2b, Gründer-Entscheidung nach Import-Lauf 1,
 * Leitplanken aus der Wächter-Prüfung `waechter-import1.md` Frage 5).
 *
 * Eine Zutat, deren Werte in der Gründer-Datei (`alpha5-rezepte.json`) echt von der Quelle abweichen (andere Ware,
 * grober Wert, andere Tabelle), kann von einem Gründer als „bestätigt“ markiert werden. Sie bleibt im Bericht
 * sichtbar (🟠), zählt aber nicht mehr zur 10-%-Merge-Regel.
 *
 * Leitplanken:
 * - Die Datei liegt NICHT unter `content/foods/` (dort schreibt nur der Bot), sondern in `content/food-mapping/`.
 *   Sie steht bewusst NICHT in `.github/CODEOWNERS` (Gründer-Entscheidung 13.10.2026, Option a: mit einem
 *   GitHub-Konto wäre ein Claude-PR sonst nicht mergebar). Die Schranke ist eine Regel: Claude legt den
 *   Bestätigungs-PR an, NUR ein Gründer merged ihn – Claude nie (wie beim `originalSha256`-PR; docs/SETUP.md J3).
 * - Einträge werden nicht abgetippt: Der Import-Bericht liefert je 🔴-Zutat einen kopierfertigen Eintrag
 *   (`confirmationDraft`) mit den exakten Bindungswerten; nur Grund, Name und Datum werden ausgefüllt.
 * - Jeder Eintrag ist an Quelle (db, version), Quell-ID, die vier Quellwerte UND die vier Werte der Gründer-Datei
 *   gebunden. Weicht nur ein Wert ab (andere Datei, andere Spalte, andere ID), ist der Eintrag ungültig und die
 *   Zutat ist wieder „Zuordnung prüfen“.
 * - Deckel: Bestätigte Zutaten dürfen höchstens `MAX_CONFIRMED_SHARE` der verglichenen Zutaten ausmachen – sonst
 *   ⛔ unabhängig von der Liste (eine vergiftete Erst-Datei lässt sich nicht „wegbestätigen“).
 * - Der Import liest die Liste nur aus dem Stand, auf dem der Workflow läuft – und der läuft nur auf `main`
 *   (`runFoodsImport` bricht sonst ab), genau wie die Allowlist `sources.ts`.
 */
import { isoDateSchema, SOURCE_DATABASES } from '@fitnessapp/core';
import { z } from 'zod';

import type { Alpha5Per100g, CrossCheckValues } from './import-source';

/** Ablage (relativ zum Repository) – bewusst außerhalb von `content/foods/`. */
export const CONFIRMED_DIFFERENCES_PATH = 'content/food-mapping/bestaetigte-abweichungen.json';

/**
 * Höchster Anteil bestätigter Zutaten an den verglichenen Zutaten. Darüber gilt ⛔, egal was in der Liste steht:
 * Echte Datenunterschiede betrafen in Lauf 1 rund 12 % der Zutaten; ein Vielfaches davon deutet auf eine falsche
 * Datei oder falsche Spalten hin, nicht auf echte Unterschiede.
 */
export const MAX_CONFIRMED_SHARE = 0.2;

const text = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((v) => v === v.trim(), 'Kein Leerzeichen am Anfang oder Ende.');

const value = z.number().finite().min(0).max(1000);

/**
 * Markierung der Platzhalter im kopierfertigen Eintrag des Import-Berichts. Ein Text mit dieser Markierung ist
 * ungültig – ein nicht ausgefüllter Eintrag kann so nie wirksam werden.
 */
export const CONFIRMATION_PLACEHOLDER = 'AUSFÜLLEN';

const filled = (schema: z.ZodString) =>
  schema.refine(
    (v) => !v.includes(CONFIRMATION_PLACEHOLDER),
    `Platzhalter „${CONFIRMATION_PLACEHOLDER}“ ersetzen.`,
  );

export const confirmedDifferenceSchema = z.strictObject({
  /** `zutat_id` in alpha5-rezepte.json (wie in der Zuordnung). */
  alpha5_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  source: z.strictObject({ db: z.enum(SOURCE_DATABASES), version: text(1, 40) }),
  /** Quell-ID (z. B. BLS-Schlüssel), wie in der Zuordnung. */
  source_ref: text(1, 40),
  /** Werte der Quelle je 100 g, wie sie der Import aus dem Auszug liest. */
  source_values: z.strictObject({
    kcal: value,
    protein_g: value,
    carbs_g: value,
    fat_g: value,
  }),
  /** Werte der Gründer-Datei (`pro_100g`) zum Zeitpunkt der Bestätigung. */
  file_values: z.strictObject({
    kcal: value,
    eiweiss_g: value,
    kohlenhydrate_g: value,
    fett_g: value,
  }),
  /** Warum der Unterschied echt ist (andere Ware, grober Wert …) – steht im Bericht. */
  reason_de: filled(text(10, 500)),
  /**
   * Wer bestätigt hat – nur eine ANGABE, KEIN NACHWEIS: Den Text schreibt eine Claude-Sitzung, er belegt nichts.
   * Der Nachweis der Gründer-Bestätigung ist allein der Merge des Bestätigungs-PRs durch einen Gründer (Git-Historie).
   */
  confirmed_by: filled(text(2, 100)),
  /** Datum der Bestätigung (Angabe; maßgeblich ist das Merge-Datum). */
  confirmed_at: isoDateSchema,
});
export type ConfirmedDifference = z.infer<typeof confirmedDifferenceSchema>;

export const confirmedDifferencesFileSchema = z
  .strictObject({
    format: z.literal('alpha5-bestaetigte-abweichungen'),
    version: z.literal(1),
    note_de: text(1, 2000),
    entries: z.array(confirmedDifferenceSchema).max(500),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.entries.forEach((entry, index) => {
      if (seen.has(entry.alpha5_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['entries', index, 'alpha5_id'],
          message: `„${entry.alpha5_id}“ doppelt.`,
        });
      }
      seen.add(entry.alpha5_id);
    });
  });
export type ConfirmedDifferencesFile = z.infer<typeof confirmedDifferencesFileSchema>;

/** Liest die Liste; ungültig → Fehler mit Pfaden (nie still ignorieren). */
export function parseConfirmedDifferences(data: unknown): ConfirmedDifference[] {
  const parsed = confirmedDifferencesFileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `${CONFIRMED_DIFFERENCES_PATH} ist ungültig: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data.entries;
}

/** Wogegen ein Eintrag geprüft wird (aus dem aktuellen Lauf). */
export interface ConfirmationTarget {
  readonly db: string;
  readonly version: string;
  readonly ref: string;
  readonly source: CrossCheckValues;
  readonly file: Alpha5Per100g;
}

/**
 * Prüft die Bindung eines Eintrags. Leere Liste = gültig; sonst die Gründe, warum der Eintrag nicht (mehr) passt.
 * Zahlen werden exakt verglichen (auf 6 Nachkommastellen wie `convertSourceValue`) – jede Änderung macht ungültig.
 */
export function confirmationMismatches(
  entry: ConfirmedDifference,
  target: ConfirmationTarget,
): string[] {
  const same = (a: number, b: number) => Math.round(a * 1e6) === Math.round(b * 1e6);
  const problems: string[] = [];
  if (entry.source.db !== target.db || entry.source.version !== target.version) {
    problems.push(
      `Quelle ${entry.source.db} ${entry.source.version} ≠ ${target.db} ${target.version}`,
    );
  }
  if (entry.source_ref !== target.ref) {
    problems.push(`Quell-ID ${entry.source_ref} ≠ ${target.ref}`);
  }
  const sourcePairs: [keyof ConfirmedDifference['source_values'], number][] = [
    ['kcal', target.source.kcal],
    ['protein_g', target.source.protein_g],
    ['carbs_g', target.source.carbs_g],
    ['fat_g', target.source.fat_g],
  ];
  for (const [key, actual] of sourcePairs) {
    if (!same(entry.source_values[key], actual)) {
      problems.push(`Quelle ${key} ${entry.source_values[key]} ≠ ${actual}`);
    }
  }
  const filePairs: [keyof ConfirmedDifference['file_values'], number][] = [
    ['kcal', target.file.kcal],
    ['eiweiss_g', target.file.eiweiss_g],
    ['kohlenhydrate_g', target.file.kohlenhydrate_g],
    ['fett_g', target.file.fett_g],
  ];
  for (const [key, actual] of filePairs) {
    if (!same(entry.file_values[key], actual)) {
      problems.push(`Gründer-Datei ${key} ${entry.file_values[key]} ≠ ${actual}`);
    }
  }
  return problems;
}

/**
 * Kopierfertiger Eintrag für den Import-Bericht (Wächter LOD, S2): die exakten acht Werte, gegen die
 * `confirmationMismatches` prüft – Rohwerte der Quelle (`nutrients_per_100g`), NICHT der Wert einer Lesart (z. B.
 * KH + Ballaststoffe) aus der Abweichungstabelle. `reason_de`, `confirmed_by`, `confirmed_at` sind Platzhalter,
 * die das Schema ablehnt, bis ein Mensch sie ausfüllt.
 */
export function confirmationDraft(
  alpha5Id: string,
  target: ConfirmationTarget,
): ConfirmedDifference {
  return {
    alpha5_id: alpha5Id,
    source: { db: target.db as ConfirmedDifference['source']['db'], version: target.version },
    source_ref: target.ref,
    source_values: {
      kcal: target.source.kcal,
      protein_g: target.source.protein_g,
      carbs_g: target.source.carbs_g,
      fat_g: target.source.fat_g,
    },
    file_values: {
      kcal: target.file.kcal,
      eiweiss_g: target.file.eiweiss_g,
      kohlenhydrate_g: target.file.kohlenhydrate_g,
      fett_g: target.file.fett_g,
    },
    reason_de: `${CONFIRMATION_PLACEHOLDER}: warum der Unterschied echt ist (andere Ware, grober Wert …)`,
    confirmed_by: `${CONFIRMATION_PLACEHOLDER}: Name des Gründers (Angabe, kein Nachweis)`,
    confirmed_at: `${CONFIRMATION_PLACEHOLDER}: JJJJ-MM-TT`,
  };
}
