/**
 * Startbestand der Supplement-Inhalte (content/supplements, docs/PLAN-PHASE-6.md Abschnitt 6, Etappe SU2): fünf
 * Einträge der Startliste und die Liste „Nicht empfohlen“, alle als KI-Entwurf aus einer Claude-Sitzung, KEINE Befunde
 * (auch keine gelben) – strenger als content:validate, das rote Fehler an Entwürfen nur meldet.
 */
import { join } from 'node:path';

import {
  APPROVED_CLAIMS,
  checkSupplementText,
  DOI_PATTERN,
  NOT_RECOMMENDED_SUPPLEMENT_IDS,
  SUPPLEMENT_IDS,
  validateContent,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { SUPPLEMENT_LABELS_DE } from './pipeline/kinds/supplement';
import { loadSupplementContentFiles } from './validate';

const contentDir = join(import.meta.dirname, '..', '..', '..', 'content');
const { files, strayFiles } = loadSupplementContentFiles(contentDir);
const result = validateContent(files);
const byId = new Map(result.supplements.map((entry) => [entry.id, entry]));

describe('Startbestand Supplemente (content/supplements)', () => {
  it('fünf Einträge der Startliste und die Liste „Nicht empfohlen“, alle mit gültigem Schema', () => {
    expect(strayFiles).toEqual([]);
    expect(result.supplements).toHaveLength(files.length);
    expect([...byId.keys()].sort()).toEqual(
      [...SUPPLEMENT_IDS, ...NOT_RECOMMENDED_SUPPLEMENT_IDS].sort(),
    );
    expect(NOT_RECOMMENDED_SUPPLEMENT_IDS.length).toBeGreaterThanOrEqual(12);
  });

  it('Namen der Pipeline (Anfrage-Text) = Namen im Startbestand (Wächter SU2 N3)', () => {
    for (const entry of result.supplements) {
      expect(SUPPLEMENT_LABELS_DE[entry.id], entry.id).toBe(entry.name_de);
    }
  });

  it('keine Befunde (weder rot noch gelb)', () => {
    expect(result.issues.map((issue) => `${issue.rule} ${issue.id}: ${issue.message}`)).toEqual([]);
  });

  it('alle als Entwurf aus der Claude-Sitzung, nicht fachlich geprüft, ohne Prüfvermerk', () => {
    for (const entry of result.supplements) {
      expect(entry.status, entry.id).toBe('draft');
      expect(entry.version, entry.id).toBe(1);
      expect(entry.meta).toMatchObject({
        origin: 'claude_session',
        expert_reviewed: false,
        reviewed_by: null,
        reviewed_at: null,
        batch_id: null,
      });
    }
  });

  it('Startliste: Stufen, Angaben und Kategorien wie im Plan (3.2, 3.8)', () => {
    expect(byId.get('creatine')).toMatchObject({
      evidence_level: 'a',
      category: 'sport',
      claim_ids: ['creatine_performance'],
    });
    expect(byId.get('protein_powder')).toMatchObject({
      evidence_level: 'a',
      category: 'food',
      claim_ids: ['protein_muscle_mass'],
    });
    expect(byId.get('vitamin_d')).toMatchObject({
      evidence_level: 'b',
      category: 'diet_season',
      claim_ids: ['vitamin_d_bones', 'vitamin_d_muscle'],
    });
    expect(byId.get('omega3')).toMatchObject({
      evidence_level: 'b',
      category: 'diet_season',
      claim_ids: ['epa_dha_heart'],
    });
    expect(byId.get('caffeine')).toMatchObject({
      evidence_level: null,
      category: 'safety_info',
      claim_ids: [],
    });
    // Jede zugelassene Angabe kommt genau einmal vor.
    const used = result.supplements.flatMap((entry) => entry.claim_ids).sort();
    expect(used).toEqual(APPROVED_CLAIMS.map((claim) => claim.id).sort());
  });

  it('Stufe A/B mit Quellen (DOI), keine Dosis-Zahl im Freitext', () => {
    for (const entry of result.supplements) {
      if (entry.evidence_level === 'a' || entry.evidence_level === 'b') {
        expect(entry.sources.length, entry.id).toBeGreaterThanOrEqual(2);
      }
      for (const source of entry.sources) {
        expect(source.doi ?? '', `${entry.id}: ${source.title}`).toMatch(DOI_PATTERN);
      }
      for (const text of [entry.summary_de, entry.how_to_de, entry.not_recommended_reason_de]) {
        if (text === null) continue;
        expect(checkSupplementText(text), `${entry.id}: ${text}`).toEqual([]);
      }
    }
  });

  it('Stufe C: Grund statt Anwendung, keine Angaben, keine Platzhalter', () => {
    for (const id of NOT_RECOMMENDED_SUPPLEMENT_IDS) {
      const entry = byId.get(id)!;
      expect(entry.evidence_level, id).toBe('c');
      expect(entry.how_to_de, id).toBeNull();
      expect(entry.not_recommended_reason_de, id).not.toBeNull();
      expect(entry.claim_ids, id).toEqual([]);
      expect(`${entry.summary_de} ${entry.not_recommended_reason_de}`, id).not.toContain('{');
    }
  });
});
