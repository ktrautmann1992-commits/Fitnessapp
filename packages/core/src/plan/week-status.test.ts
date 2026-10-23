import { describe, expect, it } from 'vitest';

import { LOG_ASSIGNMENT_LIMITS } from '../constants';
import { addDays } from '../dates';
import {
  fulfilledSessionIds,
  type LogAssignment,
  parseStoredLogAssignments,
  sameSportFamily,
  upsertLogAssignment,
  weekStatus,
  type WeekStatusLog,
  type WeekStatusSession,
} from './week-status';

// Woche Mo 19.10. – So 25.10.2026, „heute“ Freitag 23.10.
const MO = '2026-10-19';
const DI = '2026-10-20';
const MI = '2026-10-21';
const DO = '2026-10-22';
const FR = '2026-10-23';
const SA = '2026-10-24';
const SO = '2026-10-25';

const session = (
  id: string,
  scheduled_on: string,
  extra: Partial<WeekStatusSession> = {},
): WeekStatusSession => ({
  id,
  scheduled_on,
  original_date: null,
  status: 'planned',
  kind: 'strength',
  endurance_modality: null,
  name_de: `Einheit ${id}`,
  plan_active: true,
  estimated_minutes: 45,
  ...extra,
});
const run = (id: string, scheduled_on: string, extra: Partial<WeekStatusSession> = {}) =>
  session(id, scheduled_on, {
    kind: 'endurance',
    endurance_modality: 'run',
    name_de: 'Lockerer Dauerlauf',
    ...extra,
  });
const log = (
  id: string,
  performed_on: string,
  extra: Partial<WeekStatusLog> = {},
): WeekStatusLog => ({
  id,
  planned_session_id: null,
  performed_on,
  kind: 'strength',
  status: 'completed',
  name_de: `Eintrag ${id}`,
  ...extra,
});
const watchRun = (id: string, performed_on: string, extra: Partial<WeekStatusLog> = {}) =>
  log(id, performed_on, {
    kind: 'endurance',
    modality: 'run',
    name_de: 'Lauf',
    is_free: true,
    source: 'health_connect',
    duration_s: 8037,
    distance_m: 22_840,
    kcal: 1520,
    started_at: `${performed_on}T06:13:00.000Z`,
    ...extra,
  });

const day = (status: ReturnType<typeof weekStatus>, date: string) => {
  const found = status.days.find((d) => d.date === date);
  if (!found) throw new Error(`Tag ${date} fehlt`);
  return found;
};

