import { CONTENT_RULES, type ContentIssue, isBlockingIssue } from '@fitnessapp/core';

import styles from '../admin.module.css';

/**
 * Prüfbericht eines Inhalts (Regeln aus docs/PLAN-PHASE-2.md Abschnitt 7): rot = Fehler (blockiert die
 * Freigabe), gelb = Hinweis.
 */
export function IssueReport({
  issues,
  title = 'Prüfbericht',
  headingId = 'pruefbericht',
}: {
  issues: readonly ContentIssue[];
  title?: string;
  /** Eindeutige ID der Überschrift, wenn mehrere Berichte auf einer Seite stehen. */
  headingId?: string;
}) {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const box =
    errors.length > 0
      ? styles.noticeError
      : warnings.length > 0
        ? styles.noticeWarning
        : styles.noticeOk;

  return (
    <section className={box} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.h2}>
        {title}
      </h2>
      {issues.length === 0 ? (
        <p>Keine Befunde – alle automatischen Prüfungen bestanden.</p>
      ) : (
        <>
          <p>
            {errors.length} rot (Fehler – blockiert die Freigabe) · {warnings.length} gelb (Hinweis)
          </p>
          <ul className={styles.issues}>
            {[...errors, ...warnings].map((issue, index) => (
              <li
                key={`${issue.rule}-${issue.path ?? ''}-${index}`}
                className={issue.severity === 'error' ? styles.issueError : styles.issueWarning}
              >
                <div className={styles.issueHead}>
                  {issue.severity === 'error' ? 'Rot' : 'Gelb'} · {issue.rule} –{' '}
                  {CONTENT_RULES[issue.rule].title}
                  {isBlockingIssue(issue) ? ' · blockiert' : ''}
                </div>
                <div>{issue.message}</div>
                {issue.path && (
                  <div className={`${styles.small} ${styles.muted} ${styles.code}`}>
                    Feld: {issue.path}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
