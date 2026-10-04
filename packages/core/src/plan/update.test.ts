import { describe, expect, it } from 'vitest';

import { PLAN_ENGINE_VERSION } from '../constants';
import { planInputsSchema, planInputsSnapshot } from './inputs';
import { crossedAgeThreshold, type PlanForUpdate, planNeedsUpdate } from './update';
import { person } from './test-library';

const inputs = planInputsSnapshot(planInputsSchema.parse(person()));
const plan: PlanForUpdate = {
  inputs,
  engine_version: PLAN_ENGINE_VERSION,
  template_id: 'muskelaufbau-einsteiger-3t-studio',
  template_version: 1,
  created_at: '2026-10-05T10:00:00.000Z',
  created_on: '2026-10-05',
  uses_health_data: true,
};
const current = {
  inputs,
  birthDate: '1996-01-15',
  latestScreeningAt: '2026-10-01T08:00:00.000Z',
  healthConsentValid: true,
  currentTemplateVersion: 1,
};

describe('planNeedsUpdate', () => {
  it('nichts geändert → kein Update', () => {
    expect(planNeedsUpdate(plan, current, '2026-10-20')).toEqual({
      needsUpdate: false,
      reasons: [],
    });
  });

  it('Angaben geändert (Reihenfolge egal)', () => {
    const changed = planInputsSnapshot(planInputsSchema.parse(person({ sessionsPerWeek: 4 })));
    expect(planNeedsUpdate(plan, { ...current, inputs: changed }, '2026-10-20').reasons).toEqual([
      'inputs_changed',
    ]);
    const reordered = planInputsSnapshot(
      planInputsSchema.parse(person({ preferredDays: [5, 3, 1] })),
    );
    expect(planNeedsUpdate(plan, { ...current, inputs: reordered }, '2026-10-20').needsUpdate).toBe(
      false,
    );
  });

  it('Regeln, Vorlagen-Version, neuer Check, Einwilligung fehlt', () => {
    expect(
      planNeedsUpdate({ ...plan, engine_version: 0 }, current, '2026-10-20').reasons,
    ).toContain('engine_version');
    expect(
      planNeedsUpdate(plan, { ...current, currentTemplateVersion: 2 }, '2026-10-20').reasons,
    ).toContain('template_version');
    expect(
      planNeedsUpdate(
        plan,
        { ...current, latestScreeningAt: '2026-10-10T08:00:00.000Z' },
        '2026-10-20',
      ).reasons,
    ).toContain('health_check_newer');
    expect(
      planNeedsUpdate(plan, { ...current, healthConsentValid: false }, '2026-10-20').reasons,
    ).toContain('health_consent_missing');
    expect(
      planNeedsUpdate(
        { ...plan, uses_health_data: false },
        { ...current, healthConsentValid: false },
        '2026-10-20',
      ).needsUpdate,
    ).toBe(false);
  });

  it('neuer Check am SELBEN Tag: Zeitstempel entscheidet', () => {
    expect(
      planNeedsUpdate(
        plan,
        { ...current, latestScreeningAt: '2026-10-05T15:00:00.000Z' },
        '2026-10-05',
      ).reasons,
    ).toContain('health_check_newer');
    expect(
      planNeedsUpdate(
        plan,
        { ...current, latestScreeningAt: '2026-10-05T09:00:00.000Z' },
        '2026-10-05',
      ).reasons,
    ).not.toContain('health_check_newer');
    expect(
      planNeedsUpdate(plan, { ...current, latestScreeningAt: null }, '2026-10-05').needsUpdate,
    ).toBe(false);
  });

  it('18. und 65. Geburtstag seit Planerstellung', () => {
    expect(
      planNeedsUpdate(plan, { ...current, birthDate: '2008-10-10' }, '2026-10-20').reasons,
    ).toContain('age_threshold');
    expect(
      planNeedsUpdate(plan, { ...current, birthDate: '1961-10-10' }, '2026-10-20').reasons,
    ).toContain('age_threshold');
    expect(
      planNeedsUpdate(plan, { ...current, birthDate: '1961-10-21' }, '2026-10-20').reasons,
    ).not.toContain('age_threshold');
  });

  it('crossedAgeThreshold: Geburtstag am Erstellungstag zählt nicht, am Folgetag schon', () => {
    expect(crossedAgeThreshold('2008-10-05', '2026-10-05', '2026-10-06')).toBe(false);
    expect(crossedAgeThreshold('2008-10-06', '2026-10-05', '2026-10-06')).toBe(true);
    expect(crossedAgeThreshold('1990-01-01', '2026-10-05', '2026-10-05')).toBe(false);
  });
});

describe('planNeedsUpdate – Engine-Version 2', () => {
  it('Plan der Engine-Version 1 → „Plan neu erstellen?“ (engine_version), nie stilles Ersetzen', () => {
    expect(
      planNeedsUpdate({ ...plan, engine_version: 1 }, current, '2026-10-20').reasons,
    ).toContain('engine_version');
  });

  it('reiner Ausdauer-Plan ohne Vorlage: keine Vorlagen-Version zu vergleichen', () => {
    const endurancePlan = { ...plan, template_id: null, template_version: null };
    expect(
      planNeedsUpdate(endurancePlan, { ...current, currentTemplateVersion: 5 }, '2026-10-20'),
    ).toEqual({
      needsUpdate: false,
      reasons: [],
    });
  });

  it('geänderte Trainingstage (Art oder Dauer) → inputs_changed', () => {
    const changed = planInputsSnapshot(planInputsSchema.parse(person({ minutesPerSession: 45 })));
    expect(planNeedsUpdate(plan, { ...current, inputs: changed }, '2026-10-20').reasons).toContain(
      'inputs_changed',
    );
  });
});
