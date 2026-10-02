import { describe, expect, it } from 'vitest';

import {
  DELOAD_INTERVAL_WEEKS,
  ENDURANCE_HIGH_INTENSITY_SHARE,
  MAX_CALORIE_DEFICIT_FRACTION,
  MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION,
  MAX_WEEKLY_WEIGHT_LOSS_FRACTION,
  MIN_AGE_YEARS,
  MIN_INTAKE_RELATIVE_TO_BMR,
} from './constants';

// Diese Tests sichern die Schutzgrenzen aus CLAUDE.md ab: Wer sie lockert, muss bewusst den Test ändern.
describe('Schutzgrenzen aus CLAUDE.md', () => {
  it('Mindestalter 16 Jahre', () => {
    expect(MIN_AGE_YEARS).toBe(16);
  });

  it('Kaloriendefizit höchstens 25 % unter Gesamtumsatz', () => {
    expect(MAX_CALORIE_DEFICIT_FRACTION).toBeLessThanOrEqual(0.25);
    expect(MAX_CALORIE_DEFICIT_FRACTION).toBeGreaterThan(0);
  });

  it('Zufuhr nie unter Grundumsatz', () => {
    expect(MIN_INTAKE_RELATIVE_TO_BMR).toBeGreaterThanOrEqual(1);
  });

  it('Gewichtsverlust höchstens ca. 1 % Körpergewicht pro Woche', () => {
    expect(MAX_WEEKLY_WEIGHT_LOSS_FRACTION).toBeLessThanOrEqual(0.01);
  });

  it('Ausdauer-Wochenumfang höchstens ca. 10 % Steigerung', () => {
    expect(MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION).toBeLessThanOrEqual(0.1);
  });

  it('Deload-Intervall ist plausibel (4–6 Wochen)', () => {
    expect(DELOAD_INTERVAL_WEEKS.min).toBe(4);
    expect(DELOAD_INTERVAL_WEEKS.max).toBe(6);
  });

  it('Intensitätsverteilung ca. 80/20', () => {
    expect(ENDURANCE_HIGH_INTENSITY_SHARE).toBe(0.2);
  });
});
