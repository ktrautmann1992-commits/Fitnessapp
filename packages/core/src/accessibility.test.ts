import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  fontScale,
  minTouchTarget,
  parseAccessibilitySettings,
  pickReadAloudVoice,
  readAloudExerciseText,
  scaledFontSize,
  suggestLargeView,
} from './accessibility';
import { LARGE_VIEW, READ_ALOUD } from './constants';

describe('Einstellungen Barrierefreiheit', () => {
  it('liest gültige Werte', () => {
    expect(parseAccessibilitySettings({ largeView: true, readAloud: false })).toEqual({
      largeView: true,
      readAloud: false,
    });
  });

  it.each([null, undefined, 'ja', {}, { largeView: 'ja', readAloud: false }, { largeView: true }])(
    'fällt bei %j auf die Standardwerte zurück',
    (raw) => {
      expect(parseAccessibilitySettings(raw)).toEqual(DEFAULT_ACCESSIBILITY_SETTINGS);
    },
  );

  it('lehnt fremde Schlüssel ab (strikt, keine Zusatzdaten)', () => {
    expect(parseAccessibilitySettings({ largeView: true, readAloud: true, age: 70 })).toEqual(
      DEFAULT_ACCESSIBILITY_SETTINGS,
    );
  });

  it('Standard: beides aus', () => {
    expect(DEFAULT_ACCESSIBILITY_SETTINGS).toEqual({ largeView: false, readAloud: false });
  });
});

describe('Große Ansicht: Schrift und Tippflächen', () => {
  it('Grundschrift 16 → 20 px (Faktor 1,25)', () => {
    expect(fontScale(false)).toBe(1);
    expect(fontScale(true)).toBe(1.25);
    expect(scaledFontSize(LARGE_VIEW.defaultBaseFontPx, true)).toBe(LARGE_VIEW.baseFontPx);
  });

  it('rundet auf ganze Pixel und lässt Werte ohne große Ansicht unverändert', () => {
    expect(scaledFontSize(13, true)).toBe(16);
    expect(scaledFontSize(14, true)).toBe(18);
    expect(scaledFontSize(36, true)).toBe(45);
    expect(scaledFontSize(13, false)).toBe(13);
  });

  it('lässt ungültige Größen unverändert (Grenzfälle)', () => {
    expect(scaledFontSize(0, true)).toBe(0);
    expect(scaledFontSize(-4, true)).toBe(-4);
    expect(scaledFontSize(Number.NaN, true)).toBeNaN();
  });

  it('Tippflächen 48 → 56 px', () => {
    expect(minTouchTarget(false)).toBe(48);
    expect(minTouchTarget(true)).toBe(56);
  });
});

describe('Vorschlag „Große Ansicht“ (FA-G2)', () => {
  it.each([
    [16, false],
    [59, false],
    [60, true],
    [64, true],
    [65, true],
    [100, true],
  ])('Alter %i → %s', (ageYears, expected) => {
    expect(suggestLargeView({ ageYears })).toBe(expected);
  });

  it('ohne Alter kein Vorschlag', () => {
    expect(suggestLargeView({ ageYears: null })).toBe(false);
  });

  it('andere Ziele ändern nichts', () => {
    expect(suggestLargeView({ ageYears: 40, goalType: 'muscle_gain' })).toBe(false);
  });
});

describe('Vorlesen: Stimme wählen (Wächter S11)', () => {
  const voice = (identifier: string, language: string, localService: boolean) => ({
    identifier,
    language,
    localService,
  });

  it('nimmt nur lokale Stimmen, bevorzugt de-DE', () => {
    expect(
      pickReadAloudVoice([
        voice('cloud-de', 'de-DE', false),
        voice('local-at', 'de-AT', true),
        voice('local-de', 'de-DE', true),
      ])?.identifier,
    ).toBe('local-de');
  });

  it('nimmt andere deutsche Varianten, auch mit Unterstrich', () => {
    expect(pickReadAloudVoice([voice('ch', 'de_CH', true)])?.identifier).toBe('ch');
  });

  it('keine lokale deutsche Stimme → null (Knopf ausblenden)', () => {
    expect(
      pickReadAloudVoice([voice('cloud', 'de-DE', false), voice('en', 'en-US', true)]),
    ).toBeNull();
    expect(pickReadAloudVoice([])).toBeNull();
  });
});

describe('Vorlesen: Text einer Übungsanleitung', () => {
  it('liest Name, Schritte, Tipps und Sicherheit in fester Reihenfolge', () => {
    expect(
      readAloudExerciseText({
        name: 'Aufstehen vom Stuhl',
        description: 'Kräftigt die Beine',
        steps: ['Setz dich vorn auf den Stuhl', ' Steh langsam auf. '],
        tips: ['Ausatmen beim Aufstehen'],
        safetyNote: 'Stuhl ohne Rollen nutzen',
      }),
    ).toBe(
      'Aufstehen vom Stuhl. Kräftigt die Beine. So geht es. Schritt 1: Setz dich vorn auf den Stuhl. ' +
        'Schritt 2: Steh langsam auf. Tipps. Ausatmen beim Aufstehen. Sicherheit. Stuhl ohne Rollen nutzen.',
    );
  });

  it('lässt leere Teile weg', () => {
    expect(readAloudExerciseText({ name: 'Wadenheben', steps: ['', '  '], tips: [] })).toBe(
      'Wadenheben.',
    );
  });

  it('kürzt sehr lange Texte am Satzende', () => {
    const steps = Array.from({ length: 400 }, (_, i) => `Langer Schritt Nummer ${i} mit Text`);
    const text = readAloudExerciseText({ name: 'Lang', steps });
    expect(text.length).toBeLessThanOrEqual(READ_ALOUD.maxChars);
    expect(text.endsWith('.')).toBe(true);
  });
});
