import { APP_NAME, APP_TAGLINE, brandColors } from '@fitnessapp/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

// Farbschema (einzige Quelle für Farben, Abstände, Schrift) – siehe docs/DESIGN.md.
import '@fitnessapp/ui/theme.css';
import './globals.css';

// Favicon und Apple-Touch-Icon: src/app/icon.svg, icon.png, apple-icon.png (Next.js setzt die <link>-Tags selbst).
// Erzeugt aus packages/ui/brand/alpha5-mark.svg: pnpm --filter @fitnessapp/ui icons
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
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
