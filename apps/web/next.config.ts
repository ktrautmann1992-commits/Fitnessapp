import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace-Pakete liegen als TypeScript-Quellcode vor und werden von Next mitkompiliert.
  transpilePackages: [
    '@fitnessapp/content',
    '@fitnessapp/core',
    '@fitnessapp/db',
    '@fitnessapp/ui',
  ],
  poweredByHeader: false,
  // PDF der Gratis-Rezepte (public/downloads/): nicht in Suchmaschinen, der Link kommt per Mail.
  async headers() {
    return [
      {
        source: '/downloads/:datei*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Live-Begleitung (docs/PLAN-PHASE-10.md 21.3): nie indexieren, nie zwischenspeichern, keinen Referer
      // weitergeben; nicht in fremde Seiten einbetten.
      ...['/begleitung', '/api/begleitung'].map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      })),
    ];
  },
};

export default nextConfig;
