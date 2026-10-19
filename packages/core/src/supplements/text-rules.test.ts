import { describe, expect, it } from 'vitest';

import { claimBlockText, APPROVED_CLAIMS } from './claims';
import {
  renderSupplementNotice,
  SUPPLEMENT_MANDATORY_SENTENCES_DE,
  SUPPLEMENT_NOTICE_KEYS,
  SUPPLEMENT_NOTICE_TEXTS_DE,
} from './notices';
import { PROTEIN_SELF_CHECK_QUESTION_DE, SUPPLEMENT_SCREENING_QUESTIONS } from './screening';
import { checkSupplementText, SUPPLEMENT_FORBIDDEN_TERMS } from './text-rules';

/** Je Wort aus SUPPLEMENT_FORBIDDEN_TERMS ein verbotenes und ein erlaubtes Beispiel (Plan 3.8 Nr. 2 und 5). */
const EXAMPLES: Readonly<Record<string, { bad: string; good: string }>> = {
  steigert: { bad: 'Das steigert die Kraft.', good: 'Dein Gewicht kann steigen.' },
  Leistungssteigerung: { bad: 'Für die Leistungssteigerung.', good: 'Leistungsklasse ist egal.' },
  leistungsfähig: { bad: 'Du wirst leistungsfähiger.', good: 'Leistungssport braucht Planung.' },
  verbessert: { bad: 'Verbessert die Ausdauer.', good: 'Besser früh trinken.' },
  'boost/Booster': { bad: 'Ein echter Booster.', good: 'Ein Boot fährt los.' },
  beschleunigt: { bad: 'Beschleunigt die Regeneration.', good: 'Schleunigst eintragen.' },
  Konzentration: { bad: 'Für mehr Konzentration.', good: 'Molkenprotein-Konzentrat ist üblich.' },
  wach: { bad: 'Macht wach.', good: 'Für Erwachsene gedacht, Muskeln wachsen.' },
  anabol: { bad: 'Wirkt anabol.', good: 'Ana bolzt.' },
  Testosteron: { bad: 'Mehr Testosteron.', good: 'Ein Test am Morgen.' },
  Hormon: { bad: 'Gut für die Hormone.', good: 'Harmonie im Alltag.' },
  bewiesen: { bad: 'Das ist bewiesen.', good: 'Eine Wiese im Sommer.' },
  'wissenschaftlich belegt': {
    bad: 'Wissenschaftlich belegt.',
    good: 'Gute Studienlage.',
  },
  klinisch: { bad: 'Klinisch getestet.', good: 'Eine Klinke an der Tür.' },
  Mangel: { bad: 'Bei Eisenmangel.', good: 'Lass deine Blutwerte ärztlich prüfen.' },
  dopingfrei: { bad: 'Garantiert doping-frei.', good: 'Auf Dopingsubstanzen geprüft.' },
  sauber: { bad: 'Ein sauberes Produkt.', good: 'Eine saure Gurke.' },
  '100 %': { bad: 'Zu 100 % rein.', good: 'Ganz rein.' },
  natürlich: { bad: 'Natürlich aus Pflanzen.', good: 'Aus Pflanzen.' },
  'Abnehmen mit': { bad: 'Abnehmen mit Protein.', good: 'Beim Abnehmen zählt die Energie.' },
  schützt: { bad: 'Schützt die Zellen.', good: 'Der Schutz der Daten.' },
  stärkt: { bad: 'Stärkt die Muskeln.', good: 'Kartoffeln enthalten Stärke.' },
  Wirkung: { bad: 'Die Wirkung setzt ein.', good: 'Ein Wirkstoff heißt Kreatin.' },
  fördert: { bad: 'Fördert die Regeneration.', good: 'Ein Förderband im Lager.' },
  'erhöht die Leistung': {
    bad: 'Erhöht die Leistung.',
    good: 'Die Leistungsklasse ist egal.',
  },
  Leistungsplus: { bad: 'Ein echtes Leistungsplus.', good: 'Leistungssport braucht Planung.' },
  'Fett verbrennen': { bad: 'So kannst du Fett verbrennen.', good: 'Fett ist ein Nährstoff.' },
};

