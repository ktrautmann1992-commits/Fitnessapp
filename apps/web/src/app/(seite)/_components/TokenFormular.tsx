'use client';

import { useSyncExternalStore } from 'react';

import { tokenFromHash } from '@/lib/waitlist/token-format';

import styles from '../seite.module.css';

const abonnieren = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/**
 * Liest das Token aus dem #Fragment des Mail-Links (wird nie an einen Server geschickt, steht in keinem Log und
 * keinem Referer) und schickt es erst per Knopf (POST) ab.
 */
export function TokenFormular({
  aktion,
  frage,
  knopf,
  ungueltig,
}: {
  aktion: 'bestaetigen' | 'abmelden';
  frage: string;
  knopf: string;
  ungueltig: string;
}) {
  // Auf dem Server (und vor dem ersten Rendern im Browser) gibt es kein Fragment: null = „wird geprüft“.
  const hash = useSyncExternalStore(
    abonnieren,
    () => window.location.hash,
    () => null,
  );
  if (hash === null) {
    return <p className={styles.einleitung}>Link wird geprüft …</p>;
  }
  const token = tokenFromHash(hash);
  if (!token) {
    return (
      <p className={styles.einleitung} role="status">
        {ungueltig}
      </p>
    );
  }
  return (
    <form method="post" action={`/api/warteliste/${aktion}`}>
      <p className={styles.einleitung}>{frage}</p>
      <input type="hidden" name="token" value={token} />
      <button className={`${styles.knopf} ${styles['knopf--primaer']}`} type="submit">
        {knopf}
      </button>
    </form>
  );
}
