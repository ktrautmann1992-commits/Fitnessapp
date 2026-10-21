import { describe, expect, it } from 'vitest';

import type { SupplementContent } from '../content/supplement-schema';
import { checkSupplementText } from './text-rules';
import { recommendSupplements } from './eligibility';
import { supplementDetail, supplementOverview } from './overview';
import { supplementTestInputs, withoutConsent } from './test-helpers';
import {
  activeSupplementChoices,
  canChooseSupplement,
  isSupplementScreeningCurrent,
  outdatedSupplementChoices,
  storedSupplementScreeningSchema,
  type SupplementUserData,
  userSupplementChoiceSchema,
} from './user-data';

function entry(id: string, overrides: Partial<SupplementContent> = {}): SupplementContent {
  return {
    id,
    version: 1,
    status: 'published',
    name_de: `Name ${id}`,
    evidence_level: 'a',
    category: 'sport',
    summary_de: `Kurzbeschreibung ${id}.`,
    how_to_de: 'Nimm {dose} am Tag.',
    claim_ids: [],
    sources: [],
    not_recommended_reason_de: null,
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-19',
      expert_reviewed: false,
      reviewed_by: 'redaktion',
      reviewed_at: '2026-10-21',
      review_note: null,
    },
    ...overrides,
  } as SupplementContent;
}

const CONTENTS: SupplementContent[] = [
  entry('creatine', { claim_ids: ['creatine_performance'] }),
  entry('protein_powder', { category: 'food', how_to_de: 'Eine Portion mit {dose} Eiweiß.' }),
  entry('vitamin_d', {
    evidence_level: 'b',
    category: 'diet_season',
    claim_ids: ['vitamin_d_bones'],
  }),
  entry('omega3', { evidence_level: 'b', category: 'diet_season', claim_ids: ['epa_dha_heart'] }),
  entry('caffeine', {
    evidence_level: null,
    category: 'safety_info',
    how_to_de: 'Prüfe die Packung.',
  }),
  entry('melatonin', {
    name_de: 'Melatonin',
    evidence_level: 'c',
    how_to_de: null,
    not_recommended_reason_de: 'Studienlage reicht nicht.',
  }),
  entry('bcaa', {
    name_de: 'BCAA',
    evidence_level: 'c',
    how_to_de: null,
    not_recommended_reason_de: 'Studienlage reicht nicht.',
  }),
];

const NONE: SupplementUserData = { screening: null, choices: [] };

