import { describe, expect, it } from 'vitest';

import { findTextRuleHits } from './text-rules';

const labels = (text: string) => findTextRuleHits(text).map((hit) => hit.label);

describe('Textregeln (Ü6)', () => {
  it.each([
    ['Diese Übung heilt Rückenprobleme.', 'heilen/Heilung'],
    ['Unterstützt die Heilung.', 'heilen/Heilung'],
    ['Ideal für die Therapie.', 'Therapie'],
    ['therapeutisch wertvoll', 'Therapie'],
    ['Keine Diagnose nötig.', 'Diagnose'],
    ['Garantiert schnelle Erfolge!', 'garantiert'],
    ['Danach bist du schmerzfrei.', 'schmerzfrei'],
    ['Aus der Reha bekannt.', 'Reha'],
    ['Geeignet zur Rehabilitation.', 'Reha'],
    ['lindert Verspannungen', 'lindern'],
    ['zur Behandlung von Beschwerden', 'Behandlung'],
    ['behandelt Fehlhaltungen', 'behandeln'],
    ['medizinisch empfohlen', 'medizinisch'],
    ['schützt die Bandscheiben', 'Bandscheibe'],
    ['gegen Arthrose', 'Arthrose'],
    ['bei Diabetes', 'Diabetes'],
    ['ein echtes Wundermittel', 'Wundermittel'],
  ])('„%s“ → %s', (text, label) => {
    expect(labels(text)).toContain(label);
  });

  it('Marken werden erkannt (herstellerneutral)', () => {
    expect(labels('Am TRX-Band ausführen.')).toEqual(['TRX']);
    expect(labels('Mit einem Theraband.')).toEqual(['Thera-Band']);
    expect(labels('mit dem Thera-Band')).toEqual(['Thera-Band']);
    expect(labels('auf dem Concept2-Rudergerät')).toEqual(['Concept 2']);
    expect(findTextRuleHits('Life  Fitness Maschine')[0]?.kind).toBe('brand');
  });

  it('normale Technik-Texte bleiben erlaubt (keine Fehlalarme)', () => {
    for (const text of [
      'Oberkörper leicht vorbeugen, Rücken gerade halten.',
      'Mit dem Medizinball an die Wand werfen.',
      'Bei Schmerzen die Übung abbrechen.',
      'Heben und Senken kontrolliert ausführen.',
      'Mit einem Seil am Kabelzug ziehen.',
      'Die Garage ist ein guter Trainingsort.',
    ]) {
      expect(findTextRuleHits(text), text).toEqual([]);
    }
  });

  it('Wortanfang zählt, Wortmitte nicht', () => {
    // „heil“ in der Wortmitte („Teilheilung“) wird ignoriert, am Wortanfang erkannt.
    expect(labels('Teilheilung')).toEqual([]);
    expect(labels('Heilsam')).toEqual(['heilen/Heilung']);
    expect(labels('TRXL')).toEqual([]);
  });
});