describe('SUPPLEMENT_FORBIDDEN_TERMS (Plan 3.8 Nr. 2)', () => {
  it('jedes Wort hat Beispiele', () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual(
      SUPPLEMENT_FORBIDDEN_TERMS.map((rule) => rule.label).sort(),
    );
  });

  it.each(SUPPLEMENT_FORBIDDEN_TERMS.map((rule) => rule.label))(
    '%s: positiv und negativ',
    (label) => {
      const { bad, good } = EXAMPLES[label]!;
      expect(checkSupplementText(bad).map((hit) => hit.label)).toContain(label);
      expect(checkSupplementText(good).filter((hit) => hit.kind === 'supplement')).toEqual([]);
    },
  );

  it('bestehende Listen gelten mit („Medizinball“ erlaubt, „heilt“ und Marken verboten)', () => {
    expect(checkSupplementText('Übung mit dem Medizinball.')).toEqual([]);
    expect(checkSupplementText('Kreatin heilt alles.').map((hit) => hit.kind)).toContain('medical');
    expect(checkSupplementText('Wie ein Shake von Gymshark.').map((hit) => hit.kind)).toContain(
      'brand',
    );
    expect(checkSupplementText('Stärkt das Immunsystem.').map((hit) => hit.kind)).toContain(
      'health_claim',
    );
  });

  it.each([
    ['gesteigerte Leistung', 'steigert'],
    ['Energiebooster für dein Training', 'boost/Booster'],
    ['Du fühlst dich gestärkt.', 'stärkt'],
    ['stärker werden', 'stärkt'],
    ['Das stärkte dich.', 'stärkt'],
  ])('abgeleitete Form „%s“ → %s (Wächter SU1, Befund 2)', (text, label) => {
    expect(checkSupplementText(text).map((hit) => hit.label)).toContain(label);
  });

  it.each([
    ['Nimm drei Gramm.', ['Einheit', 'Zahlwort']],
    ['ein Gramm Kreatin', ['Einheit']],
    ['zwei Tassen', ['Zahlwort']],
    ['etwa hundert Milligramm', ['Einheit', 'Zahlwort']],
    ['Mikrogramm', ['Einheit']],
    ['Angabe in IE', ['Einheit']],
    ['zwölf Wochen', ['Zahlwort']],
    ['Nimm {dose} mg', ['Einheit']],
  ])('Mengen-Wörter: „%s“ (Wächter SU1, Befund 5)', (text, labels) => {
    const hits = checkSupplementText(text).filter((hit) => hit.kind === 'number');
    expect(hits.map((hit) => hit.label)).toEqual(labels);
  });

  it('Mengen-Wörter: Artikel und Alltagswörter bleiben erlaubt', () => {
    for (const text of [
      'Eine Tasse Filterkaffee.',
      'Höchstens {cups} Tassen Kaffee auf einmal.',
      'Gilt für Erwachsene.',
      'Angaben stehen in der App.',
      'Achte auf deine Ernährung.',
      'Elfmeter und Achtung.',
    ]) {
      expect(checkSupplementText(text)).toEqual([]);
    }
  });

  it('Zahlen nur über Platzhalter, nur bekannte Platzhalter (Plan 3.8 Nr. 3)', () => {
    expect(checkSupplementText('Nimm 5 g am Tag.').map((hit) => hit.label)).toEqual([
      'Zahl im Freitext',
      'Einheit',
    ]);
    expect(checkSupplementText('Nimm {dose} am Tag.')).toEqual([]);
    expect(checkSupplementText('Nimm {menge} am Tag.').map((hit) => hit.kind)).toEqual([
      'unknown_placeholder',
    ]);
  });

  it('zerlegte Umlaute (NFD) werden erkannt', () => {
    expect(checkSupplementText('Natürlich.').map((hit) => hit.label)).toContain('natürlich');
  });
});

describe('Alle festen Texte des Moduls halten die Regeln ein', () => {
  it.each(SUPPLEMENT_NOTICE_KEYS)('Hinweis %s', (key) => {
    expect(checkSupplementText(SUPPLEMENT_NOTICE_TEXTS_DE[key])).toEqual([]);
    // Platzhalter sind alle gefüllt (persönliche Dosis als Beispiel).
    expect(renderSupplementNotice(key, { dose: '120 mg' })).not.toMatch(/[{}]/);
  });

  it('Fragen des Supplement-Checks und der Eiweiß-Selbsteinschätzung', () => {
    for (const question of SUPPLEMENT_SCREENING_QUESTIONS) {
      expect(checkSupplementText(question.textDe)).toEqual([]);
    }
    expect(checkSupplementText(PROTEIN_SELF_CHECK_QUESTION_DE)).toEqual([]);
  });

  it('Pflichtsätze: nur der vorgeschriebene Wortlaut „gesunde Lebensweise“ fällt auf', () => {
    const hits = SUPPLEMENT_MANDATORY_SENTENCES_DE.flatMap((sentence) =>
      checkSupplementText(sentence),
    );
    expect(hits.map((hit) => hit.label)).toEqual(['gesund']);
  });

  it('Angaben selbst enthalten keine Marken und keine Heil-Wörter', () => {
    for (const claim of APPROVED_CLAIMS) {
      const block = claimBlockText(claim.id);
      const hits = [
        ...checkSupplementText(block.claimDe),
        ...checkSupplementText(block.requiredInfoDe),
      ];
      expect(hits.filter((hit) => hit.kind === 'medical' || hit.kind === 'brand')).toEqual([]);
    }
  });

  it('Koffein-Texte: keine Stufe, kein Zweck, keine Wirkung (Plan 3.8 Nr. 5, B2.3)', () => {
    const caffeineTexts = SUPPLEMENT_NOTICE_KEYS.filter((key) => key.startsWith('caffeine_')).map(
      (key) => renderSupplementNotice(key, { dose: '200 mg' }),
    );
    expect(caffeineTexts.length).toBeGreaterThanOrEqual(8);
    for (const text of caffeineTexts) {
      expect(text).not.toMatch(
        /leistung|studienlage|stufe|passt zu dir|ausdauer|kraft|\benergie\b|fokus|wirk|fett|abnehm/i,
      );
    }
  });

  it('Gründe werden nie genannt (kein „Niere“, „Herz“, „Medikament“ in Sperr-Texten, Plan 3.3)', () => {
    for (const key of [
      'excluded_doctor',
      'excluded_reason',
      'caffeine_excluded',
      'adult_only',
    ] as const) {
      expect(renderSupplementNotice(key)).not.toMatch(/niere|herz|medikament|schwanger|still/i);
    }
  });
});
