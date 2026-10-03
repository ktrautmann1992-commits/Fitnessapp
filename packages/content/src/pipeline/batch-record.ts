/**
 * Merkdatei eines Batch-Laufs (`content/batches/<Datum>-<kurz>.json` auf dem Branch
 * `content/batch-<Datum>-<kurz>`): Batch-ID, Art, Parameter, Kostenschätzung und die Liste der Anfragen.
 * content-collect erkennt offene Läufe an `status: "submitted"`. Nach dem Abholen steht dort `collected`
 * mit Bericht und tatsächlichen Kosten – die Datei bleibt nach dem Merge als Protokoll im Repository.
 */
import { z } from 'zod';

import { BATCH_BRANCH_PREFIX, BATCH_RECORD_DIR, CONTENT_EFFORTS } from './config';

const cellSchema = z.strictObject({
  custom_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  target_id: z.string().nullable(),
  label: z.string(),
  values: z.record(z.string(), z.string()),
});

const estimateSchema = z.strictObject({
  input_tokens: z.number().int().nonnegative(),
  max_tokens_per_request: z.number().int().positive(),
  worst_case_usd: z.number().nonnegative(),
  max_usd: z.number().positive(),
});

const collectedSchema = z.strictObject({
  at: z.string(),
  saved: z.array(z.string()),
  not_saved: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  actual_usd: z.number().nonnegative(),
});

export const batchRecordSchema = z.strictObject({
  record_version: z.literal(1),
  status: z.enum(['submitted', 'collected']),
  dry_run: z.boolean(),
  batch_id: z.string().min(1),
  kind: z.enum(['exercise', 'plan_template']),
  model: z.string().min(1),
  effort: z.enum(CONTENT_EFFORTS),
  selection: z.string(),
  count: z.number().int().positive(),
  created_at: z.string(),
  branch: z.string().startsWith(BATCH_BRANCH_PREFIX),
  estimate: estimateSchema,
  requests: z.array(cellSchema).min(1),
  collected: collectedSchema.nullable(),
});
export type BatchRecord = z.infer<typeof batchRecordSchema>;

/** Kurzname eines Laufs, z. B. `2026-10-03-a1b2c3`. */
export function runName(date: string, short: string): string {
  return `${date}-${short}`;
}

export function batchBranch(name: string): string {
  return `${BATCH_BRANCH_PREFIX}${name}`;
}

export function batchRecordPath(name: string): string {
  return `${BATCH_RECORD_DIR}/${name}.json`;
}

/** Laufname aus dem Branch (`content/batch-2026-10-03-a1b2c3` → `2026-10-03-a1b2c3`). */
export function runNameFromBranch(branch: string): string | undefined {
  if (!branch.startsWith(BATCH_BRANCH_PREFIX)) {
    return undefined;
  }
  const name = branch.slice(BATCH_BRANCH_PREFIX.length);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]{4,12}$/.test(name) ? name : undefined;
}

/** Kurzkennung aus der Batch-ID (letzte 6 Zeichen, nur a–z/0–9). */
export function shortId(batchId: string): string {
  const cleaned = batchId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned.slice(-6).padStart(6, '0');
}
