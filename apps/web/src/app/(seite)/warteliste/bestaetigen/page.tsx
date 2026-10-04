import { WartelisteLinkSeite, wartelisteMetadata } from '../../_components/WartelisteLink';

export const dynamic = 'force-dynamic';
export const metadata = wartelisteMetadata('Anmeldung bestätigen');

export default async function WartelisteBestaetigen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <WartelisteLinkSeite aktion="bestaetigen" searchParams={await searchParams} />;
}
