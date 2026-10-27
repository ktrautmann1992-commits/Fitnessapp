import type { ReactNode } from 'react';

import styles from '../seite.module.css';

/** Gut sichtbarer Platzhalter in Rechtstexten. Vor dem Livegang ausfüllen (lassen). */
export function P({ children }: { children: ReactNode }) {
  return <mark className={styles.platzhalter}>[PLATZHALTER: {children}]</mark>;
}

/**
 * Rahmen einer Rechtsseite. Der Hinweis-Kasten „vor Livegang ausfüllen“ ist entfernt (privater Nutzerkreis,
 * Gründer-Entscheidung 27.10.2026) – vor einer öffentlichen Veröffentlichung: docs/VOR-VEROEFFENTLICHUNG.md.
 */
export function RechtsSeite({
  titel,
  stand,
  children,
}: {
  titel: string;
  stand: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.abschnitt}>
      <div className={`${styles.huelle} ${styles.text}`}>
        <h1 className={styles.titel}>{titel}</h1>
        {children}
        <p className={styles.stand}>Stand: {stand}</p>
      </div>
    </section>
  );
}
