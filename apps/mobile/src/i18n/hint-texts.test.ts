import { describe, expect, it } from 'vitest';

import { PLAN_NOTES, SCHEDULE_HINTS, WEIGHT_GOAL_NOTICE_CODES } from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Jeder Hinweis-Code aus packages/core hat einen deutschen Text. Der Typ der Übersetzungen erkennt fehlende
 * Schlüssel nicht – ohne diesen Test stünde in der App „undefined“ (docs/PLAN-ZIELE.md, Etappe Z1).
 */
describe('Texte für Hinweis-Codes', () => {
  it.each(SCHEDULE_HINTS)('Trainingstage: %s', (code) => {
    const text = (t.steps.trainingSchedule.hints as Record<string, string | undefined>)[code];
    expect(typeof text).toBe('string');
    expect(text!.length).toBeGreaterThan(10);
  });

  it.each(PLAN_NOTES)('Plan-Hinweis: %s', (code) => {
    const text = (t.plan.notes as Record<string, string | undefined>)[code];
    expect(typeof text).toBe('string');
  });

  // Etappe Z5: Hinweise zum Abnehmziel in der Ernährungs-Übersicht – neutral, ohne Zahlen und ohne Prognose (F7).
  it.each(WEIGHT_GOAL_NOTICE_CODES)('Abnehmziel: %s', (code) => {
    const text = (t.weightGoalLife.nutrition as Record<string, string | undefined>)[code];
    expect(typeof text).toBe('string');
    expect(text).not.toMatch(/\d|garantiert|wirst|erreichbar am/);
  });
});
