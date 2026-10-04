import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/** robots.txt: Startseite und Rechtsseiten indexieren; Redaktionsbereich, API und Mail-Link-Seiten nicht. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/warteliste/'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
