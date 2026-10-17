import { describe, expect, it } from 'vitest';

import { BackendError } from './backend';
import { toCompetitionError } from './supabase-backend';

/** Feste Fehlertexte von save/cancel/complete/delete_competition → Grund (gleich wie der Testmodus, WP4). */

const err = (message: string, code = 'P0001') => ({ message, code });

describe('toCompetitionError', () => {
  it.each([
    ['Es gibt schon einen geplanten Wettkampf.', 'competition_exists'],
    ['Bis zum Renntag ist zu wenig Zeit.', 'race_date'],
    ['Der Renntag liegt außerhalb des erlaubten Zeitraums.', 'race_date'],
    ['Die Referenzzeit ist zu alt oder liegt in der Zukunft.', 'reference_date'],
    ['Ein Wettkampfplan braucht den Gesundheits-Check.', 'health_check_required'],
    ['In der Schwangerschaft gibt es keinen Wettkampfplan.', 'not_allowed'],
    ['Für diese Distanz gibt es noch keinen Wettkampfplan.', 'not_allowed'],
    ['Eine Zielzeit ist hier nicht möglich.', 'not_allowed'],
    ['Wettkampf nicht gefunden.', 'not_found'],
    ['Nur geplante Wettkämpfe lassen sich ändern.', 'not_planned'],
    ['Ein abgesagter Wettkampf lässt sich nicht abschließen.', 'not_planned'],
    ['Der Wettkampf liegt noch in der Zukunft.', 'result_rejected'],
    ['Dieser Eintrag passt nicht zum Wettkampf.', 'result_rejected'],
    ['Ungültige Angaben zum Wettkampf.', 'invalid'],
  ])('%s → %s', (message, reason) => {
    const error = toCompetitionError(err(message, '22023'));
    expect(error.code).toBe('competition_rejected');
    expect(error.competitionReason).toBe(reason);
  });
  it('Netz → „nur online“, Zeitlimit → vorübergehend, BackendError bleibt', () => {
    expect(toCompetitionError(new TypeError('Failed to fetch')).code).toBe('online_only');
    expect(
      toCompetitionError(err('canceling statement due to statement timeout', '57014')).code,
    ).toBe('temporary');
    const own = new BackendError('not_signed_in');
    expect(toCompetitionError(own)).toBe(own);
  });
});
