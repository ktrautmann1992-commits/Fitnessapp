import { APP_NAME, brandColors } from '@fitnessapp/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

// Farbschema (einzige Quelle für Farben, Abstände, Schrift) – siehe docs/DESIGN.md.
import '@fitnessapp/ui/theme.css';
import './globals.css';

import { SITE_DESCRIPTION, SITE_TITLE, siteUrl } from '@/lib/site';

// Favicon und Apple-Touch-Icon: src/app/icon.svg, icon.png, apple-icon.png; Vorschaubild beim Teilen:
// src/app/opengraph-image.png, twitter-image.png (Next.js setzt die Tags selbst).
// Alle erzeugt aus packages/ui/brand/alpha5-mark.svg: pnpm --filter @fitnessapp/ui icons
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: SITE_TITLE, template: `%s – ${APP_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: APP_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  // Browserleiste in Markenfarbe „schwarz“ (wie Kopfzeile und App-Icon), hell und dunkel.
  themeColor: brandColors.schwarz,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