describe('supplementOverview (Plan 8.1)', () => {
  it('Grund-Person: Kreatin passt (mit Menge), Vitamin D Info mit Richtwert, Koffein nie „passt“', () => {
    const overview = supplementOverview(recommendSupplements(supplementTestInputs()), CONTENTS);
    expect(overview.personalized).toBe(true);
    expect(overview.groups.recommended.map((c) => c.id)).toEqual(['creatine']);
    expect(overview.groups.recommended[0]).toMatchObject({
      doseText: '3 g',
      doseGeneral: false,
      timing: 'daily_with_meal',
      evidence: 'a',
      expertReviewed: false,
    });
    expect(overview.groups.info.map((c) => c.id)).toEqual([
      'protein_powder',
      'vitamin_d',
      'omega3',
    ]);
    const vitaminD = overview.groups.info.find((c) => c.id === 'vitamin_d');
    expect(vitaminD).toMatchObject({ doseText: '20 µg (800 IE)', doseGeneral: true });
    expect(overview.groups.info.find((c) => c.id === 'omega3')?.doseText).toBeNull();
    expect(overview.caffeine).toMatchObject({ status: 'safety_info', mode: 'personal' });
    expect(overview.empty).toBe(false);
  });

  it('„Nicht empfohlen“ alphabetisch mit Grund, nur Stufe C', () => {
    const overview = supplementOverview(recommendSupplements(supplementTestInputs()), CONTENTS);
    expect(overview.notRecommended.map((c) => c.nameDe)).toEqual(['BCAA', 'Melatonin']);
    expect(overview.notRecommended[0]?.reasonDe).toBe('Studienlage reicht nicht.');
  });

  it('Schwangerschaft: alles „Nicht für dich“, keine Menge, Seiten-Hinweis Hebamme', () => {
    const overview = supplementOverview(
      recommendSupplements(
        supplementTestInputs({ healthFlags: ['pregnancy', 'conservative_plan'] }),
      ),
      CONTENTS,
    );
    expect(overview.groups.excluded.map((c) => c.id)).toEqual([
      'creatine',
      'protein_powder',
      'vitamin_d',
      'omega3',
    ]);
    expect(overview.groups.excluded.every((c) => c.doseText === null && c.timing === null)).toBe(
      true,
    );
    expect(overview.caffeine?.mode).toBe('pregnancy');
    expect(overview.pageNotices.join(' ')).toContain('Hebamme');
  });

  it('unter 18: Kreatin „ab 18“ ohne Menge', () => {
    const overview = supplementOverview(
      recommendSupplements(supplementTestInputs({ birthDate: '2009-03-01' })),
      CONTENTS,
    );
    expect(overview.groups.adult_only.map((c) => c.id)).toEqual(['creatine']);
    expect(overview.groups.adult_only[0]?.doseText).toBeNull();
    expect(overview.caffeine?.status).toBe('safety_info_adult_only');
  });

  it('ohne Einwilligung: nur Info, keine Auswahl sichtbar', () => {
    const overview = supplementOverview(recommendSupplements(withoutConsent()), CONTENTS, {
      screening: null,
      choices: [{ supplementId: 'creatine', status: 'taking' }],
    });
    expect(overview.personalized).toBe(false);
    expect(overview.groups.recommended).toEqual([]);
    expect(overview.groups.info.every((c) => c.choice === null)).toBe(true);
    expect(overview.taking).toEqual([]);
    expect(overview.caffeine?.mode).toBe('general');
  });

  it('ohne Inhalte: leer („Kommt bald“); fehlende Einträge werden ausgelassen', () => {
    const result = recommendSupplements(supplementTestInputs());
    expect(supplementOverview(result, []).empty).toBe(true);
    const onlyCreatine = supplementOverview(result, [CONTENTS[0] as SupplementContent]);
    expect(onlyCreatine.empty).toBe(false);
    expect(onlyCreatine.caffeine).toBeNull();
    expect(onlyCreatine.groups.info).toEqual([]);
  });

  it('„Nehme ich“: aktiv bzw. veraltet, wenn ein Sperr-Flag dazukommt', () => {
    const data: SupplementUserData = {
      screening: null,
      choices: [
        { supplementId: 'creatine', status: 'taking' },
        { supplementId: 'omega3', status: 'not_for_me' },
      ],
    };
    const ok = supplementOverview(recommendSupplements(supplementTestInputs()), CONTENTS, data);
    expect(ok.taking).toEqual(['creatine']);
    expect(ok.groups.recommended[0]?.choice).toBe('taking');
    expect(ok.groups.info.find((c) => c.id === 'omega3')?.choice).toBe('not_for_me');
    const blocked = supplementOverview(
      recommendSupplements(supplementTestInputs({ supplementFlags: ['kidney'] })),
      CONTENTS,
      data,
    );
    expect(blocked.taking).toEqual([]);
    expect(blocked.takingOutdated).toEqual(['creatine']);
  });
});

