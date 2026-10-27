import {
  type LiveContact,
  liveContactSchema,
  type LivePhoneCountry,
  normalizePhoneNumber,
} from '@fitnessapp/core';

/**
 * Formular „Notfallkontakt“ (app/notfallkontakte.tsx): Eingaben → geprüfter Kontakt. Nummern mit 0 am Anfang bekommen
 * die Ländervorwahl des gewählten Landes (DACH), gespeichert wird E.164. Nur auf dem Gerät.
 */
export interface ContactDraft {
  readonly id: string | null;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly country: LivePhoneCountry;
  readonly isDefault: boolean;
}

export const emptyContactDraft = (isDefault: boolean): ContactDraft => ({
  id: null,
  name: '',
  phone: '',
  email: '',
  country: 'DE',
  isDefault,
});

/** Kontakt aus dem Formular prüfen: Nummer ins internationale Format, Zod an der Grenze. */
export function contactFromDraft(
  draft: ContactDraft,
  id: string,
): { ok: true; contact: LiveContact } | { ok: false; field: 'name' | 'phone' | 'email' } {
  const phoneText = draft.phone.trim();
  const phone = phoneText === '' ? null : normalizePhoneNumber(phoneText, draft.country);
  if (phoneText !== '' && phone === null) return { ok: false, field: 'phone' };
  const email = draft.email.trim() === '' ? null : draft.email.trim().toLowerCase();
  const parsed = liveContactSchema.safeParse({
    id,
    name: draft.name,
    phone,
    email,
    isDefault: draft.isDefault,
  });
  if (parsed.success) return { ok: true, contact: parsed.data };
  const path = parsed.error.issues[0]?.path[0];
  return { ok: false, field: path === 'name' ? 'name' : path === 'email' ? 'email' : 'phone' };
}
