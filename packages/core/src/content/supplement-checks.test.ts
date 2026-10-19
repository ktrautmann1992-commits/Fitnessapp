import { describe, expect, it } from 'vitest';

import { SUPPLEMENT_CONTENT_LIMITS, SUPPLEMENT_RULES } from '../constants';
import { SUPPLEMENT_IDS } from '../supplement-ids';
import { APPROVED_CLAIMS, type ApprovedClaim } from '../supplements/claims';
import { isBlockingIssue } from './rules';
import {
  CAFFEINE_PURPOSE_PATTERN,
  checkSupplementContent,
  claimConditionMet,
  claimRequiredInfo,
  coreDailyAmount,
  expectedEvidenceLevel,
  SUPPLEMENT_CONTENT_PLACEHOLDERS,
} from './supplement-checks';
import {
  NOT_RECOMMENDED_SUPPLEMENT_IDS,
  NOT_RECOMMENDED_SUPPLEMENTS,
  SUPPLEMENT_CONTENT_IDS,
  type SupplementContent,
  supplementContentSchema,
} from './supplement-schema';
import { validateContent } from './validate';

const META = {
  origin: 'claude_session',
  model: 'claude-opus-5-5',
  batch_id: null,
  created_on: '2026-10-19',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
} as const;

const SOURCE = {
  authors: 'Kreider RB, Kalman DS, Antonio J et al.',
  year: 2017,
  title:
    'International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine',
  journal: 'J Int Soc Sports Nutr 14:18',
  doi: '10.1186/s12970-017-0173-z',
  pmid: null,
};

function creatine(overrides: Partial<SupplementContent> = {}): SupplementContent {
  return {
    id: 'creatine',
    version: 1,
    status: 'draft',
    name_de: 'Kreatin-Monohydrat',
    evidence_level: 'a',
    category: 'sport',
    summary_de: 'Kreatin bildet dein Körper selbst. Es steckt auch in Fleisch und Fisch.',
    how_to_de: 'Rühre {dose} Kreatin-Monohydrat in ein Getränk oder in Joghurt.',
    claim_ids: ['creatine_performance'],
    sources: [SOURCE],
    not_recommended_reason_de: null,
    meta: META,
    ...overrides,
  };
}

function caffeine(overrides: Partial<SupplementContent> = {}): SupplementContent {
  return creatine({
    id: 'caffeine',
    name_de: 'Koffein',
    evidence_level: null,
    category: 'safety_info',
    summary_de: 'Koffein steckt in Kaffee, Tee, Cola und Energydrinks. Hier stehen nur Grenzen.',
    how_to_de: 'Höchstens {dose} auf einmal und höchstens {daily} am Tag.',
    claim_ids: [],
    sources: [],
    ...overrides,
  });
}

function bcaa(overrides: Partial<SupplementContent> = {}): SupplementContent {
  return creatine({
    id: 'bcaa',
    name_de: 'BCAA (verzweigtkettige Aminosäuren)',
    evidence_level: 'c',
    category: 'sport',
    summary_de: 'BCAA sind Aminosäuren, die in allen eiweißhaltigen Lebensmitteln stecken.',
    how_to_de: null,
    claim_ids: [],
    sources: [],
    not_recommended_reason_de: 'Für eine Empfehlung reicht die Studienlage nicht aus.',
    ...overrides,
  });
}

function rules(entry: SupplementContent, options?: Parameters<typeof checkSupplementContent>[1]) {
  return checkSupplementContent(entry, options).map((issue) => issue.rule);
}

function messages(entry: SupplementContent, rule: string) {
  return checkSupplementContent(entry)
    .filter((issue) => issue.rule === rule)
    .map((issue) => `${issue.path ?? ''}: ${issue.message}`);
}

