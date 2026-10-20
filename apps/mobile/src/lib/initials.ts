/**
 * Initialen für das Konto-Symbol unter „Mehr“ (Design 20.10.2026). Die App speichert keinen Namen – darum aus der
 * E-Mail-Adresse: Teile vor dem „@“ an Punkt, Unterstrich oder Bindestrich (k.trautmann → „KT“), sonst der erste
 * Buchstabe. Ziffern zählen nicht. null = keine Adresse/kein Buchstabe → Personen-Symbol.
 */
export function initialsFromEmail(email: string | null | undefined): string | null {
  const local = (email ?? '').split('@')[0] ?? '';
  const parts = local
    .split(/[._-]+/)
    .map((part) => part.replace(/[^\p{L}]/gu, ''))
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
