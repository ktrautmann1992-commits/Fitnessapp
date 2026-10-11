import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace-Pakete liegen als TypeScript-Quellcode vor und werden von Next mitkompiliert.
  transpilePackages: ['@fitnessapp/core', '@fitnessapp/db', '@fitnessapp/ui'],
  poweredByHeader: false,
  // PDF der Gratis-Rezepte (public/downloads/): nicht in Suchmaschinen, der Link kommt per Mail.
  async headers() {
    return [
      {
        source: '/downloads/:datei*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
