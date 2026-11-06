import { describe, expect, it } from 'vitest';

import { START_MENU_MAX_PLANNED, type StartMenuCandidate, startTrainingMenu } from './start-menu';

const candidate = (overrides: Partial<StartMenuCandidate> = {}): StartMenuCandidate => ({
  sessionId: 's1',
  name_de: 'Ganzkörper A',
  kind: 'strength',
  startable: true,
  hasDraft: false,
  ...overrides,
});

describe('startTrainingMenu', () => {
  it('ohne geplante Einheit (Ruhetag): nur die freien Wege in fester Reihenfolge', () => {
    expect(startTrainingMenu({ candidates: [], gpsAvailable: true }).map((e) => e.kind)).toEqual([
      'free_strength',
      'gps',
      'other_sport',
      'backfill',
    ]);
  });

  it('geplante, startbare Einheit von heute steht zuerst', () => {
    const menu = startTrainingMenu({ candidates: [candidate()], gpsAvailable: true });
    expect(menu[0]).toEqual({
      kind: 'planned',
      sessionId: 's1',
      name_de: 'Ganzkörper A',
      sessionKind: 'strength',
      resume: false,
    });
    expect(menu).toHaveLength(5);
  });

  it('nicht startbare Einheit (z. B. heute schon trainiert) fehlt – außer ein Training läuft', () => {
    expect(
      startTrainingMenu({
        candidates: [candidate({ startable: false })],
        gpsAvailable: true,
      })[0],
    ).toEqual({ kind: 'free_strength' });
    const resumed = startTrainingMenu({
      candidates: [candidate({ startable: false, hasDraft: true })],
      gpsAvailable: true,
    })[0];
    expect(resumed).toMatchObject({ kind: 'planned', resume: true });
  });

  it('ohne GPS (Web) kein GPS-Eintrag', () => {
    expect(startTrainingMenu({ candidates: [], gpsAvailable: false }).map((e) => e.kind)).toEqual([
      'free_strength',
      'other_sport',
      'backfill',
    ]);
  });

  it('laufendes Training vor neuen; höchstens zwei geplante; Dubletten nur einmal', () => {
    const menu = startTrainingMenu({
      candidates: [
        candidate({ sessionId: 'a', name_de: 'Lauf', kind: 'endurance' }),
        candidate({ sessionId: 'a', name_de: 'Lauf', kind: 'endurance' }),
        candidate({ sessionId: 'b', hasDraft: true }),
        candidate({ sessionId: 'c' }),
      ],
      gpsAvailable: true,
    });
    const planned = menu.filter((e) => e.kind === 'planned');
    expect(planned).toHaveLength(START_MENU_MAX_PLANNED);
    expect(planned.map((e) => (e.kind === 'planned' ? e.sessionId : ''))).toEqual(['b', 'a']);
    expect(menu.at(-1)).toEqual({ kind: 'backfill' });
  });
});
