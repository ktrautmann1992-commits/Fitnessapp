import type { ContentMeta } from '@fitnessapp/core';

import { formatDateDe, ORIGIN_LABELS } from '@/lib/admin/labels';

import styles from '../admin.module.css';

/** Herkunft und Prüfvermerk (meta) eines Inhalts, z. B. „KI-Entwurf, Claude, 03.10.2026“. */
export function OriginSection({ meta, version }: { meta: ContentMeta; version: number }) {
  return (
    <section className={styles.section} aria-labelledby="herkunft">
      <h2 id="herkunft" className={styles.h2}>
        Herkunft und Prüfung
      </h2>
      <dl className={styles.facts}>
        <dt>Herkunft</dt>
        <dd>{ORIGIN_LABELS[meta.origin]}</dd>
        <dt>Modell</dt>
        <dd className={styles.code}>{meta.model ?? '–'}</dd>
        {meta.batch_id !== null && (
          <>
            <dt>Batch</dt>
            <dd className={styles.code}>{meta.batch_id}</dd>
          </>
        )}
        <dt>Erstellt am</dt>
        <dd>{formatDateDe(meta.created_on)}</dd>
        <dt>Freigegeben von</dt>
        <dd>
          {meta.reviewed_by !== null && meta.reviewed_at !== null
            ? `${meta.reviewed_by} am ${formatDateDe(meta.reviewed_at)}`
            : 'noch nicht freigegeben'}
        </dd>
        <dt>Fachlich geprüft</dt>
        <dd>
          {meta.expert_reviewed
            ? 'ja – von einer Fachperson geprüft'
            : 'nein – vor dem öffentlichen Start von einer Fachperson prüfen lassen'}
        </dd>
        {meta.review_note !== null && (
          <>
            <dt>Prüfnotiz</dt>
            <dd>{meta.review_note}</dd>
          </>
        )}
        <dt>Version</dt>
        <dd>{version}</dd>
      </dl>
    </section>
  );
}

/** Deutlicher Hinweis „KI-Entwurf – fachlich prüfen“ (Plan Abschnitt 6, Punkt 6). */
export function AiDraftNotice({ show }: { show: boolean }) {
  if (!show) {
    return null;
  }
  return (
    <p className={styles.noticeWarning} role="note">
      <strong>KI-Entwurf – fachlich prüfen.</strong> Dieser Inhalt wurde von Claude erstellt und
      noch nicht von einer Fachperson (Trainer/in, Sportwissenschaft) geprüft.
    </p>
  );
}
