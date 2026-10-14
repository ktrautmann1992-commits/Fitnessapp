/**
 * Wächter N6 S1: Rezept-Beschreibungen aus der Gründer-Datei (`seed/alpha5-rezepte.json`, nur gelesen) nennen teils
 * Nährwert-Mengen („fast 30 g Eiweiß“, „über 100 g Kohlenhydrate“). Im PDF fallen solche Sätze immer weg, in der App
 * bei „Zahlen aus“/Schwangerschaft – mit `withoutNutrientAmounts` aus packages/core (dieselbe Erkennung wie der
 * Ratgeber). Geprüft wird jede echte Beschreibung: Nach dem Filter steht keine Energie-Zahl und keine Makro-Menge mehr.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mentionsEnergyOrMacroGrams, withoutNutrientAmounts } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

const REAL_FILE = join(__dirname, '../../seed/alpha5-rezepte.json');

function descriptions(): string[] {
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        if (key === 'beschreibung' && typeof v === 'string') found.push(v);
        else visit(v);
      }
    }
  };
  visit(JSON.parse(readFileSync(REAL_FILE, 'utf8')));
  return found;
}

describe('Rezept-Beschreibungen ohne Nährwert-Mengen (Wächter N6 S1)', () => {
  const all = descriptions();

  it('liest die Beschreibungen der Gründer-Datei', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('nach dem Filter nennt keine Beschreibung mehr kcal oder Makro-Mengen', () => {
    for (const text of all) {
      const shown = withoutNutrientAmounts(text);
      if (shown !== null) expect(mentionsEnergyOrMacroGrams(shown), text).toBe(false);
    }
  });

  it('die bekannten Formulierungen fallen weg; Beschreibungen ohne Mengen bleiben unverändert', () => {
    const hits = all.filter((text) => withoutNutrientAmounts(text) !== text);
    for (const phrase of [
      'fast 30 g Eiweiß',
      'über 100 g Kohlenhydrate',
      'über 80 g Kohlenhydrate',
      'über 35 g Eiweiß',
      'über 30 g pflanzliches Eiweiß',
      'rund 20 g Eiweiß',
      'über 30 g Eiweiß bei wenig Kalorien',
    ]) {
      expect(
        hits.some((text) => text.includes(phrase)),
        phrase,
      ).toBe(true);
    }
    // „viel Eiweiß bei wenig Kalorien“ ohne Menge ist keine Zahl (Health-Claims-Prüfung R10) – bleibt stehen.
    const noAmount = all.find((text) => text.includes('viel Eiweiß bei wenig Kalorien'));
    expect(noAmount).toBeDefined();
    expect(withoutNutrientAmounts(noAmount as string)).toBe(noAmount);
  });
});
