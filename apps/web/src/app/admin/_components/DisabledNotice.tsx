import styles from '../admin.module.css';

/** „Redaktionsbereich nicht eingerichtet“ – sicherer Standard ohne gültige Zugangsdaten in Vercel. */
export function DisabledNotice({ reasons }: { reasons: readonly string[] }) {
  return (
    <section className={styles.noticeWarning} aria-labelledby="nicht-eingerichtet">
      <h1 id="nicht-eingerichtet" className={styles.title}>
        Redaktionsbereich nicht eingerichtet
      </h1>
      <p className={styles.subtitle}>
        Der Zugang ist gesperrt, bis im Vercel-Projekt <strong>fitnessapp-web</strong> die Werte{' '}
        <span className={styles.code}>ADMIN_PASSWORD</span> (mindestens 20 Zeichen) und{' '}
        <span className={styles.code}>ADMIN_SESSION_SECRET</span> (mindestens 32 Zeichen)
        eingetragen sind und neu deployt wurde.
      </p>
      <ul className={styles.list}>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p>
        Anleitung: <span className={styles.code}>docs/SETUP.md</span>, <strong>Teil G</strong>{' '}
        (Redaktionsbereich – Passwort einrichten).
      </p>
    </section>
  );
}
