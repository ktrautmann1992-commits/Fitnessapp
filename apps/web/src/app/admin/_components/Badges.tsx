import type { ContentStatus } from '@fitnessapp/core';

import type { IssueSummary } from '@/lib/admin/catalog';
import { STATUS_LABELS } from '@/lib/admin/labels';

import styles from '../admin.module.css';

const STATUS_CLASS: Record<ContentStatus, string> = {
  draft: styles.badgeDraft ?? '',
  published: styles.badgePublished ?? '',
  archived: styles.badgeArchived ?? '',
};

/** Status, KI-Kennzeichnung und Zahl der Befunde eines Inhalts. */
export function ContentBadges({
  status,
  needsExpertReview,
  summary,
}: {
  status: ContentStatus;
  needsExpertReview: boolean;
  summary: IssueSummary;
}) {
  return (
    <div className={styles.badges}>
      <span className={STATUS_CLASS[status]}>{STATUS_LABELS[status]}</span>
      {needsExpertReview ? (
        <span className={styles.badgeAi}>KI-Entwurf – fachlich prüfen</span>
      ) : (
        <span className={styles.badgeExpert}>fachlich geprüft</span>
      )}
      {summary.errors > 0 && (
        <span className={styles.badgeError}>
          <span aria-hidden className={styles.dot} />
          {summary.errors} rot
        </span>
      )}
      {summary.warnings > 0 && (
        <span className={styles.badgeWarning}>
          <span aria-hidden className={styles.dot} />
          {summary.warnings} gelb
        </span>
      )}
    </div>
  );
}
