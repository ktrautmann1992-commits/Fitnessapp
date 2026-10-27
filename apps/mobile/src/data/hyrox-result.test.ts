import { freeSessionPayloadIssue, sessionLogPayloadSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createFreeDraft, draftToPayload, setCardioFields } from './workout-draft';

/** Ergebnis „Hyrox-Rennen“ aus „Mein Wettkampf“ (Sportarten Stufe 1, Etappe H): freier Lauf-Eintrag mit Teilzeiten. */
describe('Hyrox-Rennen als freier Eintrag', () => {
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
  const now = '2026-10-27T12:00:00.000Z';

  function draft(hyrox?: { totalS: number; splits: { segment: 'run_1'; duration_s: number }[] }) {
    let d = createFreeDraft({
      ownerUserId: 'u1',
      kind: 'endurance',
      modality: 'run',
      exercises: [],
      performedOn: '2026-10-25',
      today: '2026-10-27',
      now,
      newId,
    });
    d = setCardioFields(d, { hours: '1', minutes: '23', distanceKm: '8' }, now);
    return hyrox ? { ...d, hyrox } : d;
  }

  it('Name „Hyrox-Rennen“, Gesamtzeit sekundengenau, Teilzeiten – gültig wie save_session_log', () => {
    const payload = draftToPayload(
      draft({ totalS: 5025, splits: [{ segment: 'run_1', duration_s: 270 }] }),
      { writeId: newId(), now, today: '2026-10-27' },
    );
    expect(payload.name_de).toBe('Hyrox-Rennen');
    expect(payload.cardio?.duration_s).toBe(5025);
    expect(payload.hyrox_splits).toEqual([{ segment: 'run_1', duration_s: 270 }]);
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(true);
    expect(freeSessionPayloadIssue(payload, '2026-10-27')).toBeNull();
  });

  it('ohne Hyrox-Angabe bleibt der Eintrag ein normaler Lauf', () => {
    const payload = draftToPayload(draft(), { writeId: newId(), now, today: '2026-10-27' });
    expect(payload.name_de).toBe('Lauf');
    expect(payload.hyrox_splits ?? null).toBeNull();
  });

  it('Teilzeiten über der Gesamtzeit → nie ein gültiger Eintrag', () => {
    const payload = draftToPayload(
      draft({ totalS: 600, splits: [{ segment: 'run_1', duration_s: 700 }] }),
      { writeId: newId(), now, today: '2026-10-27' },
    );
    expect(sessionLogPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