describe('weekStatus – Grundzustände', () => {
  it('7 Tage Mo–So, heute markiert, Ruhetage, geplant, verpasst', () => {
    const status = weekStatus({
      sessions: [session('a', MO), session('b', MI), run('c', SA)],
      logs: [],
      weekOf: FR,
      today: FR,
    });
    expect(status.weekStart).toBe(MO);
    expect(status.days.map((d) => d.date)).toEqual([MO, DI, MI, DO, FR, SA, SO]);
    expect(status.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(day(status, FR).isToday).toBe(true);
    expect(day(status, DO).isPast).toBe(true);
    expect(day(status, MO).state).toBe('missed');
    expect(day(status, MO).open[0]?.missed).toBe(true);
    expect(day(status, DI).state).toBe('rest');
    expect(day(status, SA).state).toBe('planned');
    expect(day(status, SA).open[0]).toMatchObject({ kind: 'endurance', modality: 'run' });
    expect(status.summary).toMatchObject({ sessionsDone: 0, sessionsPlanned: 3, extraUnits: 0 });
    expect(status.questions).toEqual([]);
  });

  it('heute geplant ist „geplant“, nicht verpasst', () => {
    const status = weekStatus({ sessions: [session('a', FR)], logs: [], weekOf: FR, today: FR });
    expect(day(status, FR).state).toBe('planned');
    expect(day(status, FR).open[0]?.missed).toBe(false);
  });

  it('1 Trainingstag: eine Einheit, sechs Ruhetage', () => {
    const status = weekStatus({ sessions: [session('a', MI)], logs: [], weekOf: MO, today: MO });
    expect(status.days.filter((d) => d.state === 'rest')).toHaveLength(6);
    expect(status.summary.sessionsPlanned).toBe(1);
  });

  it('7 Trainingstage: alle erledigt (verknüpft) – kein Ruhetag, 7/7', () => {
    const dates = [MO, DI, MI, DO, FR, SA, SO];
    const status = weekStatus({
      sessions: dates.map((d, i) => session(`s${i}`, d, { status: 'completed' })),
      logs: dates.map((d, i) => log(`l${i}`, d, { planned_session_id: `s${i}`, done_sets: 3 })),
      weekOf: SO,
      today: SO,
    });
    expect(status.days.every((d) => d.state === 'done')).toBe(true);
    expect(status.summary).toMatchObject({
      sessionsDone: 7,
      sessionsPlanned: 7,
      extraUnits: 0,
      strengthSets: 21,
    });
    expect(fulfilledSessionIds(status).size).toBe(7);
  });

  it('gestrichene Einheit: Tag „gestrichen“, zählt nicht als geplant', () => {
    const status = weekStatus({
      sessions: [session('a', MO, { status: 'skipped' }), session('b', MI)],
      logs: [],
      weekOf: MO,
      today: MO,
    });
    expect(day(status, MO).state).toBe('skipped');
    expect(day(status, MO).skipped).toEqual([{ sessionId: 'a', name_de: 'Einheit a' }]);
    expect(status.summary.sessionsPlanned).toBe(1);
  });

  it('Einheit eines ersetzten Plans: „entfällt“, nicht gezählt, nicht offen', () => {
    const status = weekStatus({
      sessions: [session('alt', DO, { plan_active: false })],
      logs: [],
      weekOf: DO,
      today: MO,
    });
    expect(day(status, DO).dropped).toEqual([{ sessionId: 'alt', name_de: 'Einheit alt' }]);
    expect(day(status, DO).open).toEqual([]);
    expect(day(status, DO).state).toBe('rest');
    expect(status.summary.sessionsPlanned).toBe(0);
  });

  it('erledigte Einheit ohne Eintrag auf dem Gerät steht am Termin als erledigt', () => {
    const status = weekStatus({
      sessions: [session('a', MO, { status: 'completed' })],
      logs: [],
      weekOf: MO,
      today: FR,
    });
    expect(day(status, MO).state).toBe('done');
    expect(day(status, MO).entries[0]).toMatchObject({ logId: null, name_de: 'Einheit a' });
    expect(status.summary.sessionsDone).toBe(1);
  });

  it('Kalender-Verschiebung: Ziel-Tag „verschoben von“, Ursprungstag merkt sich das Ziel', () => {
    const status = weekStatus({
      sessions: [session('a', MI, { original_date: MO })],
      logs: [],
      weekOf: MO,
      today: MO,
    });
    expect(day(status, MI).open[0]?.movedFrom).toBe(MO);
    expect(day(status, MO).movedAway).toEqual([{ sessionId: 'a', name_de: 'Einheit a', to: MI }]);
    expect(day(status, MO).state).toBe('rest');
  });

  it('mehrere Einheiten an einem Tag: erledigte und offene stehen beide da', () => {
    const status = weekStatus({
      sessions: [session('a', MI, { status: 'completed' }), run('b', MI)],
      logs: [log('l1', MI, { planned_session_id: 'a' })],
      weekOf: MI,
      today: MI,
    });
    const mi = day(status, MI);
    expect(mi.state).toBe('done');
    expect(mi.entries).toHaveLength(1);
    expect(mi.open.map((o) => o.sessionId)).toEqual(['b']);
    expect(status.summary).toMatchObject({ sessionsDone: 1, sessionsPlanned: 2 });
  });

  it('teilweise erledigt bleibt erledigt (mit Kennzeichen)', () => {
    const status = weekStatus({
      sessions: [session('a', MO, { status: 'completed' })],
      logs: [log('l', MO, { planned_session_id: 'a', status: 'partial' })],
      weekOf: MO,
      today: MO,
    });
    expect(day(status, MO).entries[0]?.partial).toBe(true);
    expect(day(status, MO).state).toBe('done');
  });
});

describe('weekStatus – Erledigt am tatsächlichen Tag (Fehlerbild Gründer 23.10.2026)', () => {
  it('Sa-Lauf am Fr verknüpft erledigt: Fr ✓ „statt Sa“, Sa „vorgezogen“ – nie ✓ am Samstag', () => {
    const status = weekStatus({
      sessions: [run('sa', SA, { status: 'completed' })],
      logs: [
        log('l', FR, {
          planned_session_id: 'sa',
          kind: 'endurance',
          modality: 'run',
          distance_m: 22_840,
        }),
      ],
      weekOf: FR,
      today: FR,
    });
    const fr = day(status, FR);
    const sa = day(status, SA);
    expect(fr.state).toBe('done');
    expect(fr.entries[0]?.fulfils).toMatchObject({
      sessionId: 'sa',
      plannedOn: SA,
      shift: 'early',
      mode: 'linked',
    });
    expect(sa.state).toBe('moved');
    expect(sa.entries).toEqual([]);
    expect(sa.doneElsewhere).toEqual([
      expect.objectContaining({ sessionId: 'sa', doneOn: FR, shift: 'early' }),
    ]);
    expect(status.summary).toMatchObject({ sessionsDone: 1, sessionsPlanned: 1, distanceKm: 22.8 });
  });

  it('verpasster Di-Lauf am Do nachgeholt: Do ✓, Di „nachgeholt“', () => {
    const status = weekStatus({
      sessions: [run('di', DI, { status: 'completed' })],
      logs: [log('l', DO, { planned_session_id: 'di', kind: 'endurance', modality: 'run' })],
      weekOf: DO,
      today: FR,
    });
    expect(day(status, DO).entries[0]?.fulfils?.shift).toBe('late');
    expect(day(status, DI).state).toBe('moved');
    expect(day(status, DI).doneElsewhere[0]?.shift).toBe('late');
  });

  it('Uhr-Lauf am Fr, Sa „Lockerer Dauerlauf“ geplant, Fr ohne Lauf-Plan → Frage, nichts still zugeordnet', () => {
    const status = weekStatus({
      sessions: [run('sa', SA)],
      logs: [watchRun('w', FR)],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([
      {
        logId: 'w',
        logDate: FR,
        logName: 'Lauf',
        kind: 'endurance',
        modality: 'run',
        durationS: 8037,
        distanceM: 22_840,
        startedAt: `${FR}T06:13:00.000Z`,
        fromWatch: true,
        sessionId: 'sa',
        sessionDate: SA,
        sessionName: 'Lockerer Dauerlauf',
        shift: 'early',
      },
    ]);
    // Bis zur Antwort: Fr erledigt (freie Einheit), Sa weiter geplant.
    expect(day(status, FR).entries[0]?.fulfils).toBeNull();
    expect(day(status, SA).state).toBe('planned');
    expect(status.summary).toMatchObject({ sessionsDone: 0, sessionsPlanned: 1, extraUnits: 1 });
    expect(status.summary.kcal).toBe(1520);
  });

  it('Antwort „Ja“: Fr ✓ statt Sa, Sa vorgezogen, keine Frage mehr', () => {
    const status = weekStatus({
      sessions: [run('sa', SA)],
      logs: [watchRun('w', FR)],
      assignments: [{ logId: 'w', sessionId: 'sa' }],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([]);
    expect(day(status, FR).entries[0]?.fulfils).toMatchObject({
      sessionId: 'sa',
      mode: 'assigned',
      shift: 'early',
    });
    expect(day(status, SA).state).toBe('moved');
    expect(fulfilledSessionIds(status).has('sa')).toBe(true);
    expect(status.summary).toMatchObject({ sessionsDone: 1, extraUnits: 0 });
  });

  it('Antwort „Nein, zusätzliche Einheit“: keine Frage, Sa bleibt geplant, nie automatisch', () => {
    const status = weekStatus({
      sessions: [run('sa', SA), run('fr', FR)],
      logs: [watchRun('w', FR)],
      assignments: [{ logId: 'w', sessionId: null }],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([]);
    // Auch der gleiche Tag zählt nach „Nein“ nicht automatisch.
    expect(day(status, FR).open.map((o) => o.sessionId)).toEqual(['fr']);
    expect(day(status, SA).state).toBe('planned');
    expect(status.summary.extraUnits).toBe(1);
  });

  it('gleicher Tag zählt ohne Nachfrage (Uhr-Lauf am Tag des geplanten Laufs)', () => {
    const status = weekStatus({
      sessions: [run('fr', FR), run('sa', SA)],
      logs: [watchRun('w', FR)],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([]);
    expect(day(status, FR).entries[0]?.fulfils).toMatchObject({
      sessionId: 'fr',
      mode: 'same_day',
      shift: 'same',
    });
    expect(day(status, FR).open).toEqual([]);
    expect(day(status, SA).state).toBe('planned');
  });

  it('nachgeholt per Uhr: verpasster Di-Lauf, Lauf am Do ohne Plan → Frage „nachgeholt“', () => {
    const status = weekStatus({
      sessions: [run('di', DI)],
      logs: [watchRun('w', DO)],
      weekOf: DO,
      today: FR,
    });
    expect(status.questions[0]).toMatchObject({ sessionId: 'di', shift: 'late' });
    const answered = weekStatus({
      sessions: [run('di', DI)],
      logs: [watchRun('w', DO)],
      assignments: [{ logId: 'w', sessionId: 'di' }],
      weekOf: DO,
      today: FR,
    });
    expect(day(answered, DI).doneElsewhere[0]).toMatchObject({ shift: 'late', doneOn: DO });
    expect(day(answered, DI).state).toBe('moved');
  });

  it('keine Frage bei anderer Sportart (Radfahrt vs. geplanter Lauf, Kraft vs. Lauf)', () => {
    const status = weekStatus({
      sessions: [run('sa', SA)],
      logs: [
        watchRun('rad', FR, { modality: 'bike', name_de: 'Radfahrt' }),
        log('kraft', DO, { is_free: true }),
      ],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([]);
  });

  it('keine Frage, wenn am Tag selbst eine Einheit dieser Art geplant (schon erledigt) ist', () => {
    const status = weekStatus({
      sessions: [run('fr', FR, { status: 'completed' }), run('sa', SA)],
      logs: [
        log('app', FR, { planned_session_id: 'fr', kind: 'endurance', modality: 'run' }),
        watchRun('w', FR),
      ],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions).toEqual([]);
    expect(day(status, FR).entries).toHaveLength(2);
  });

  it('keine Frage über die Wochengrenze (Lauf am So, geplanter Lauf am Mo der Folgewoche)', () => {
    const status = weekStatus({
      sessions: [run('next', addDays(MO, 7))],
      logs: [watchRun('w', SO)],
      weekOf: SO,
      today: SO,
    });
    expect(status.questions).toEqual([]);
  });

  it('Zuordnung zu einer Einheit der anderen Woche wird ignoriert', () => {
    const status = weekStatus({
      sessions: [run('next', addDays(MO, 7))],
      logs: [watchRun('w', SO)],
      assignments: [{ logId: 'w', sessionId: 'next' }],
      weekOf: SO,
      today: SO,
    });
    expect(day(status, SO).entries[0]?.fulfils).toBeNull();
  });

  it('zwei Uhr-Läufe, zwei offene Läufe: je eine Frage, nächster Tag zuerst, keine doppelte Einheit', () => {
    const status = weekStatus({
      sessions: [run('mi', MI), run('sa', SA)],
      logs: [watchRun('w1', DO), watchRun('w2', FR)],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions.map((q) => [q.logId, q.sessionId])).toEqual([
      ['w1', 'mi'],
      ['w2', 'sa'],
    ]);
  });

  it('Gleichstand beim Abstand: der frühere Tag wird gefragt', () => {
    const status = weekStatus({
      sessions: [run('mi', MI), run('fr', FR)],
      logs: [watchRun('w', DO)],
      weekOf: DO,
      today: SO,
    });
    expect(status.questions[0]?.sessionId).toBe('mi');
  });

  it('freie Kraft-Einheit (manuell) fragt ebenso; Ausdauer mit unbekannter Art passt zu jedem Lauf', () => {
    const status = weekStatus({
      sessions: [session('kraft', MO), run('sa', SA, { endurance_modality: null })],
      logs: [log('frei', DI, { is_free: true }), watchRun('w', FR, { modality: null })],
      weekOf: FR,
      today: FR,
    });
    expect(status.questions.map((q) => [q.logId, q.sessionId, q.shift, q.fromWatch])).toEqual([
      ['frei', 'kraft', 'late', false],
      ['w', 'sa', 'early', true],
    ]);
  });

  it('Alternativen für „Zuordnung ändern“: offene Einheiten gleicher Art dieser Woche', () => {
    const status = weekStatus({
      sessions: [run('mi', MI), run('sa', SA), session('k', SO)],
      logs: [watchRun('w', FR)],
      assignments: [{ logId: 'w', sessionId: 'sa' }],
      weekOf: FR,
      today: FR,
    });
    const entry = day(status, FR).entries[0];
    expect(entry?.changeable).toBe(true);
    expect(entry?.alternatives).toEqual([
      { sessionId: 'mi', date: MI, name_de: 'Lockerer Dauerlauf' },
    ]);
  });

  it('verknüpfte Einträge sind nicht änderbar', () => {
    const status = weekStatus({
      sessions: [session('a', MO, { status: 'completed' })],
      logs: [log('l', MO, { planned_session_id: 'a' })],
      weekOf: MO,
      today: MO,
    });
    expect(day(status, MO).entries[0]).toMatchObject({ changeable: false, alternatives: [] });
  });
});

describe('weekStatus – Wochengrenze und Summen', () => {
  it('am Montag der Folgewoche nachgetragen: steht am Termin, tatsächliches Datum dabei', () => {
    const status = weekStatus({
      sessions: [session('a', SO, { status: 'completed' })],
      logs: [log('l', addDays(SO, 1), { planned_session_id: 'a' })],
      weekOf: MO,
      today: addDays(SO, 1),
    });
    expect(day(status, SO).entries[0]).toMatchObject({
      performedOn: addDays(SO, 1),
      shownOn: SO,
      fulfils: expect.objectContaining({ shift: 'same' }),
    });
    // Die Folgewoche zählt den Eintrag nicht doppelt.
    const next = weekStatus({
      sessions: [session('a', SO, { status: 'completed' })],
      logs: [log('l', addDays(SO, 1), { planned_session_id: 'a' })],
      weekOf: addDays(SO, 1),
      today: addDays(SO, 1),
    });
    expect(next.days.every((d) => d.entries.length === 0)).toBe(true);
  });

  it('Summen: km gerundet, Minuten, kcal nur aus bekannten Werten; ohne kcal → null', () => {
    const status = weekStatus({
      sessions: [],
      logs: [
        watchRun('a', MO, { distance_m: 5_249, duration_s: 1_799, kcal: null }),
        watchRun('b', MI, { distance_m: 4_301, duration_s: 1_500, kcal: 300 }),
      ],
      weekOf: MO,
      today: SO,
    });
    expect(status.summary).toMatchObject({
      distanceKm: 9.6,
      enduranceMinutes: 29 + 25,
      kcal: 300,
      extraUnits: 2,
    });
    const none = weekStatus({ sessions: [], logs: [], weekOf: MO, today: SO });
    expect(none.summary.kcal).toBeNull();
    expect(none.summary.distanceKm).toBe(0);
  });

  it('Einträge anderer Wochen erscheinen nicht', () => {
    const status = weekStatus({
      sessions: [],
      logs: [watchRun('alt', addDays(MO, -1))],
      weekOf: MO,
      today: MO,
    });
    expect(status.days.every((d) => d.entries.length === 0)).toBe(true);
  });
});

describe('sameSportFamily', () => {
  it('Kraft zu Kraft, Lauf zu Lauf, unbekannte Art passt, Rad nicht zu Lauf', () => {
    const s = { kind: 'strength' as const, modality: null };
    const r = { kind: 'endurance' as const, modality: 'run' as const };
    const b = { kind: 'endurance' as const, modality: 'bike' as const };
    const any = { kind: 'endurance' as const, modality: null };
    expect(sameSportFamily(s, s)).toBe(true);
    expect(sameSportFamily(r, r)).toBe(true);
    expect(sameSportFamily(r, any)).toBe(true);
    expect(sameSportFamily(r, b)).toBe(false);
    expect(sameSportFamily(s, r)).toBe(false);
  });
});

describe('Antworten im Gerätespeicher', () => {
  const owner = '11111111-1111-4111-8111-111111111111';
  const a = (logId: string, sessionId: string | null, decidedAt = '2026-10-23T08:00:00.000Z') =>
    ({ ownerUserId: owner, logId, sessionId, decidedAt }) satisfies LogAssignment;

  it('liest nur gültige Einträge des eigenen Kontos; kaputt → leer', () => {
    const raw = JSON.stringify([
      a('l1', 's1'),
      { ...a('l2', null), ownerUserId: 'anderes-konto' },
      { kaputt: true },
    ]);
    expect(parseStoredLogAssignments(raw, owner)).toEqual([a('l1', 's1')]);
    expect(parseStoredLogAssignments('{nicht json', owner)).toEqual([]);
    expect(parseStoredLogAssignments('{}', owner)).toEqual([]);
    expect(parseStoredLogAssignments(null, owner)).toEqual([]);
  });

  it('ersetzt je Eintrag, deckelt auf die neuesten', () => {
    expect(upsertLogAssignment([a('l1', 's1')], a('l1', null))).toEqual([a('l1', null)]);
    const many = Array.from({ length: LOG_ASSIGNMENT_LIMITS.maxEntries }, (_, i) =>
      a(`l${i}`, null, `2026-10-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`),
    );
    const next = upsertLogAssignment(many, a('neu', 's', '2026-10-23T00:00:00.000Z'));
    expect(next).toHaveLength(LOG_ASSIGNMENT_LIMITS.maxEntries);
    expect(next.some((x) => x.logId === 'neu')).toBe(true);
  });

  it('lehnt ungültige Antworten ab', () => {
    expect(() => upsertLogAssignment([], { ...a('l', 's'), decidedAt: 'gestern' })).toThrow();
    expect(() => upsertLogAssignment([], a('', 's'))).toThrow();
  });
});
