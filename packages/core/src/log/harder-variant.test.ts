import { describe, expect, it } from 'vitest';

import { equipmentProfile } from '../plan/equipment-profile';
import { planSafetyRules } from '../plan/safety';
import { MONDAY, person, repoLibrary } from '../plan/test-library';
import { progressHintForDisplay } from './harder-variant';

/**
 * Hinweis „schwerere Variante“ mit konkretem Vorschlag (docs/PLAN-KOERPERGEWICHT.md §5.5, A10) – mit den echten
 * Inhalten aus content/.
 */
const library = repoLibrary().exercises;
const nothing = equipmentProfile('home', []);
const rules = (overrides: Parameters<typeof person>[0] = {}) =>
  planSafetyRules(person(overrides), MONDAY);
const healthy = rules();
const harder = { hint: 'harder_variant' } as const;
const advanced = 'advanced' as const;

describe('progressHintForDisplay', () => {
  it('exclude (Wächter S2): ausgeschlossene Variante (Ort bzw. Einheit) → kein Hinweis', () => {
    expect(
      progressHintForDisplay('tuerrahmen-rudern', harder, {
        library,
        profile: nothing,
        rules: healthy,
        experienceLevel: advanced,
        exclude: new Set(['tisch-rudern']),
      }),
    ).toEqual({ hint: null, harderVariant: null });
  });

  it('Türrahmen-Rudern ohne Geräte → Tisch-Rudern (Alternative mit Grund „harder“)', () => {
    expect(
      progressHintForDisplay('tuerrahmen-rudern', harder, {
        library,
        profile: nothing,
        rules: healthy,
        experienceLevel: advanced,
      }),
    ).toEqual({
      hint: 'harder_variant',
      harderVariant: { exerciseId: 'tisch-rudern', nameDe: library.get('tisch-rudern')?.name_de },
    });
  });

  it('gesperrte Variante → kein Vorschlag und kein Hinweis (ab 65, vorsichtig, unter 18: high_skill)', () => {
    for (const r of [
      rules({ birthDate: '1958-01-01' }),
      rules({ healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] } }),
      rules({ healthScreening: null }),
      rules({ birthDate: '2009-06-01' }),
    ]) {
      expect(
        progressHintForDisplay('tuerrahmen-rudern', harder, {
          library,
          profile: nothing,
          rules: r,
          experienceLevel: advanced,
        }),
      ).toEqual({ hint: null, harderVariant: null });
    }
  });

  it('Schwangerschaft: Variante in langer Rückenlage (Tisch-Rudern) wird nie vorgeschlagen', () => {
    const r = rules({ sex: 'female', healthScreening: { flags: ['pregnancy'] } });
    expect(
      progressHintForDisplay('tuerrahmen-rudern', harder, {
        library,
        profile: nothing,
        rules: r,
        experienceLevel: advanced,
      }),
    ).toEqual({ hint: null, harderVariant: null });
  });

  it('nicht machbare Variante wird übersprungen: Kniebeuge ohne Kurzhanteln → Kniebeuge mit Pause', () => {
    expect(
      progressHintForDisplay('kniebeuge-koerpergewicht', harder, {
        library,
        profile: nothing,
        rules: healthy,
        experienceLevel: advanced,
      }).harderVariant?.exerciseId,
    ).toBe('kniebeuge-pause');
    const withDumbbells = equipmentProfile('home', [{ equipmentId: 'dumbbells', weightsKg: [8] }]);
    expect(
      progressHintForDisplay('kniebeuge-koerpergewicht', harder, {
        library,
        profile: withDumbbells,
        rules: healthy,
        experienceLevel: advanced,
      }).harderVariant?.exerciseId,
    ).toBe('goblet-kniebeuge');
  });

  it('nur Klimmzugstange (A6): Handtuch-Latziehen → Klimmzug; mit Band zuerst der unterstützte Klimmzug', () => {
    const bar = equipmentProfile('home', [{ equipmentId: 'pull_up_bar', weightsKg: [] }]);
    expect(
      progressHintForDisplay('handtuch-latziehen', harder, {
        library,
        profile: bar,
        rules: healthy,
        experienceLevel: advanced,
      }).harderVariant?.exerciseId,
    ).toBe('klimmzug');
    const barAndBand = equipmentProfile('home', [
      { equipmentId: 'pull_up_bar', weightsKg: [] },
      { equipmentId: 'resistance_bands', weightsKg: [] },
    ]);
    expect(
      progressHintForDisplay('handtuch-latziehen', harder, {
        library,
        profile: barAndBand,
        rules: healthy,
        experienceLevel: advanced,
      }).harderVariant?.exerciseId,
    ).toBe('klimmzug-band-unterstuetzt');
    expect(
      progressHintForDisplay('handtuch-latziehen', harder, {
        library,
        profile: nothing,
        rules: healthy,
        experienceLevel: advanced,
      }),
    ).toEqual({ hint: null, harderVariant: null });
  });

  it('W8: Einsteiger und vorsichtige Pläne höchstens eine Schwierigkeitsstufe schwerer', () => {
    const bar = equipmentProfile('home', [{ equipmentId: 'pull_up_bar', weightsKg: [] }]);
    const barAndBand = equipmentProfile('home', [
      { equipmentId: 'pull_up_bar', weightsKg: [] },
      { equipmentId: 'resistance_bands', weightsKg: [] },
    ]);
    const beginner = { library, rules: healthy, experienceLevel: 'beginner' as const };
    // Nicht direkt auf den freien Klimmzug (Schwierigkeit 1 → 3), aber auf den unterstützten (→ 2).
    expect(
      progressHintForDisplay('handtuch-latziehen', harder, { ...beginner, profile: bar }),
    ).toEqual({
      hint: null,
      harderVariant: null,
    });
    expect(
      progressHintForDisplay('handtuch-latziehen', harder, { ...beginner, profile: barAndBand })
        .harderVariant?.exerciseId,
    ).toBe('klimmzug-band-unterstuetzt');
    // Türrahmen-Rudern (1) → Tisch-Rudern (3) nur für Fortgeschrittene ohne Vorsicht.
    expect(
      progressHintForDisplay('tuerrahmen-rudern', harder, { ...beginner, profile: nothing }).hint,
    ).toBeNull();
    // Ein Schritt bleibt erlaubt: Kniebeuge (1) → Kniebeuge mit Pause (2).
    expect(
      progressHintForDisplay('kniebeuge-koerpergewicht', harder, { ...beginner, profile: nothing })
        .harderVariant?.exerciseId,
    ).toBe('kniebeuge-pause');
  });

  it('andere Hinweise bleiben unverändert, unbekannte Übung → kein Vorschlag', () => {
    const ctx = { library, profile: nothing, rules: healthy, experienceLevel: advanced };
    expect(progressHintForDisplay('liegestuetz', { hint: null }, ctx)).toEqual({
      hint: null,
      harderVariant: null,
    });
    expect(progressHintForDisplay('rudern-band', { hint: 'stronger_band' }, ctx)).toEqual({
      hint: 'stronger_band',
      harderVariant: null,
    });
    expect(progressHintForDisplay('gibt-es-nicht', harder, ctx)).toEqual({
      hint: null,
      harderVariant: null,
    });
  });
});
