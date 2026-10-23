import { weekStatus, type WeekStatusLog, type WeekStatusSession } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  clockText,
  dayBadge,
  entryStats,
  insteadOfTag,
  questionTexts,
  stripDayA11y,
  weekRowMeta,
  weekRowTitle,
} from './week-status-format';

const FR = '2026-10-23';
const SA = '2026-10-24';
const run: WeekStatusSession = {
  id: 'sa',
  scheduled_on: SA,
  original_date: null,
  status: 'planned',
  kind: 'endurance',
  endurance_modality: 'run',
  name_de: 'Lockerer Dauerlauf',
  plan_active: true,
  estimated_minutes: 40,
};
const watch: WeekStatusLog = {
  id: 'w',
  planned_session_id: null,
  performed_on: FR,
  kind: 'endurance',
  status: 'completed',
  name_de: 'Lauf',
  is_free: true,
  source: 'health_connect',
  modality: 'run',
  duration_s: 8037,
  distance_m: 22_840,
  kcal: 1520,
  started_at: '2026-10-23T06:13:00.000Z',
};
const day = (status: ReturnType<typeof weekStatus>, date: string) =>
  status.days.find((d) => d.date === date)!;

describe('Texte der Training-Übersicht', () => {
  const answered = weekStatus({
    sessions: [run],
    logs: [watch],
    assignments: [{ logId: 'w', sessionId: 'sa' }],
    weekOf: FR,
    today: FR,
  });

  it('Freitag: erledigt, „statt Sa“; Samstag: vorgezogen', () => {
    expect(stripDayA11y(day(answered, FR))).toBe(
      'Freitag, 23.10.: Lauf 22,8 km (heute, erledigt, statt Sa)',
    );
    expect(insteadOfTag(day(answered, FR))).toBe('statt Sa');
    expect(stripDayA11y(day(answered, SA))).toBe(
      'Samstag, 24.10.: Lockerer Dauerlauf (vorgezogen, erledigt am Fr)',
    );
    expect(dayBadge(day(answered, SA))).toEqual({ text: '↶ vorgezogen', tone: 'warning' });
    expect(weekRowTitle(day(answered, SA))).toBe('Sa · frei');
    expect(weekRowMeta(day(answered, FR), { pending: new Set() })).toBe(
      'heute · laut Uhr · statt Sa · 2:13:57 · ca. 1.520 kcal',
    );
  });

  it('Ruhetag und geplant', () => {
    const plain = weekStatus({ sessions: [run], logs: [], weekOf: FR, today: FR });
    expect(stripDayA11y(day(plain, '2026-10-19'))).toBe('Montag, 19.10.: Ruhetag');
    expect(dayBadge(day(plain, SA))).toEqual({ text: 'geplant', tone: 'primary' });
    expect(weekRowMeta(day(plain, SA), { pending: new Set() })).toBe('ca. 40 min');
  });

  it('Werte: Uhrzeit, Pace, kcal', () => {
    expect(clockText(8037)).toBe('2:13:57');
    expect(clockText(2104)).toBe('35:04');
    expect(
      entryStats({
        durationS: 8037,
        distanceM: 22_840,
        kcal: 1520,
        modality: 'run',
        kind: 'endurance',
        doneSets: 0,
      }),
    ).toEqual(['2:13:57', '5:52 min/km', 'ca. 1.520 kcal']);
  });

  it('Frage: Uhr-Lauf, Samstag', () => {
    const open = weekStatus({ sessions: [run], logs: [watch], weekOf: FR, today: FR });
    const q = open.questions[0]!;
    const texts = questionTexts(q);
    expect(texts.title).toBe('Neuer Lauf von deiner Uhr');
    expect(texts.meta).toMatch(/^Fr \d{2}:\d{2} · 22,8 km · 2:13 h$/);
    expect(texts.text).toBe(
      'Am Samstag ist „Lockerer Dauerlauf“ geplant. Soll dieser Lauf dafür zählen?',
    );
    expect(texts.yes).toBe('Ja, Samstag ist erledigt');
    expect(texts.no).toBe('Nein, zusätzliche Einheit');
  });
});
