import { describe, expect, it } from 'vitest';

import { demoNutritionContent, demoNutritionContentAsTestphase } from '../demo-nutrition';
import { guideForDisplay } from '../nutrition/guides';
import { selectNutritionContent } from './nutrition-select';
import {
  CONTENT_SEED_SETTINGS_FILE,
  contentReviewMark,
  isPublishedWithoutExpertReview,
  parseContentSeedSettings,
  STRICT_CONTENT_SEED_SETTINGS,
} from './seed-settings';
import { META } from './test-fixtures';
import { validateContent } from './validate';

const MANUAL = { ...META, origin: 'manual', model: null } as const;

describe('parseContentSeedSettings (Einspiel-Regel, Testphase 19.10.2026)', () => {
  it('Datei fehlt → Livegang-Regel (nur fachlich geprüft), kein Fehler', () => {
    expect(parseContentSeedSettings(undefined)).toEqual({
      settings: { nur_fachlich_geprueft: true },
      problems: [],
    });
    expect(STRICT_CONTENT_SEED_SETTINGS.nur_fachlich_geprueft).toBe(true);
  });

  it('Testphase und Livegang werden gelesen, „grund“ ist optional', () => {
    expect(
      parseContentSeedSettings('{"nur_fachlich_geprueft": false, "grund": "Testphase"}'),
    ).toEqual({ settings: { nur_fachlich_geprueft: false, grund: 'Testphase' }, problems: [] });
    expect(parseContentSeedSettings('{"nur_fachlich_geprueft": true}').settings).toEqual({
      nur_fachlich_geprueft: true,
    });
  });

  it('kaputte Datei → Fehler (blockierend) und sichere Richtung: nur fachlich geprüft', () => {
    for (const text of [
      '{',
      '{}',
      '{"nur_fachlich_geprueft": "nein"}',
      '{"nur_fachlich_geprueft": 0}',
      '{"nur_fachlich_geprueft": false, "extra": 1}',
      '{"nur_fachlich_geprueft": false, "grund": ""}',
      '[]',
      'null',
    ]) {
      const result = parseContentSeedSettings(text);
      expect(result.settings.nur_fachlich_geprueft, text).toBe(true);
      expect(result.problems.length, text).toBeGreaterThan(0);
      expect(result.problems[0], text).toContain(CONTENT_SEED_SETTINGS_FILE);
    }
  });
});

describe('Kennzeichen „Testphase – noch nicht fachlich geprüft“', () => {
  it('nur freigegeben UND ohne Fachprüfung', () => {
    expect(isPublishedWithoutExpertReview({ status: 'published', meta: META })).toBe(true);
    expect(isPublishedWithoutExpertReview({ status: 'published', meta: MANUAL })).toBe(true);
    expect(
      isPublishedWithoutExpertReview({
        status: 'published',
        meta: { ...META, expert_reviewed: true },
      }),
    ).toBe(false);
    expect(isPublishedWithoutExpertReview({ status: 'draft', meta: META })).toBe(false);
    expect(isPublishedWithoutExpertReview({ status: 'archived', meta: META })).toBe(false);
  });

  it('contentReviewMark: Testphase vor KI-Entwurf, Entwürfe wie bisher, geprüft ohne Kennzeichen', () => {
    // freigegeben, nicht geprüft – egal ob KI oder von Hand
    expect(contentReviewMark({ status: 'published', meta: META })).toBe('testphase');
    expect(contentReviewMark({ status: 'published', meta: MANUAL })).toBe('testphase');
    // freigegeben und fachlich geprüft
    expect(
      contentReviewMark({ status: 'published', meta: { ...META, expert_reviewed: true } }),
    ).toBeNull();
    // Entwürfe (Testmodus) unverändert
    expect(contentReviewMark({ status: 'draft', meta: META })).toBe('ai_draft');
    expect(contentReviewMark({ status: 'draft', meta: MANUAL })).toBe('draft');
    expect(contentReviewMark({ status: 'draft', meta: { ...META, expert_reviewed: true } })).toBe(
      'draft',
    );
    expect(contentReviewMark({ status: 'archived', meta: META })).toBeNull();
  });
});

describe('Beispiel-Bestand „Testphase“ (nur E2E-Tests)', () => {
  const select = (demo: ReturnType<typeof demoNutritionContent>) =>
    selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
      allowDrafts: true,
    });

  it('dieselben Inhalte wie die Entwürfe, alle freigegeben und ohne Fachprüfung → Kennzeichen „testphase“', () => {
    const drafts = select(demoNutritionContent());
    const testphase = select(demoNutritionContentAsTestphase());
    expect(testphase.recipes.map((r) => r.id)).toEqual(drafts.recipes.map((r) => r.id));
    expect(testphase.guides.map((g) => g.id)).toEqual(drafts.guides.map((g) => g.id));
    expect(testphase.mealPrepPlans.map((p) => p.id)).toEqual(drafts.mealPrepPlans.map((p) => p.id));
    expect(testphase.recipes.length).toBeGreaterThan(10);
    expect(testphase.recipes.every((r) => contentReviewMark(r) === 'testphase')).toBe(true);
    expect(drafts.recipes.every((r) => contentReviewMark(r) !== 'testphase')).toBe(true);
    // Ratgeber: Hinweis „Testphase“ statt „Entwurf“.
    const guide = guideForDisplay(testphase.guides[0]!, { showNumbers: true });
    expect(guide).toMatchObject({ isDraft: false, isTestphase: true });
    expect(guideForDisplay(drafts.guides[0]!, { showNumbers: true })).toMatchObject({
      isDraft: true,
      isTestphase: false,
    });
    // Ratgeber mit Dosierungs-Befund (R21H) wird ohne Fachprüfung NICHT freigegeben (Wächter H1) – bleibt Entwurf.
    expect(testphase.guides.map((g) => [g.id, g.status])).toEqual([
      ['demo-unterwegs', 'published'],
      ['demo-wettkampf', 'draft'],
    ]);
    const wettkampf = testphase.guides.find((g) => g.id === 'demo-wettkampf')!;
    expect(guideForDisplay(wettkampf, { showNumbers: true })).toMatchObject({
      isDraft: true,
      isTestphase: false,
    });
    // Fachlich geprüft → kein Hinweis.
    const reviewed = {
      ...testphase.guides[0]!,
      meta: { ...testphase.guides[0]!.meta, expert_reviewed: true },
    };
    expect(guideForDisplay(reviewed, { showNumbers: true }).isTestphase).toBe(false);
  });
});
