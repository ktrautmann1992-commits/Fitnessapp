import { MIN_AGE_YEARS } from '@fitnessapp/core';
import {
  APP_NAME,
  APP_TAGLINE,
  colors,
  fontSize,
  maxContentWidth,
  radius,
  spacing,
} from '@fitnessapp/ui';

import { supabaseConfig } from '@/lib/supabase';

const theme = colors.light;

const FEATURES = [
  { title: 'Trainingsplan', text: 'Passend zu Ziel, Zeitbudget und deinem Equipment.' },
  { title: 'Ernährung', text: 'Wochenplan mit Rezepten und Einkaufsliste.' },
  { title: 'Tagebuch', text: 'Sätze, Gewichte und Läufe festhalten – auch offline.' },
  { title: 'Ausdauer', text: 'Vom ersten 5-km-Lauf bis zur Langdistanz im Triathlon.' },
];

export default function HomePage() {
  const dbStatus =
    supabaseConfig.status === 'ok'
      ? { label: 'Datenbank verbunden', color: theme.success }
      : supabaseConfig.status === 'invalid'
        ? { label: 'Datenbank-Einstellungen fehlerhaft', color: theme.danger }
        : { label: 'Datenbank noch nicht verbunden', color: theme.warning };

  return (
    <main
      style={{
        maxWidth: maxContentWidth,
        margin: '0 auto',
        padding: spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
        minHeight: '100dvh',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ fontSize: fontSize.xxl, textAlign: 'center', margin: 0 }}>{APP_NAME}</h1>
      <p style={{ fontSize: fontSize.md, color: theme.textMuted, textAlign: 'center', margin: 0 }}>
        {APP_TAGLINE}
      </p>

      <section style={{ display: 'grid', gap: spacing.sm, marginTop: spacing.sm }}>
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <h2 style={{ fontSize: fontSize.lg, margin: 0 }}>{feature.title}</h2>
            <p style={{ color: theme.textMuted, margin: `${spacing.xs}px 0 0` }}>{feature.text}</p>
          </article>
        ))}
      </section>

      <p style={{ fontSize: fontSize.sm, color: theme.textMuted, textAlign: 'center' }}>
        Bald verfügbar für iPhone, Android und im Browser. Nutzung ab {MIN_AGE_YEARS} Jahren.
      </p>

      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          fontSize: fontSize.sm,
          color: theme.textMuted,
          margin: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: radius.pill,
            background: dbStatus.color,
            display: 'inline-block',
          }}
        />
        {dbStatus.label}
      </p>
    </main>
  );
}
