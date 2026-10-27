import { APP_NAME } from '@fitnessapp/ui';
import type { Metadata } from 'next';

import styles from './begleitung.module.css';
import { BegleitungAnsicht } from './BegleitungAnsicht';

/**
 * Begleit-Seite der Live-Begleitung (docs/PLAN-PHASE-10.md 21.3, CLAUDE.md „Ausnahme … Live-Begleitung“). Der Link
 * kommt von der Person selbst (System-Teilen-Dialog); das Token steht nur im Fragment (#t=…). Keine Anmeldung, keine
 * Cookies, keine Analytics, nicht indexiert (Meta + X-Robots-Tag in next.config.ts, robots.txt sperrt /begleitung),
 * kein Referer. Statische Hülle – alles Weitere liest die Seite im Browser.
 */
export const metadata: Metadata = {
  title: 'Live-Begleitung',
  description: 'Geteilter Standort während einer Einheit.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: 'no-referrer',
  // Beim Teilen des Links keine Vorschau mit Inhalten erzeugen.
  openGraph: null,
  twitter: null,
};

export default function BegleitungSeite() {
  return (
    <main className={styles.seite}>
      <p className={styles.marke}>{APP_NAME} · Live-Begleitung</p>
      <BegleitungAnsicht />
    </main>
  );
}
