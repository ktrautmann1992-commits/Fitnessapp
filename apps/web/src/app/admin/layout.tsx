import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import styles from './admin.module.css';

/** Redaktionsbereich: nie indexieren (zusätzlich X-Robots-Tag aus src/proxy.ts). */
export const metadata: Metadata = {
  title: 'Redaktionsbereich',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <p className={styles.banner} role="note">
        Testansicht – Inhalte aus dem Repository
      </p>
      {children}
    </div>
  );
}
