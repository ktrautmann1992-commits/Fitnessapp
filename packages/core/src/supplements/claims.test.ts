import { describe, expect, it } from 'vitest';

import { SUPPLEMENT_RULES } from '../constants';
import { RATED_SUPPLEMENT_IDS } from '../supplement-ids';
import { APPROVED_CLAIMS, CANDIDATE_CLAIMS, claimBlockText, type ApprovedClaimId } from './claims';
import { recommendSupplements } from './eligibility';
import { checkSupplementText } from './text-rules';
import { supplementTestInputs as base } from './test-helpers';

describe('Zugelassene Angaben (Plan 3.8 Nr. 1, Wächter B2)', () => {
  it('eindeutige IDs, nur bekannte Supplemente, nie Koffein', () => {
    const ids = APPROVED_CLAIMS.map((claim) => claim.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const claim of APPROVED_CLAIMS) {
      expect(RATED_SUPPLEMENT_IDS).toContain(claim.supplementId);
      expect(claim.supplementId).not.toBe('caffeine');
    }
  });

  it('jede Angabe hat einen Pflichthinweis; ClaimBlock liefert Angabe und Hinweis immer zusammen', () => {
    for (const claim of APPROVED_CLAIMS) {
      expect(claim.requiredInfoDe.trim().length).toBeGreaterThan(20);
      const block = claimBlockText(claim.id);
      expect(block.claimDe).toBe(claim.textDe);
      expect(block.requiredInfoDe).not.toMatch(/[{}]/);
    }
    expect(claimBlockText('creatine_performance').requiredInfoDe).toBe(
      'Die positive Wirkung stellt sich bei einer täglichen Aufnahme von 3 g Kreatin ein. Gilt für Erwachsene, die intensive körperliche Betätigung ausüben.',
    );
    expect(claimBlockText('epa_dha_heart').requiredInfoDe).toContain('von 250 mg EPA und DHA');
  });

  it('Pflichthinweis mit {dose} nur, wenn die Angabe eine Mindestmenge hat', () => {
    for (const claim of APPROVED_CLAIMS) {
      if (claim.requiredInfoDe.includes('{dose}')) expect(claim.minDaily).not.toBeNull();
    }
  });

  it('Bedingung passt zur Dosis aus dem Core', () => {
    const creatine = APPROVED_CLAIMS.find((claim) => claim.id === 'creatine_performance')!;
    expect(SUPPLEMENT_RULES.creatine.dailyG).toBeGreaterThanOrEqual(creatine.minDaily!.amount);
    const omega3 = APPROVED_CLAIMS.find((claim) => claim.id === 'epa_dha_heart')!;
    expect(SUPPLEMENT_RULES.omega3.epaDhaMgPerDay.min).toBeGreaterThanOrEqual(
      omega3.minDaily!.amount,
    );
    for (const id of ['vitamin_d_bones', 'vitamin_d_muscle'] as const) {
      const claim = APPROVED_CLAIMS.find((entry) => entry.id === id)!;
      expect(claim.minDaily!.amount).toBeCloseTo(0.75);
      expect(SUPPLEMENT_RULES.vitaminD.generalUg).toBeGreaterThanOrEqual(claim.minDaily!.amount);
    }
  });

  it('Kandidat Kreatin ab 55 wird nie angezeigt (K1, SU-G18)', () => {
    expect(CANDIDATE_CLAIMS.map((claim) => claim.id)).toEqual(['creatine_strength_55plus']);
    expect(APPROVED_CLAIMS.map((claim) => claim.id)).not.toContain('creatine_strength_55plus');
    const senior = recommendSupplements(base({ birthDate: '1960-01-01' }));
    for (const item of senior.items) {
      expect(item.claimIds as readonly string[]).not.toContain('creatine_strength_55plus');
    }
  });

  it('keine gestrichene Elektrolyt-Angabe (B2.2)', () => {
    expect(APPROVED_CLAIMS.map((claim) => claim.textDe).join(' ')).not.toMatch(/elektrolyt/i);
  });

  it('die Engine nennt nur bekannte Angaben', () => {
    const known = new Set<ApprovedClaimId>(APPROVED_CLAIMS.map((claim) => claim.id));
    const result = recommendSupplements(base({ dietType: 'vegan', proteinGap: true }));
    for (const item of result.items)
      for (const id of item.claimIds) expect(known.has(id)).toBe(true);
  });

  it('Angaben haben einen eigenen Prüfweg: die Freitext-Regeln würden sie melden (z. B. „Wirkung“)', () => {
    expect(
      checkSupplementText(claimBlockText('creatine_performance').requiredInfoDe).map(
        (hit) => hit.label,
      ),
    ).toContain('Wirkung');
  });
});
