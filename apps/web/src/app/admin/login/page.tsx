import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';

import { AdminHeader } from '../_components/AdminHeader';
import { DisabledNotice } from '../_components/DisabledNotice';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state === 'ok') {
    redirect('/admin');
  }
  const params = await searchParams;
  const failed = params.fehler !== undefined;
  const loggedOut = params.abgemeldet !== undefined;

  return (
    <>
      <AdminHeader loggedIn={false} />
      <main className={styles.stack}>
        <h1 className={styles.title}>Anmelden</h1>
        <p className={styles.muted}>
          Zugang für die Redaktion. Das Passwort steht im Passwort-Manager (eingetragen in Vercel
          als ADMIN_PASSWORD).
        </p>
        {failed && (
          <p className={styles.noticeError} role="alert">
            Zugang verweigert – das Passwort stimmt nicht.
          </p>
        )}
        {loggedOut && !failed && (
          <p className={styles.noticeOk} role="status">
            Du bist abgemeldet.
          </p>
        )}
        <form
          method="post"
          action="/admin/api/login"
          className={`${styles.section} ${styles.form}`}
        >
          <label htmlFor="password" className={styles.label}>
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            required
            minLength={1}
            maxLength={1024}
          />
          <button type="submit" className={`${styles.button} ${styles.fullWidth}`}>
            Anmelden
          </button>
        </form>
        <p className={`${styles.small} ${styles.muted}`}>
          Die Anmeldung gilt 8 Stunden auf diesem Gerät. Nach einem Fehlversuch dauert die Antwort
          etwa eine Sekunde.
        </p>
      </main>
    </>
  );
}
