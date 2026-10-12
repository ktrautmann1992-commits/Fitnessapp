import { describe, expect, it } from 'vitest';

import { findNutritionTextRuleHits, findTextRuleHits } from './text-rules';

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

describe('Health-Claims, Nährwert-Schlagworte und Lebensmittel-Marken (R10, Plan Abschnitt 10)', () => {
  const nutritionLabels = (text: string) => findNutritionTextRuleHits(text).map((hit) => hit.label);

  it.each([
    ['Stärkt das Immunsystem.', 'Immunsystem stärken'],
    ['Senkt Cholesterin.', 'Cholesterin senken'],
    ['Entgiftet den Körper.', 'entgiften'],
    ['Unser Detox-Smoothie', 'Detox'],
    ['Der perfekte Fatburner', 'Fatburner'],
    ['Kurbelt den Stoffwechsel an.', 'Stoffwechsel ankurbeln'],
    ['Ein echtes Superfood', 'Superfood'],
    ['Basische Gemüsesuppe', 'basisch'],
    ['Anti-Aging-Bowl', 'Anti-Aging'],
    ['Schützt vor Erkältungen.', 'schützt vor'],
    ['Eiweißreiches Frühstück', 'eiweißreich'],
    ['Proteinreich und lecker', 'proteinreich'],
    ['Zuckerfreier Kuchen', 'zuckerfrei'],
    ['Light-Joghurt', 'light'],
    ['Ballaststoffreiches Brot', 'ballaststoffreich'],
    ['Ein gesundes Frühstück', 'gesund'],
  ])('„%s“ → %s', (text, label) => {
    expect(nutritionLabels(text)).toContain(label);
  });

  it('Nährwert-Angaben nach VO 1924/2006 und Schlagworte (Wächter N2c, S1)', () => {
    const cases: [string, string][] = [
      ['Ein fettarmer Quark mit Honig.', 'fettarm'],
      ['Ballaststoff- und fettarm essen', 'fettarm'],
      ['Fettfreie Zubereitung.', 'fettfrei'],
      ['Kalorienarmes Abendessen.', 'kalorienarm'],
      ['Energiearme Beilage.', 'energiearm'],
      ['Zuckerarmer Kuchen.', 'zuckerarm'],
      ['Salzarme Brühe.', 'salzarm'],
      ['Natriumarmes Wasser.', 'natriumarm'],
      ['Ein Low-Carb-Abendessen.', 'Low Carb/Low Fat'],
      ['Low Carb und lecker.', 'Low Carb/Low Fat'],
      ['Lowfat-Joghurt.', 'Low Carb/Low Fat'],
      ['Reich an Eisen.', 'reich an'],
      ['Eine gute Proteinquelle.', 'Eiweiß-/Protein-/Ballaststoffquelle'],
      ['Wähle zuerst deine Eiweißquelle.', 'Eiweiß-/Protein-/Ballaststoffquelle'],
      ['Mit schlanker Tomatensauce.', 'schlank'],
    ];
    for (const [text, label] of cases) {
      expect(nutritionLabels(text), text).toContain(label);
    }
  });

  it('Produktbezeichnungen und Ähnliches ohne Angabe bleiben erlaubt', () => {
    for (const text of [
      'Kokosmilch fettreduziert',
      'Fett in der Pfanne erhitzen.',
      'Schlagsahne steif schlagen.',
      'Kohlenhydrate aus Reis.',
      'Ein reichhaltiges Frühstück.',
    ]) {
      expect(findNutritionTextRuleHits(text), text).toEqual([]);
    }
  });

  it('Lebensmittel-Marken (nur Produktarten)', () => {
    expect(nutritionLabels('Mit Nutella bestreichen.')).toEqual(['Nutella']);
    expect(nutritionLabels('Ein Würfel Maggi')).toEqual(['Maggi']);
    expect(nutritionLabels('Backpulver von Dr. Oetker')).toEqual(['Dr. Oetker']);
    expect(nutritionLabels('Cola von Coca-Cola')).toEqual(['Coca-Cola']);
    expect(findNutritionTextRuleHits('Philadelphia')[0]?.kind).toBe('brand');
  });

  it('enthält auch die Regeln für Übungen (Heilversprechen, Marken)', () => {
    expect(nutritionLabels('Heilt Magenprobleme')).toContain('heilen/Heilung');
  });

  it('neutrale Rezepttexte bleiben erlaubt (keine Fehlalarme)', () => {
    for (const text of [
      'Haferflocken mit Milch aufkochen und 3 Minuten quellen lassen.',
      'Maggikraut (Liebstöckel) fein hacken.',
      'Mit Basilikum garnieren.',
      'Etwa 25 g Eiweiß je Portion.',
      'Im Highlight der Woche: Linsencurry.',
      'Nach dem Gesundheits-Check freigeschaltet.',
    ]) {
      expect(findNutritionTextRuleHits(text), text).toEqual([]);
    }
  });

  it('Übungstexte (Ü6) prüfen Health-Claims nicht', () => {
    expect(findTextRuleHits('Light-Variante der Übung')).toEqual([]);
  });
});
