import { APP_NAME, APP_TAGLINE, colors } from '@fitnessapp/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: colors.light.primary,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ background: colors.light.background, color: colors.light.text }}>
        {children}
      </body>
    </html>
  );
}
