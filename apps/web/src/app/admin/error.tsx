'use client';

import styles from './admin.module.css';

/** Fehlerzustand im Redaktionsbereich (keine Details an den Browser – die stehen in den Vercel-Logs). */
export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className={styles.noticeError} role="alert">
      <h1 className={styles.title}>Da ist etwas schiefgegangen</h1>
      <p className={styles.subtitle}>
        Die Inhalte konnten nicht angezeigt werden. Bitte noch einmal versuchen. Bleibt der Fehler,
        in Vercel unter <strong>Logs</strong> nachsehen.
      </p>
      <div className={styles.filterActions}>
        <button type="button" className={styles.button} onClick={reset}>
          Erneut versuchen
        </button>
        <a className={styles.buttonSecondary} href="/admin">
          Zur Übersicht
        </a>
      </div>
    </section>
  );
}