describe('Supplement-Inhalte: Schema (SK1)', () => {
  it('gültige Einträge für eingeordnete Supplemente, Koffein und Stufe C', () => {
    for (const entry of [creatine(), caffeine(), bcaa()]) {
      expect(supplementContentSchema.safeParse(entry).success).toBe(true);
      expect(checkSupplementContent(entry)).toEqual([]);
    }
  });

  it('strikt: unbekanntes Feld, Dosis-Feld oder fehlendes Feld → Fehler', () => {
    expect(supplementContentSchema.safeParse({ ...creatine(), dose_g: 3 }).success).toBe(false);
    const withoutSummary: Record<string, unknown> = { ...creatine() };
    delete withoutSummary.summary_de;
    expect(supplementContentSchema.safeParse(withoutSummary).success).toBe(false);
    expect(
      supplementContentSchema.safeParse({ ...creatine(), sources: [{ ...SOURCE, url: 'x' }] })
        .success,
    ).toBe(false);
  });

  it('DOI und PMID im richtigen Format; Jahr plausibel', () => {
    const parse = (source: object) =>
      supplementContentSchema.safeParse(creatine({ sources: [{ ...SOURCE, ...source }] })).success;
    expect(parse({ doi: 'https://doi.org/10.1186/s12970-017-0173-z' })).toBe(false);
    expect(parse({ doi: '10.1186' })).toBe(false);
    expect(parse({ doi: null, pmid: '28615996' })).toBe(true);
    expect(parse({ pmid: 'PMID28615996' })).toBe(false);
    expect(parse({ pmid: '0123' })).toBe(false);
    expect(parse({ year: SUPPLEMENT_CONTENT_LIMITS.sourceYear.min - 1 })).toBe(false);
    expect(parse({ year: SUPPLEMENT_CONTENT_LIMITS.sourceYear.min })).toBe(true);
  });

  it('Stufe nur a/b/c/null, Kategorie nur aus der Aufzählung, keine doppelten Angaben', () => {
    expect(
      supplementContentSchema.safeParse(creatine({ evidence_level: 'A' as never })).success,
    ).toBe(false);
    expect(
      supplementContentSchema.safeParse(creatine({ category: 'boost' as never })).success,
    ).toBe(false);
    expect(
      supplementContentSchema.safeParse(
        creatine({ claim_ids: ['creatine_performance', 'creatine_performance'] }),
      ).success,
    ).toBe(false);
  });

  it('Textlänge: höchstens 1.000 Zeichen, kein Leerzeichen am Rand', () => {
    const exact = 'Satz '.repeat(200).trim() + '.';
    expect(exact.length).toBe(SUPPLEMENT_CONTENT_LIMITS.textMaxChars);
    expect(supplementContentSchema.safeParse(creatine({ summary_de: exact })).success).toBe(true);
    expect(supplementContentSchema.safeParse(creatine({ summary_de: `${exact}.` })).success).toBe(
      false,
    );
    expect(
      supplementContentSchema.safeParse(creatine({ summary_de: ' Kreatin bildet dein Körper.' }))
        .success,
    ).toBe(false);
  });

  it('freigegeben nur mit Prüfer', () => {
    expect(supplementContentSchema.safeParse(creatine({ status: 'published' })).success).toBe(
      false,
    );
    expect(
      supplementContentSchema.safeParse(
        creatine({
          status: 'published',
          meta: { ...META, reviewed_by: 'Karsten', reviewed_at: '2026-10-20' },
        }),
      ).success,
    ).toBe(true);
  });

  it('validateContent: Schemafehler heißt SK1 und blockiert auch bei Entwürfen', () => {
    const result = validateContent([
      { kind: 'supplement', fileName: 'creatine.json', data: { ...creatine(), dose_g: 3 } },
    ]);
    expect(result.supplements).toEqual([]);
    expect(result.blocking.map((issue) => issue.rule)).toEqual(['SK1']);
    expect(result.blocking[0]!.kind).toBe('supplement');
  });
});

