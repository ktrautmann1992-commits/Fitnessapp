import { MIN_AGE_YEARS } from '@fitnessapp/core';
import { APP_NAME, APP_TAGLINE } from '@fitnessapp/ui';

import { supabaseConfig } from '@/lib/supabase';

import styles from './page.module.css';

/** Web-Version der App (Expo-Web-Export, Vercel-Projekt „App“). Kein Login auf der Website selbst. */
const DEFAULT_APP_URL = 'https://fitnessapp-alpha-five.vercel.app';
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;

const FEATURES = [
  { title: 'Trainingsplan', text: 'Passend zu Ziel, Zeitbudget und deinem Equipment.' },
  { title: 'Ernährung', text: 'Wochenplan mit Rezepten und Einkaufsliste.' },
  { title: 'Tagebuch', text: 'Sätze, Gewichte und Läufe festhalten – auch offline.' },
  { title: 'Ausdauer', text: 'Vom ersten 5-km-Lauf bis zur Langdistanz im Triathlon.' },
];

export default function HomePage() {
  const dbStatus =
    supabaseConfig.status === 'ok'
      ? { label: 'Datenbank verbunden', className: styles.statusOk }
      : supabaseConfig.status === 'invalid'
        ? { label: 'Datenbank-Einstellungen fehlerhaft', className: styles.statusInvalid }
        : { label: 'Datenbank noch nicht verbunden', className: styles.statusMissing };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{APP_NAME}</h1>
      <p className={styles.tagline}>{APP_TAGLINE}</p>

      <section className={styles.features}>
        {FEATURES.map((feature) => (
          <article key={feature.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{feature.title}</h2>
            <p className={styles.cardText}>{feature.text}</p>
          </article>
        ))}
      </section>

      <a className={styles.appButton} href={appUrl}>
        App im Browser öffnen
      </a>

      <p className={styles.note}>
        Bald auch für iPhone und Android. Nutzung ab {MIN_AGE_YEARS} Jahren.
      </p>

      <p className={styles.status}>
        <span aria-hidden className={`${styles.statusDot} ${dbStatus.className}`} />
        {dbStatus.label}
      </p>
    </main>
  );
}
