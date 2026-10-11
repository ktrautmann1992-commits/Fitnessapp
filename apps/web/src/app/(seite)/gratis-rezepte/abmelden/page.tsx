import { WartelisteLinkSeite, wartelisteMetadata } from '../../_components/WartelisteLink';

export const dynamic = 'force-dynamic';
export const metadata = wartelisteMetadata('Gratis-Rezepte: Adresse löschen');

export default async function GratisRezepteAbmelden({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <WartelisteLinkSeite
      bereich="gratis-rezepte"
      aktion="abmelden"
      searchParams={await searchParams}
    />
  );
}