describe('SK1 – unsichtbare und fremde Zeichen (Wächter SU2 M2)', () => {
  it.each([
    ['weiches Trennzeichen', 'Rühre {dose} in Wasser, das ver\u00ADbessert nichts.'],
    ['Nullbreiten-Leerzeichen', 'Rühre {dose} in Wasser, das ver\u200Bbessert nichts.'],
    ['Steuerzeichen', 'Rühre {dose} in\u0007 Wasser.'],
    ['Tabulator', 'Rühre {dose}\tin Wasser.'],
    ['kyrillisches о', 'Rühre {dose} in Wasser als Leistungsb\u043E\u043Est.'],
    ['griechisches μ', 'Rühre {dose} in Wasser, etwa \u03BCg.'],
  ])('%s → Schemafehler (SK1, blockiert immer)', (_label, howTo) => {
    expect(supplementContentSchema.safeParse(creatine({ how_to_de: howTo })).success).toBe(false);
    const result = validateContent([
      { kind: 'supplement', fileName: 'creatine.json', data: creatine({ how_to_de: howTo }) },
    ]);
    expect(result.blocking.map((issue) => issue.rule)).toEqual(['SK1']);
  });

  it('Umlaute, ß, Gedankenstrich, µ und Zeilenumbruch bleiben erlaubt', () => {
    expect(
      supplementContentSchema.safeParse(
        creatine({ summary_de: 'Größe, Maß – Übung und µ.\nZweite Zeile ohne Zahl.' }),
      ).success,
    ).toBe(true);
  });
});

describe('SK2 – ID bekannt, keine Doppelung, Kategorie', () => {
  it('alle IDs aus SUPPLEMENT_IDS und der Liste „Nicht empfohlen“ sind bekannt, ohne Überschneidung', () => {
    expect(SUPPLEMENT_CONTENT_IDS).toEqual([...SUPPLEMENT_IDS, ...NOT_RECOMMENDED_SUPPLEMENT_IDS]);
    expect(new Set(SUPPLEMENT_CONTENT_IDS).size).toBe(SUPPLEMENT_CONTENT_IDS.length);
    expect(NOT_RECOMMENDED_SUPPLEMENT_IDS.length).toBeGreaterThanOrEqual(10);
    // Natriumbicarbonat bewusst nicht in Stufe C (Präzisierung SU2).
    expect(NOT_RECOMMENDED_SUPPLEMENT_IDS).not.toContain('sodium_bicarbonate' as never);
  });

  it('unbekannte ID (auch Probelauf-ID) → SK2, sonst nichts Zusätzliches', () => {
    expect(rules(creatine({ id: 'beta_alanine' }))).toContain('SK2');
    expect(rules(bcaa({ id: 'probelauf-bcaa' }))).toEqual(['SK2']);
  });

  it('Kategorie muss zum Core passen (eingeordnet und Stufe C)', () => {
    expect(messages(creatine({ category: 'food' }), 'SK2')).toEqual([
      'category: Kategorie „food“ passt nicht zum Core („sport“).',
    ]);
    expect(rules(bcaa({ category: 'diet_season' }))).toEqual(['SK2']);
    expect(rules(bcaa({ id: 'iron', category: 'diet_season' }))).toEqual([]);
    for (const id of NOT_RECOMMENDED_SUPPLEMENT_IDS) {
      expect(NOT_RECOMMENDED_SUPPLEMENTS[id]).not.toBe('safety_info');
    }
  });

  it('doppelte ID in zwei Dateien → SK2 (und DATEI für den falschen Dateinamen)', () => {
    const result = validateContent([
      { kind: 'supplement', fileName: 'creatine.json', data: creatine() },
      { kind: 'supplement', fileName: 'kreatin.json', data: creatine() },
    ]);
    expect(result.supplements).toHaveLength(1);
    expect(result.issues.map((issue) => issue.rule).sort()).toEqual(['DATEI', 'SK2']);
  });
});

describe('SK3 – Textregeln 3.8 Nr. 2', () => {
  it.each([
    ['summary_de', 'Kreatin steigert die Kraft im Training.'],
    ['summary_de', 'Kreatin ist gesund für alle, die trainieren.'],
    ['summary_de', 'Kreatin wirkt bei allen Menschen gleich.'],
    ['summary_de', 'Kreatin ist wissenschaftlich belegt und sicher.'],
    ['summary_de', 'Kreatin ist ein Mittel gegen Muskelmangel im Alter.'],
    ['how_to_de', 'Rühre {dose} in ein Glas Red Bull.'],
    ['how_to_de', 'Rühre {dose} in Wasser, das heilt und ist sauber.'],
    ['name_de', 'Kreatin-Booster'],
    ['name_de', 'Testo-Kreatin'],
  ] as const)('%s: „%s“ → SK3', (field, value) => {
    expect(rules(creatine({ [field]: value }))).toContain('SK3');
  });

  it('auch im Grund bei Stufe C', () => {
    expect(
      rules(bcaa({ not_recommended_reason_de: 'Das schützt nicht vor Muskelkater.' })),
    ).toContain('SK3');
  });

  it('neutrale Texte und erlaubte Wörter (Medizinball, Stärke, Konzentrat) → kein SK3', () => {
    expect(
      rules(
        creatine({
          summary_de:
            'Kreatin bildet dein Körper selbst. Molkenprotein-Konzentrat und Stärke sind andere Dinge, ein Medizinball auch.',
        }),
      ),
    ).toEqual([]);
  });

  it('Quellen-Titel zählen nicht als Freitext (Zitate, englisch)', () => {
    expect(
      rules(creatine({ sources: [{ ...SOURCE, title: 'Creatine improves performance in 2017' }] })),
    ).toEqual([]);
  });
});

