import Link from 'next/link';

import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1>Diese Seite gibt es nicht.</h1>
      <Link href="/" className={styles.link}>
        Zur Startseite
      </Link>
    </main>
  );
}