describe('supplementDetail (Plan 8.1)', () => {
  const result = recommendSupplements(supplementTestInputs());

  it('Kreatin „passt“: Menge, Zeitpunkt, Anwendung gefüllt, Angabe MIT Pflichthinweis, Pflichtsätze', () => {
    const detail = supplementDetail('creatine', result, CONTENTS, NONE, 70);
    expect(detail).toMatchObject({
      kind: 'rated',
      status: 'recommended',
      doseText: '3 g',
      timing: 'daily_with_meal',
      howToDe: 'Nimm 3 g am Tag.',
      canChoose: true,
      canDecline: true,
    });
    expect(detail?.claims).toHaveLength(1);
    expect(detail?.claims[0]?.requiredInfoDe).toContain('3 g');
    expect(detail?.mandatory).toHaveLength(2);
    expect(detail?.notices.join(' ')).toContain('1–2 kg');
  });

  it('Info ohne Menge: keine Anwendung (sie enthält {dose}), „Nehme ich“ nicht möglich', () => {
    const detail = supplementDetail('omega3', result, CONTENTS, NONE, 70);
    expect(detail).toMatchObject({
      status: 'info_only',
      doseText: null,
      howToDe: null,
      canChoose: false,
    });
  });

  it('Omega-3 mit Herz-Flag: keine Herz-Angabe (S6)', () => {
    const vegan = supplementTestInputs({ dietType: 'vegan' });
    expect(
      supplementDetail('omega3', recommendSupplements(vegan), CONTENTS, NONE, 70)?.claims,
    ).toHaveLength(1);
    const heart = recommendSupplements({ ...vegan, supplementFlags: ['heart_rhythm'] });
    expect(supplementDetail('omega3', heart, CONTENTS, NONE, 70)?.claims).toEqual([]);
  });

  it('Vitamin D Info: Richtwert und Anwendung, „Nehme ich“ möglich (persönlich)', () => {
    const detail = supplementDetail('vitamin_d', result, CONTENTS, NONE, 70);
    expect(detail).toMatchObject({
      doseText: '20 µg (800 IE)',
      doseGeneral: true,
      howToDe: 'Nimm 20 µg (800 IE) am Tag.',
      canChoose: true,
    });
  });

  it('„Nicht für dich“: keine Menge, keine Angabe, fester Satz ohne Grund', () => {
    const blocked = recommendSupplements(supplementTestInputs({ supplementFlags: ['kidney'] }));
    const detail = supplementDetail('creatine', blocked, CONTENTS, NONE, 70);
    expect(detail).toMatchObject({ status: 'excluded', doseText: null, howToDe: null, claims: [] });
    expect(detail?.notices).toContain(
      'Bei deinen Angaben empfehlen wir das nicht ohne ärztliche Rücksprache.',
    );
    expect(detail?.notices.join(' ')).not.toMatch(/niere/i);
  });

  it('Koffein: persönliche Grenzen mit Gewicht, nie wählbar; abends kein Koffein vor dem Training', () => {
    const detail = supplementDetail('caffeine', result, CONTENTS, NONE, 70);
    expect(detail).toMatchObject({ kind: 'caffeine', evidence: null, canChoose: false });
    expect(detail?.notices).toContain('Höchstens 200 mg Koffein auf einmal.');
    expect(detail?.notices.join(' ')).toContain('390 mg am Tag');
    const evening = recommendSupplements(supplementTestInputs({ trainingTime: 'evening' }));
    expect(supplementDetail('caffeine', evening, CONTENTS, NONE, 70)?.notices).toContain(
      'Du trainierst abends: Nimm vor dem Training kein Koffein.',
    );
    const excluded = recommendSupplements(
      supplementTestInputs({ supplementFlags: ['caffeine_sensitive'] }),
    );
    expect(supplementDetail('caffeine', excluded, CONTENTS, NONE, 70)).toMatchObject({
      howToDe: null,
      notices: ['Bei deinen Angaben: Koffein vorher ärztlich abklären.'],
    });
  });

  it('Stufe C: Grund, keine Menge, keine Auswahl; unbekannte ID → null', () => {
    expect(supplementDetail('melatonin', result, CONTENTS, NONE, 70)).toMatchObject({
      kind: 'not_recommended',
      reasonDe: 'Studienlage reicht nicht.',
      doseText: null,
      canDecline: false,
    });
    expect(supplementDetail('gibtsnicht', result, CONTENTS, NONE, 70)).toBeNull();
  });

  it('veraltete Auswahl wird gemeldet', () => {
    const blocked = recommendSupplements(
      supplementTestInputs({ healthFlags: ['medication', 'conservative_plan'] }),
    );
    const detail = supplementDetail(
      'creatine',
      blocked,
      CONTENTS,
      {
        screening: null,
        choices: [{ supplementId: 'creatine', status: 'taking' }],
      },
      70,
    );
    expect(detail).toMatchObject({ choice: 'taking', choiceOutdated: true, canChoose: false });
  });

  it('alle erzeugten Sätze bestehen die Textregeln (keine Heilversprechen)', () => {
    for (const inputs of [
      supplementTestInputs(),
      supplementTestInputs({ supplementFlags: ['heart_rhythm'], trainingTime: 'afternoon' }),
      supplementTestInputs({ healthFlags: ['pregnancy', 'conservative_plan'] }),
      withoutConsent(),
    ]) {
      const recs = recommendSupplements(inputs);
      const texts = [
        ...supplementOverview(recs, CONTENTS).pageNotices,
        ...['creatine', 'protein_powder', 'vitamin_d', 'omega3', 'caffeine'].flatMap(
          (id) => supplementDetail(id, recs, CONTENTS, NONE, 70)?.notices ?? [],
        ),
      ];
      for (const text of texts) {
        // Zahlen kommen hier bewusst aus dem Core (Platzhalter gefüllt) – geprüft werden die Wörter.
        expect(
          checkSupplementText(text).filter((hit) => hit.kind !== 'number'),
          text,
        ).toEqual([]);
      }
    }
  });
});