describe('SK5 – keine Zahlen im Freitext, nur erlaubte Platzhalter', () => {
  it.each([
    'Rühre 3 g in ein Getränk.',
    'Rühre drei Gramm in ein Getränk.',
    'Rühre etwas in ein Getränk, höchstens ein paar mg.',
    'Achte auf {menge} am Tag.',
  ])('„%s“ → SK5', (howTo) => {
    expect(rules(creatine({ how_to_de: howTo }))).toContain('SK5');
  });

  it('Platzhalter je Supplement: Kreatin {dose}/{gain}, nicht {daily}; Koffein {daily}/{cup}/{cups}/{time}', () => {
    expect(rules(creatine({ how_to_de: 'Rühre {dose} ein. Gewicht: plus {gain}.' }))).toEqual([]);
    expect(messages(creatine({ how_to_de: 'Höchstens {daily} am Tag.' }), 'SK5')).toEqual([
      'how_to_de: Platzhalter „{daily}“ füllt der Core für „creatine“ nicht (erlaubt: {dose}, {gain}).',
    ]);
    expect(
      rules(
        caffeine({ how_to_de: 'Höchstens {cups} Tassen, eine hat etwa {cup}, nur vor {time}.' }),
      ),
    ).toEqual([]);
    expect(SUPPLEMENT_CONTENT_PLACEHOLDERS.protein_powder).toEqual(['dose']);
  });

  it('Stufe C: keine Platzhalter (keine Dosis im Core)', () => {
    expect(
      messages(bcaa({ summary_de: 'BCAA sind Aminosäuren, meist {dose} je Portion.' }), 'SK5'),
    ).toEqual([
      'summary_de: Platzhalter „{dose}“ füllt der Core für „bcaa“ nicht (hier sind keine Platzhalter erlaubt).',
    ]);
  });

  it('Name: Ziffern erlaubt (Omega-3), Platzhalter nicht', () => {
    expect(
      rules(
        creatine({
          id: 'omega3',
          name_de: 'Omega-3 (EPA und DHA)',
          evidence_level: 'b',
          category: 'diet_season',
          claim_ids: ['epa_dha_heart'],
        }),
      ),
    ).toEqual([]);
    expect(rules(creatine({ name_de: 'Kreatin {dose}' }))).toEqual(['SK5']);
  });

  it('Name: Mengen und andere Ziffern rot, nur „-3“ wie in Omega-3 erlaubt (Wächter SU2 M3)', () => {
    expect(rules(creatine({ name_de: 'Kreatin 5000 mg täglich' }))).toEqual(['SK5', 'SK5']);
    expect(rules(creatine({ name_de: 'Kreatin dreihundert' }))).toEqual(['SK5']);
    expect(rules(creatine({ name_de: 'Kreatin-3g' }))).toEqual(['SK5']);
    expect(rules(creatine({ name_de: 'Vitamin D3' }))).toEqual(['SK5']);
    expect(rules(creatine({ name_de: 'Kreatin gegen Muskelkater' }))).toEqual(['SK3']);
    expect(rules(creatine({ name_de: 'Omega-3-Kreatin' }))).toEqual([]);
  });

  it('doppelte oder einzelne geschweifte Klammern → SK5 (Wächter SU2 N6)', () => {
    expect(messages(creatine({ how_to_de: 'Rühre {{dose}} in Wasser oder Saft.' }), 'SK5')).toEqual(
      [
        'how_to_de: Geschweifte Klammer außerhalb eines Platzhalters (z. B. „{{dose}}“) – nur „{name}“.',
      ],
    );
    expect(rules(creatine({ how_to_de: 'Rühre {dose in Wasser oder Saft.' }))).toContain('SK5');
    expect(rules(creatine({ how_to_de: 'Rühre {dose} in Wasser oder Saft.' }))).toEqual([]);
  });

  it('Ziffern in der Beschreibung sind auch bei Namen wie Omega-3 rot', () => {
    expect(
      rules(creatine({ summary_de: 'Kreatin ist kein Omega-3, sondern ein eigener Stoff.' })),
    ).toEqual(['SK5']);
  });
});

