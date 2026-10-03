import { APP_NAME, APP_TAGLINE, colors } from '@fitnessapp/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

// Farbschema (einzige Quelle für Farben, Abstände, Schrift) – siehe docs/DESIGN.md.
import '@fitnessapp/ui/theme.css';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  // Browserleiste: hell wie bisher in der Hauptfarbe, dunkel passend zum Hintergrund.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: colors.light.primary },
    { media: '(prefers-color-scheme: dark)', color: colors.dark.background },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
