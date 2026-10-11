import { readWaitlistConfig } from '@/lib/waitlist/config';
import { isValidDownloadPass } from '@/lib/waitlist/tokens';

import {
  BESTAETIGT_ERGEBNISSE,
  erster,
  WartelisteLinkSeite,
  wartelisteMetadata,
} from '../../_components/WartelisteLink';

export const dynamic = 'force-dynamic';
export const metadata = wartelisteMetadata('Gratis-Rezepte: E-Mail bestätigen');

/** Prüft den signierten, kurzlebigen Nachweis aus der Weiterleitung (?download=…) auf dem Server. */
function downloadErlaubt(params: Record<string, string | string[] | undefined>) {
  const now = Date.now();
  const config = readWaitlistConfig(process.env);
  return (
    config.status === 'ok' &&
    BESTAETIGT_ERGEBNISSE.has(erster(params.ergebnis) ?? '') &&
    isValidDownloadPass(config.config.tokenSecret, erster(params.download), now)
  );
}

export default async function GratisRezepteBestaetigen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <WartelisteLinkSeite
      bereich="gratis-rezepte"
      aktion="bestaetigen"
      searchParams={params}
      downloadErlaubt={downloadErlaubt(params)}
    />
  );
}