describe('SK4 – Angaben', () => {
  it('jede zugelassene Angabe passt zu ihrem Supplement, Bedingung erfüllt, Pflichthinweis vorhanden', () => {
    for (const claim of APPROVED_CLAIMS) {
      expect(claimConditionMet(claim)).toBe(true);
      expect(claimRequiredInfo(claim)).not.toBeNull();
    }
  });

  it('unbekannte Angabe, Kandidat und Angabe eines anderen Supplements → SK4', () => {
    expect(messages(creatine({ claim_ids: ['creatine_focus'] }), 'SK4')).toEqual([
      'claim_ids.0: Angabe „creatine_focus“ steht nicht in APPROVED_CLAIMS.',
    ]);
    expect(messages(creatine({ claim_ids: ['creatine_strength_55plus'] }), 'SK4')[0]).toContain(
      'nur ein Kandidat',
    );
    expect(messages(creatine({ claim_ids: ['epa_dha_heart'] }), 'SK4')).toEqual([
      'claim_ids.0: Angabe „epa_dha_heart“ gehört zu „omega3“, nicht zu „creatine“.',
    ]);
  });

  it('Bedingung: Kreatin genau 3 g erfüllt, 2,99 g nicht; Omega-3 249 mg nicht; Vitamin D unter 15 % NRV nicht', () => {
    const base = SUPPLEMENT_RULES;
    const creatineClaim = APPROVED_CLAIMS.find((c) => c.id === 'creatine_performance')!;
    const omegaClaim = APPROVED_CLAIMS.find((c) => c.id === 'epa_dha_heart')!;
    const vitaminDClaim = APPROVED_CLAIMS.find((c) => c.id === 'vitamin_d_bones')!;
    expect(claimConditionMet(creatineClaim, { ...base, creatine: { dailyG: 3 } })).toBe(true);
    expect(claimConditionMet(creatineClaim, { ...base, creatine: { dailyG: 2.99 } })).toBe(false);
    expect(
      claimConditionMet(omegaClaim, { ...base, omega3: { epaDhaMgPerDay: { min: 249 } } }),
    ).toBe(false);
    expect(claimConditionMet(vitaminDClaim, { ...base, vitaminD: { generalUg: 0.74 } })).toBe(
      false,
    );
    expect(claimConditionMet(vitaminDClaim, { ...base, vitaminD: { generalUg: 0.75 } })).toBe(true);
    expect(
      rules(creatine(), { rules: { ...base, creatine: { dailyG: 2 } } }).filter((r) => r === 'SK4'),
    ).toEqual(['SK4']);
  });

  it('Proteinpulver-Angabe hat keine Mindestmenge, Einheiten müssen passen', () => {
    const protein = APPROVED_CLAIMS.find((c) => c.id === 'protein_muscle_mass')!;
    expect(claimConditionMet(protein)).toBe(true);
    expect(coreDailyAmount('protein_powder')).toBeNull();
    const wrongUnit: ApprovedClaim = {
      ...APPROVED_CLAIMS.find((c) => c.id === 'creatine_performance')!,
      minDaily: { amount: 3, unit: 'mg' },
    };
    expect(claimConditionMet(wrongUnit)).toBe(false);
  });

  it('Angabe ohne Pflichthinweis → SK4 (rot)', () => {
    const claims: ApprovedClaim[] = APPROVED_CLAIMS.map((claim) =>
      claim.id === 'creatine_performance' ? { ...claim, requiredInfoDe: '  ' } : claim,
    );
    expect(messages(creatine(), 'SK4')).toEqual([]);
    expect(
      checkSupplementContent(creatine(), { claims })
        .filter((issue) => issue.rule === 'SK4')
        .map((issue) => issue.message),
    ).toEqual(['Angabe „creatine_performance“ ohne Pflichthinweis (requiredInfoDe).']);
    const unfilled: ApprovedClaim = {
      ...APPROVED_CLAIMS[0]!,
      requiredInfoDe: 'Gilt ab {menge}.',
    };
    expect(claimRequiredInfo(unfilled)).toBeNull();
  });
});

