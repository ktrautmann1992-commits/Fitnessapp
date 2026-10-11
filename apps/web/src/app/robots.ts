import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * robots.txt: Startseite und Rechtsseiten indexieren; Redaktionsbereich, API und Mail-Link-Seiten nicht.
 * Das PDF der Gratis-Rezepte (/downloads/) bewusst NICHT sperren: Nur so sehen Suchmaschinen dessen
 * X-Robots-Tag: noindex (next.config.ts) und nehmen es nicht in den Index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/warteliste/', '/gratis-rezepte/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
