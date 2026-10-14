import { ISSUE_KIND_LABELS } from '@/lib/admin/labels';
import type { NutritionAdmin } from '@/lib/admin/nutrition';

import styles from '../admin.module.css';

/** Hinweise für alle Ernährungs-Seiten: Katalog fehlt, Fehler in Begleitdaten, kaputte Dateien. */
export function NutritionNotices({ admin }: { admin: NutritionAdmin }) {
  return (
    <>
      {admin.catalogMissing && (
        <p className={styles.noticeWarning} role="note">
          Noch kein Lebensmittel-Katalog im Repository. Er entsteht über den Workflow{' '}
          <strong>foods-import</strong> (docs/SETUP.md Teil J). Ohne Katalog ist kein Rezept nutzbar
          oder freigebbar.
        </p>
      )}
      {admin.catalogProblems.length > 0 && (
        <section className={styles.noticeError} aria-labelledby="katalog-fehler">
          <h2 id="katalog-fehler" className={styles.h2}>
            Fehler im Quellauszug bzw. in den Listen
          </h2>
          <p>
            Geprüft wird deshalb ohne Quellauszug – alle Lebensmittel sind rot (sichere Richtung).
          </p>
          <ul className={styles.list}>
            {admin.catalogProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </section>
      )}
      {admin.brokenFiles.length > 0 && (
        <section className={styles.noticeError} aria-labelledby="kaputte-dateien">
          <h2 id="kaputte-dateien" className={styles.h2}>
            Dateien mit Fehlern
          </h2>
          <ul className={styles.list}>
            {admin.brokenFiles.map((file) => (
              <li key={`${file.kind}:${file.id}`}>
                {ISSUE_KIND_LABELS[file.kind]} <span className={styles.code}>{file.id}</span>:{' '}
                {file.issues
                  .map(
                    (issue) =>
                      `${issue.rule} ${issue.path ? `(${issue.path}) ` : ''}${issue.message}`,
                  )
                  .join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