describe('SK6 – Quellen', () => {
  it('Stufe A und B brauchen mindestens eine Quelle; C und Koffein nicht', () => {
    expect(messages(creatine({ sources: [] }), 'SK6')).toEqual([
      'sources: Stufe A braucht mindestens eine Quelle.',
    ]);
    expect(
      rules(
        creatine({
          id: 'vitamin_d',
          name_de: 'Vitamin D',
          evidence_level: 'b',
          category: 'diet_season',
          claim_ids: ['vitamin_d_bones'],
          sources: [],
        }),
      ),
    ).toEqual(['SK6']);
    expect(rules(bcaa({ sources: [] }))).toEqual([]);
    expect(rules(caffeine({ sources: [] }))).toEqual([]);
  });

  it('jede Quelle mit DOI oder PMID (auch bei Stufe C); nur PMID reicht', () => {
    expect(rules(bcaa({ sources: [{ ...SOURCE, doi: null, pmid: null }] }))).toEqual(['SK6']);
    expect(rules(creatine({ sources: [{ ...SOURCE, doi: null, pmid: '28615996' }] }))).toEqual([]);
  });

  it('doppelte Quelle (DOI ohne Groß-/Kleinschreibung) → SK6', () => {
    expect(
      rules(creatine({ sources: [SOURCE, { ...SOURCE, doi: SOURCE.doi.toUpperCase() }] })),
    ).toEqual(['SK6']);
  });
});

describe('SK7 – Stufe, Koffein, Stufe C', () => {
  it('Stufe wie im Core', () => {
    expect(expectedEvidenceLevel('creatine')).toBe('a');
    expect(expectedEvidenceLevel('vitamin_d')).toBe('b');
    expect(expectedEvidenceLevel('caffeine')).toBeNull();
    expect(expectedEvidenceLevel('bcaa')).toBe('c');
    expect(expectedEvidenceLevel('unbekannt')).toBeUndefined();
    expect(messages(creatine({ evidence_level: 'b' }), 'SK7')).toEqual([
      'evidence_level: Stufe „b“ passt nicht zum Core („a“).',
    ]);
    expect(rules(creatine({ evidence_level: null }))).toContain('SK7');
  });

  it('Koffein: keine Stufe, keine Angaben, kein Zweck', () => {
    expect(messages(caffeine({ evidence_level: 'a' }), 'SK7')).toEqual([
      'evidence_level: Koffein bekommt keine Stufe – „evidence_level“ muss null sein.',
    ]);
    expect(rules(caffeine({ claim_ids: ['creatine_performance'] }))).toEqual(['SK7']);
    for (const text of [
      'Koffein für mehr Leistung im Training.',
      'Koffein vor dem Krafttraining.',
      'Koffein für mehr Ausdauer.',
      'Koffein mit guter Studienlage.',
      'Koffein für mehr Fokus.',
      // Wächter SU2 M5
      'Koffein gibt dir Power.',
      'Koffein gibt dir Schwung.',
      'Koffein gegen das Müdesein.',
      'Koffein macht munter.',
      'Koffein als Kick vor dem Lauf.',
      'Koffein als Push vor dem Lauf.',
      'Koffein hält dich wach.',
    ]) {
      expect(rules(caffeine({ summary_de: text })), text).toContain('SK7');
    }
    expect(CAFFEINE_PURPOSE_PATTERN.test('Kaffee, Tee, Cola und Energydrinks zählen mit.')).toBe(
      false,
    );
    expect(CAFFEINE_PURPOSE_PATTERN.test('Gilt für Erwachsene, auch beim Wachsen.')).toBe(false);
  });

  it('Stufe C: keine Angaben, keine Anwendung, Grund Pflicht', () => {
    expect(rules(bcaa({ claim_ids: ['creatine_performance'] }))).toEqual(['SK7']);
    expect(messages(bcaa({ how_to_de: 'Nimm es zu einer Mahlzeit.' }), 'SK7')).toEqual([
      'how_to_de: Stufe C: keine Anwendung („how_to_de“ muss null sein).',
    ]);
    expect(messages(bcaa({ not_recommended_reason_de: null }), 'SK7')).toEqual([
      'not_recommended_reason_de: Stufe C: Grund fehlt („not_recommended_reason_de“).',
    ]);
  });

  it('nicht Stufe C: Anwendung Pflicht, kein Grund', () => {
    expect(rules(creatine({ how_to_de: null }))).toEqual(['SK7']);
    expect(
      rules(creatine({ not_recommended_reason_de: 'Für eine Empfehlung reicht es nicht.' })),
    ).toEqual(['SK7']);
    expect(rules(caffeine({ how_to_de: null }))).toEqual(['SK7']);
  });

  it('eingeordnete ID mit Stufe C → SK7 (Stufe passt nicht), keine Angaben erlaubt', () => {
    expect(rules(creatine({ evidence_level: 'c', claim_ids: [] }))).toContain('SK7');
  });
});

