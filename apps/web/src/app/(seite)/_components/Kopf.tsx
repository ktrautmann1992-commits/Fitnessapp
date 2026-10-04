import mark from '@fitnessapp/ui/brand/alpha5-mark.svg';

import styles from '../seite.module.css';

/** Kopfzeile (dunkel): Logo α5 als Vektor aus packages/ui/brand/alpha5-mark.svg + Schriftzug, Wartelisten-Knopf. */
export function Kopf() {
  return (
    <header className={styles.kopf}>
      <div className={`${styles.huelle} ${styles['kopf__innen']}`}>
        <a className={styles.logo} href="/">
          <img className={styles['logo__alpha']} src={mark.src} alt="" width={1133} height={697} />
          Alpha5
        </a>
        <a className={`${styles.knopf} ${styles['knopf--primaer']}`} href="/#warteliste">
          Auf die Warteliste
        </a>
      </div>
    </header>
  );
}
