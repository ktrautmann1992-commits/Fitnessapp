import type { ReactNode } from 'react';

import styles from '../seite.module.css';

/** Gut sichtbarer Platzhalter in Rechtstexten. Vor dem Livegang ausfüllen (lassen). */
export function P({ children }: { children: ReactNode }) {
  return <mark className={styles.platzhalter}>[PLATZHALTER: {children}]</mark>;
}

/** Rahmen einer Rechtsseite mit Hinweis-Kasten „PLATZHALTER – vor Livegang ausfüllen“. */
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
        <p className={styles['platzhalter-hinweis']} role="note">
          PLATZHALTER – vor Livegang ausfüllen. Diese Seite ist ein Entwurf mit markierten Lücken
          und muss vor dem Start rechtlich geprüft werden (Anwalt/Datenschutzberatung).
        </p>
        {children}
        <p className={styles.stand}>Stand: {stand}</p>
      </div>
    </section>
  );
}
