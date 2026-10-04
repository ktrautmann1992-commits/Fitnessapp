import { APP_NAME } from '@fitnessapp/ui';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { Fuss } from './_components/Fuss';
import { Kopf } from './_components/Kopf';
import styles from './seite.module.css';

/**
 * Schrift Archivo (OFL, Lizenz in fonts/OFL.txt) – variable Schrift mit Breiten- und Stärke-Achse, SELBST
 * gehostet: Die Datei liegt im Repository und wird von Next.js mit ausgeliefert. Keine Verbindung zu Google.
 */
const archivo = localFont({
  src: '../fonts/archivo-latin-wdth-normal.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

/** Gemeinsamer Rahmen für Startseite, Rechtsseiten und Warteliste-Seiten. /admin hat einen eigenen. */
export default function SeitenLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${archivo.variable} ${styles.seite}`} data-marke={APP_NAME}>
      <Kopf />
      <main>{children}</main>
      <Fuss />
    </div>
  );
}
