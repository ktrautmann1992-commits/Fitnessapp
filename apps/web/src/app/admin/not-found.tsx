import Link from 'next/link';

import styles from './admin.module.css';

export default function AdminNotFound() {
  return (
    <section className={styles.noticeWarning}>
      <h1 className={styles.title}>Inhalt nicht gefunden</h1>
      <p className={styles.subtitle}>
        Diese Übung oder Vorlage gibt es in diesem Stand des Repositorys nicht (mehr).
      </p>
      <Link className={styles.button} href="/admin">
        Zur Übersicht
      </Link>
    </section>
  );
}
