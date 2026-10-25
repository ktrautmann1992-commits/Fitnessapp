import {
  BODY_REGIONS,
  findTextRuleHits,
  MODE_NOTICES,
  TRAVEL_EQUIPMENT_OPTIONS,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { deModes } from './de-training-modes';

/**
 * Texte der Trainings-Modi (docs/PLAN-TRAINING-MODI.md): keine Heilversprechen, keine medizinischen Aussagen wie
 * „Diagnose“, „Therapie“, „Reha“, „schmerzfrei“ (Textregeln Ü6), keine Markennamen (Schlingentrainer markenneutral).
 * Funktionen werden mit Platzhaltern aufgerufen.
 */
function texts(value: unknown, path: string): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    return [[path, (value as (...a: unknown[]) => string)('{a}', '{b}', '{c}', '{d}')]];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => texts(child, `${path}.${key}`));
  }
  return [];
}

describe('Texte Trainings-Modi (de-training-modes.ts)', () => {
  it.each(texts(deModes, 'modes'))('%s: keine Heilversprechen, keine Marken', (_path, text) => {
    expect(findTextRuleHits(text)).toEqual([]);
    expect(text).not.toMatch(/\bTRX\b/i);
  });

  it('jede Region, jedes Gerät und jeder Hinweis-Code hat einen Text', () => {
    for (const r of BODY_REGIONS) expect(deModes.regions[r]).toBeTruthy();
    for (const e of TRAVEL_EQUIPMENT_OPTIONS) expect(deModes.equipment[e]).toBeTruthy();
    for (const n of MODE_NOTICES) expect(deModes.notices[n]).toBeTruthy();
  });

  it('Pflichtsätze: ärztlich abklären lassen, kein Ersatz für ärztlichen Rat, Notruf', () => {
    expect(deModes.pain.adviceTitle).toBe('Bitte ärztlich abklären lassen');
    expect(deModes.pain.disclaimer).toContain('ersetzt keinen ärztlichen Rat');
    expect(deModes.pain.adviceEmergency).toContain('112');
  });
});
