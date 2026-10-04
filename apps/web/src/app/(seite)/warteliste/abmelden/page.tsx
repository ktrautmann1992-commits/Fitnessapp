import { WartelisteLinkSeite, wartelisteMetadata } from '../../_components/WartelisteLink';

export const dynamic = 'force-dynamic';
export const metadata = wartelisteMetadata('Abmelden');

export default async function WartelisteAbmelden({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <WartelisteLinkSeite aktion="abmelden" searchParams={await searchParams} />;
}
