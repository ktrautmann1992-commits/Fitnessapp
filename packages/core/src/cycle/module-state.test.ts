import { describe, expect, it } from 'vitest';

import { cycleModuleOffered, cycleModuleState, type CycleModuleStateInput } from './module-state';

const base: CycleModuleStateInput = {
  sex: 'female',
  consentValid: true,
  consentActive: true,
  hasData: true,
  settings: { status: 'natural', paused: false },
  pregnancyFlag: false,
  accessOpen: true,
};

describe('Zustand des Zyklus-Moduls (Plan 7.2, 9.2)', () => {
  it('angeboten bei weiblich, divers, keine Angabe – nicht bei männlich oder ohne Angabe', () => {
    expect(cycleModuleOffered('female')).toBe(true);
    expect(cycleModuleOffered('diverse')).toBe(true);
    expect(cycleModuleOffered('unspecified')).toBe(true);
    expect(cycleModuleOffered('male')).toBe(false);
    expect(cycleModuleOffered(null)).toBe(false);
  });

  it('aktiv, pausiert, Status fehlt', () => {
    expect(cycleModuleState(base)).toBe('active');
    expect(cycleModuleState({ ...base, settings: { status: 'natural', paused: true } })).toBe(
      'paused',
    );
    expect(cycleModuleState({ ...base, settings: { status: null, paused: false } })).toBe(
      'needs_status',
    );
    expect(cycleModuleState({ ...base, settings: null })).toBe('needs_status');
  });

  it('Schwangerschaft: Status oder Flag aus dem Gesundheits-Check pausiert', () => {
    expect(cycleModuleState({ ...base, settings: { status: 'pregnant', paused: false } })).toBe(
      'paused_pregnancy',
    );
    expect(cycleModuleState({ ...base, pregnancyFlag: true })).toBe('paused_pregnancy');
  });

  it('ohne Einwilligung: Einführung; mit veralteter Einwilligung oder Daten: Verwaltung', () => {
    const none = { ...base, consentValid: false, consentActive: false, hasData: false };
    expect(cycleModuleState(none)).toBe('off');
    expect(cycleModuleState({ ...none, consentActive: true })).toBe('manage_only');
    expect(cycleModuleState({ ...none, hasData: true })).toBe('manage_only');
  });

  it('männlich: ohne Daten unsichtbar, mit Daten nur Verwaltung (S8)', () => {
    expect(
      cycleModuleState({
        ...base,
        sex: 'male',
        consentValid: false,
        consentActive: false,
        hasData: false,
      }),
    ).toBe('hidden');
    expect(cycleModuleState({ ...base, sex: 'male' })).toBe('manage_only');
  });

  it('Supabase ohne Freischaltung: ausgeblendet, Verwaltung bleibt bei Daten (N3)', () => {
    expect(
      cycleModuleState({
        ...base,
        accessOpen: false,
        consentValid: false,
        consentActive: false,
        hasData: false,
      }),
    ).toBe('hidden');
    expect(cycleModuleState({ ...base, accessOpen: false })).toBe('manage_only');
  });
});