describe('user-data', () => {
  it('Schemas: Koffein nie wählbar, Check strikt', () => {
    expect(
      userSupplementChoiceSchema.safeParse({ supplementId: 'caffeine', status: 'taking' }).success,
    ).toBe(false);
    expect(
      userSupplementChoiceSchema.safeParse({ supplementId: 'creatine', status: 'taking' }).success,
    ).toBe(true);
    expect(
      storedSupplementScreeningSchema.safeParse({
        answers: { kidney: false, heart_rhythm: false, caffeine_sensitive: false },
        flags: ['kidney', 'kidney'],
        version: 1,
        updatedAt: 'x',
      }).success,
    ).toBe(false);
  });

  it('isSupplementScreeningCurrent: nur aktuelle Fassung der Fragen', () => {
    const base = {
      answers: { kidney: false, heart_rhythm: false, caffeine_sensitive: false },
      flags: [],
      updatedAt: 'x',
    };
    expect(isSupplementScreeningCurrent(null)).toBe(false);
    expect(isSupplementScreeningCurrent({ ...base, version: 1 })).toBe(true);
    expect(isSupplementScreeningCurrent({ ...base, version: 2 })).toBe(false);
  });

  it('canChooseSupplement / aktive und veraltete Auswahl', () => {
    const recs = recommendSupplements(supplementTestInputs());
    const byId = (id: string) => recs.items.find((item) => item.id === id)!;
    expect(canChooseSupplement(recs, byId('creatine'))).toBe(true);
    expect(canChooseSupplement(recs, byId('vitamin_d'))).toBe(true);
    expect(canChooseSupplement(recs, byId('omega3'))).toBe(false);
    const choices = [
      { supplementId: 'omega3', status: 'taking' },
      { supplementId: 'creatine', status: 'taking' },
    ] as const;
    expect(activeSupplementChoices(recs, choices)).toEqual(['creatine']);
    expect(outdatedSupplementChoices(recs, choices)).toEqual(['omega3']);
    const info = recommendSupplements(withoutConsent());
    expect(canChooseSupplement(info, info.items[2]!)).toBe(false);
  });
});
