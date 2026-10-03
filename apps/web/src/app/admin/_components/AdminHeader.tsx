import styles from '../admin.module.css';

/** Kopf jeder Admin-Seite mit „Abmelden“ (POST mit Herkunftsprüfung, kein Link). */
export function AdminHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className={styles.header}>
      <p className={`${styles.small} ${styles.muted}`}>Redaktionsbereich</p>
      {loggedIn && (
        <form method="post" action="/admin/api/logout">
          <button type="submit" className={styles.buttonSecondary}>
            Abmelden
          </button>
        </form>
      )}
    </header>
  );
}
