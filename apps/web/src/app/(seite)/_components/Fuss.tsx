import Link from 'next/link';

import { appUrl } from '@/lib/site';

import styles from '../seite.module.css';

export function Fuss() {
  return (
    <footer className={styles.fuss}>
      <div className={`${styles.huelle} ${styles['fuss__innen']}`}>
        <p>© 2026 Alpha5. Alpha5 ersetzt keine ärztliche Beratung.</p>
        <nav aria-label="Rechtliches">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
          <a href={appUrl}>App im Browser testen</a>
        </nav>
      </div>
    </footer>
  );
}
