import { describe, expect, it } from 'vitest';

import {
  planSupplementRelease,
  releasedSupplement,
  supplementReleaseBlockerText,
} from './supplement-release';
import type { SupplementContent } from './supplement-schema';
import type { SupplementContentFile } from './validate';

function entry(id: string, overrides: Partial<SupplementContent> = {}): SupplementContent {
  return {
    id,
    version: 1,
    status: 'draft',
    name_de: 'BCAA (verzweigtkettige Aminosäuren)',
    evidence_level: 'c',
    category: 'sport',
    summary_de:
      'BCAA ist die Abkürzung für die Aminosäuren Leucin, Isoleucin und Valin. Sie stecken in eiweißhaltigen Lebensmitteln.',
    how_to_de: null,
    claim_ids: [],
    sources: [
      {
        authors: 'Wolfe RR',
        year: 2017,
        title:
          'Branched-chain amino acids and muscle protein synthesis in humans: myth or reality?',
        journal: 'J Int Soc Sports Nutr 14:30',
        doi: '10.1186/s12970-017-0184-9',
        pmid: null,
      },
    ],
    not_recommended_reason_de:
      'Für zusätzliche BCAA reicht die Studienlage für eine Empfehlung nicht aus.',
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-19',
      expert_reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    },
    ...overrides,
  } as SupplementContent;
}

const file = (data: unknown): SupplementContentFile => ({
  kind: 'supplement',
  fileName: `${(data as { id: string }).id}.json`,
  data,
});

const OPTIONS = { reviewer: 'Karsten', date: '2026-10-21', expertReviewed: false };

describe('planSupplementRelease (content-review, Art „ids“)', () => {
  it('Entwurf ohne roten Befund → published mit Prüfer und Datum, Version bleibt', () => {
    const plan = planSupplementRelease([file(entry('bcaa'))], ['bcaa'], OPTIONS);
    expect(plan.unknownIds).toEqual([]);
    expect(plan.decisions).toHaveLength(1);
    const decision = plan.decisions[0]!;
    expect(decision.blockers).toEqual([]);
    expect(decision.released).toMatchObject({
      status: 'published',
      version: 1,
      meta: { reviewed_by: 'Karsten', reviewed_at: '2026-10-21', expert_reviewed: false },
    });
    expect(decision.original.status).toBe('draft');
  });

  it('Häkchen „fachlich geprüft“ setzt expert_reviewed; ein gesetztes true bleibt', () => {
    expect(
      releasedSupplement(entry('bcaa'), { ...OPTIONS, expertReviewed: true }).meta.expert_reviewed,
    ).toBe(true);
    expect(
      releasedSupplement(
        entry('bcaa', { meta: { ...entry('bcaa').meta, expert_reviewed: true } }),
        OPTIONS,
      ).meta.expert_reviewed,
    ).toBe(true);
  });

  it('roter Befund im Stand danach (verbotenes Wort) → übersprungen mit Grund', () => {
    const bad = entry('bcaa', {
      summary_de: 'BCAA steigert die Kraft deutlich und schnell im Training.',
    });
    const plan = planSupplementRelease([file(bad)], ['bcaa'], OPTIONS);
    const blocker = plan.decisions[0]?.blockers[0];
    expect(blocker?.kind).toBe('red_issues');
    expect(supplementReleaseBlockerText(blocker!)).toContain('SK3');
  });

  it('schon freigegeben → „schon freigegeben“; unbekannte ID und doppelte Eingabe', () => {
    const published = entry('bcaa', {
      status: 'published',
      meta: { ...entry('bcaa').meta, reviewed_by: 'X', reviewed_at: '2026-10-20' },
    });
    const plan = planSupplementRelease([file(published)], ['bcaa', 'bcaa', 'gibtsnicht'], OPTIONS);
    expect(plan.decisions).toHaveLength(1);
    expect(supplementReleaseBlockerText(plan.decisions[0]!.blockers[0]!)).toBe('schon freigegeben');
    expect(plan.unknownIds).toEqual(['gibtsnicht']);
  });

  it('Probelauf-ID (SK2 rot) wird nie freigegeben', () => {
    const plan = planSupplementRelease(
      [file(entry('probelauf-bcaa'))],
      ['probelauf-bcaa'],
      OPTIONS,
    );
    expect(plan.decisions[0]?.blockers[0]?.kind).toBe('red_issues');
  });
});
