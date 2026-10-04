import type { MetadataRoute } from 'next';

import { PUBLIC_PATHS, siteUrl } from '@/lib/site';

/** sitemap.xml: nur öffentliche Seiten. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${siteUrl}${path === '/' ? '' : path}`,
    changeFrequency: path === '/' ? 'weekly' : 'yearly',
    priority: path === '/' ? 1 : 0.3,
  }));
}
