/**
 * Adressen der Website und der App. Über Umgebungsvariablen (Vercel-Projekt „Web“) überschreibbar.
 */

/** Produktionsadresse der Website (für Open Graph, Sitemap, robots.txt). */
export const DEFAULT_SITE_URL = 'https://fitnessapp-web-eight.vercel.app';
/** Web-Version der App (Expo-Web-Export, Vercel-Projekt „App“). */
export const DEFAULT_APP_URL = 'https://fitnessapp-alpha-five.vercel.app';

type Env = Readonly<Record<string, string | undefined>>;

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/** Öffentliche Adresse: NEXT_PUBLIC_SITE_URL, sonst die Produktionsadresse. */
export function readSiteUrl(env: Env): string {
  return withoutTrailingSlash(env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL);
}

export const siteUrl = readSiteUrl(process.env);

/** Von Vercel gesetzte Adresse (ohne https://) → Origin. */
const vercelOrigin = (host: string | undefined) =>
  host?.trim() ? `https://${host.trim().replace(/\/+$/, '')}` : null;

/**
 * Adresse für Links in E-Mails – NIE aus Kopfzeilen der Anfrage (die könnte ein Angreifer setzen).
 * Produktion: siteUrl. Vorschau (VERCEL_ENV=preview): die feste Vercel-Adresse dieses Branches bzw. Deployments.
 */
export function mailBaseUrl(env: Env): string {
  if (env.VERCEL_ENV === 'preview') {
    const preview = vercelOrigin(env.VERCEL_BRANCH_URL) ?? vercelOrigin(env.VERCEL_URL);
    if (preview) return preview;
  }
  return readSiteUrl(env);
}

/** Erlaubte Herkünfte für Formulare (Allowlist): Produktion, eigene Domain, Vercel-Adressen dieses Deployments. */
export function allowedOrigins(env: Env): string[] {
  return [
    readSiteUrl(env),
    DEFAULT_SITE_URL,
    vercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL),
    vercelOrigin(env.VERCEL_BRANCH_URL),
    vercelOrigin(env.VERCEL_URL),
  ].filter((value): value is string => value !== null);
}
export const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;

export const SITE_TITLE = 'Alpha5 – Training und Ernährung, die zu dir passen';
export const SITE_DESCRIPTION =
  'Alpha5 erstellt deinen Trainingsplan aus deinem Ziel, deiner Zeit und deinem Equipment. Im Studio oder zu Hause, vom ersten Workout bis zum Marathon.';

/** Öffentliche Seiten (für die Sitemap). */
export const PUBLIC_PATHS = ['/', '/impressum', '/datenschutz', '/agb'] as const;