describe('SK7H – lange Texte (gelb)', () => {
  it(`genau ${SUPPLEMENT_CONTENT_LIMITS.textWarnChars} Zeichen ok, eins mehr gelb`, () => {
    const exact = 'Satz '.repeat(SUPPLEMENT_CONTENT_LIMITS.textWarnChars / 5).trimEnd() + '.';
    expect(exact.length).toBe(SUPPLEMENT_CONTENT_LIMITS.textWarnChars);
    expect(rules(creatine({ summary_de: exact }))).toEqual([]);
    const issues = checkSupplementContent(creatine({ summary_de: `${exact}.` }));
    expect(issues.map((issue) => [issue.rule, issue.severity])).toEqual([['SK7H', 'warning']]);
  });
});

describe('Blockieren', () => {
  it('roter Befund blockiert nur bei freigegebenen Einträgen (SK1 immer)', () => {
    const draft = validateContent([
      {
        kind: 'supplement',
        fileName: 'creatine.json',
        data: creatine({ summary_de: 'Kreatin steigert die Kraft.' }),
      },
    ]);
    expect(draft.issues.map((issue) => issue.rule)).toEqual(['SK3']);
    expect(draft.blocking).toEqual([]);
    const published = validateContent([
      {
        kind: 'supplement',
        fileName: 'creatine.json',
        data: creatine({
          status: 'published',
          summary_de: 'Kreatin steigert die Kraft.',
          meta: { ...META, reviewed_by: 'Karsten', reviewed_at: '2026-10-20' },
        }),
      },
    ]);
    expect(published.blocking.map((issue) => issue.rule)).toEqual(['SK3']);
    expect(published.blocking.every(isBlockingIssue)).toBe(true);
  });

  it('Probelauf-Eintrag darf nie freigegeben werden (PROBELAUF)', () => {
    const result = validateContent([
      {
        kind: 'supplement',
        fileName: 'probelauf-bcaa.json',
        data: bcaa({
          id: 'probelauf-bcaa',
          status: 'published',
          meta: {
            ...META,
            origin: 'batch',
            model: 'probelauf-ohne-ki',
            batch_id: 'probelauf_x',
            reviewed_by: 'Karsten',
            reviewed_at: '2026-10-20',
          },
        }),
      },
    ]);
    expect(result.blocking.map((issue) => issue.rule).sort()).toEqual(['PROBELAUF', 'SK2']);
  });

  it('Versionsregel gilt auch für Supplemente', () => {
    const published = creatine({
      status: 'published',
      meta: { ...META, reviewed_by: 'Karsten', reviewed_at: '2026-10-20' },
    });
    const result = validateContent([
      {
        kind: 'supplement',
        fileName: 'creatine.json',
        data: { ...published, summary_de: 'Kreatin bildet dein Körper selbst, auch beim Sport.' },
        previous: published,
      },
    ]);
    expect(result.blocking.map((issue) => issue.rule)).toEqual(['VERSION']);
  });
});
