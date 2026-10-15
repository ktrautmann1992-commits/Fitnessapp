import { describe, expect, it } from 'vitest';

import { BackendError } from '@/data/backend';

import { blockText, dropLabel, menuLabel, moveErrorText, outcomeText } from './calendar-format';

const names: Record<string, string> = { beine: 'Beine', oben: 'Oberkörper' };
const nameOf = (id: string) => names[id] ?? null;

describe('Kalender-Texte (Etappe A1a)', () => {
  it('48 h: nennt Nachbar-Einheit und Tag', () => {
    expect(
      blockText(
        { reason: 'recovery_48h', conflict: { sessionId: 'beine', date: '2026-10-07' } },
        nameOf,
      ),
    ).toBe(
      'Zu nah an deiner Einheit „Beine“ am Mittwoch, 07.10. – dieselben Muskeln brauchen 48 Stunden Pause.',
    );
    // Unbekannte Nachbar-Einheit → allgemeiner Text.
    expect(
      blockText(
        { reason: 'recovery_48h', conflict: { sessionId: 'x', date: '2026-10-07' } },
        nameOf,
      ),
    ).toBe('Zu nah an einer Kraft-Einheit mit denselben Muskeln.');
  });

  it('Tausch scheitert an der anderen Einheit → Grund aus ihrer Sicht', () => {
    expect(blockText({ reason: 'past', partner: true, otherSessionId: 'oben' }, nameOf)).toBe(
      'Tauschen mit „Oberkörper“ geht nicht: Sie käme in die Vergangenheit.',
    );
  });

  it('jeder Grund hat einen deutschen Text', () => {
    for (const reason of [
      'not_found',
      'not_planned',
      'deload_skip_only',
      'past',
      'other_week',
      'current',
      'occupied',
      'recovery_48h',
    ] as const) {
      expect(blockText({ reason }, nameOf).length).toBeGreaterThan(5);
      expect(blockText({ reason, partner: true, otherSessionId: 'oben' }, nameOf)).toMatch(
        /^Tauschen mit „Oberkörper“ geht nicht: /,
      );
    }
  });

  it('Menü-Einträge: verschieben, tauschen, gesperrt', () => {
    expect(menuLabel({ date: '2026-10-08', allowed: true, kind: 'move' }, nameOf)).toBe(
      'Donnerstag, 08.10.: hierhin verschieben',
    );
    expect(
      menuLabel(
        { date: '2026-10-09', allowed: true, kind: 'swap', otherSessionId: 'beine' },
        nameOf,
      ),
    ).toBe('Freitag, 09.10.: tauschen mit Beine');
    expect(menuLabel({ date: '2026-10-05', allowed: false, reason: 'past' }, nameOf)).toBe(
      'Montag, 05.10.: Liegt in der Vergangenheit.',
    );
  });

  it('Texte beim Ziehen und nach dem Verschieben', () => {
    expect(dropLabel({ date: '2026-10-08', allowed: true, kind: 'move' }, nameOf)).toBe(
      'Hier ablegen',
    );
    expect(
      dropLabel(
        { date: '2026-10-09', allowed: true, kind: 'swap', otherSessionId: 'oben' },
        nameOf,
      ),
    ).toBe('Tauschen mit Oberkörper');
    expect(dropLabel({ date: '2026-10-11', allowed: false, reason: 'other_week' }, nameOf)).toBe(
      'Nur innerhalb derselben Woche.',
    );
    expect(outcomeText({ kind: 'moved', to: '2026-10-08' }, nameOf)).toBe(
      'Verschoben auf Donnerstag, 08.10.',
    );
    expect(
      outcomeText(
        { kind: 'swapped', otherSessionId: 'beine', from: '2026-10-06', to: '2026-10-09' },
        nameOf,
      ),
    ).toBe('Getauscht: jetzt am Freitag, 09.10., „Beine“ am Dienstag, 06.10.');
  });

  it('Fehlertexte unterscheiden die Ursache (nie „nur ab heute“ für andere Gründe)', () => {
    const rules = moveErrorText(new BackendError('plan_rejected', { moveReason: 'move_rules' }));
    const changed = moveErrorText(
      new BackendError('plan_rejected', { moveReason: 'plan_changed' }),
    );
    const other = moveErrorText(new BackendError('plan_rejected'));
    expect(rules).toContain('nur ab heute');
    expect(changed).toBe(
      'Dein Plan hat sich inzwischen geändert – wir haben ihn neu geladen. Bitte prüfe den Tag noch einmal.',
    );
    expect(other).not.toContain('nur ab heute');
    expect(changed).not.toContain('nur ab heute');
    expect(moveErrorText(new BackendError('temporary'))).toBe(
      'Das hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.',
    );
    expect(moveErrorText(new BackendError('online_only'))).toContain(
      'Tauschen braucht kurz Verbindung',
    );
    expect(moveErrorText(new BackendError('network', { sensitive: true }))).toContain(
      'Keine Verbindung',
    );
  });
});
