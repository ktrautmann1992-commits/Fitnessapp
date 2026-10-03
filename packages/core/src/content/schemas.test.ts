import { describe, expect, it } from 'vitest';

import {
  contentIdSchema,
  contentMetaSchema,
  exerciseSchema,
  needsExpertReviewLabel,
  planTemplateSchema,
  templateExerciseSchema,
} from './schemas';
import { item, makeExercise, makeTemplate, META } from './test-fixtures';

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe('contentIdSchema', () => {
  it('Kleinbuchstaben, Ziffern, Bindestriche; 3–80 Zeichen', () => {
    expect(contentIdSchema.safeParse('kniebeuge-langhantel').success).toBe(true);
    expect(contentIdSchema.safeParse('abc').success).toBe(true);
    expect(contentIdSchema.safeParse('ab').success).toBe(false);
    expect(contentIdSchema.safeParse('a'.repeat(80)).success).toBe(true);
    expect(contentIdSchema.safeParse('a'.repeat(81)).success).toBe(false);
    for (const bad of [
      'Kniebeuge',
      'knie_beuge',
      '-knie',
      'knie-',
      'knie--beuge',
      'kniebeuge.json',
    ]) {
      expect(contentIdSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('contentMetaSchema', () => {
  it('KI-Entwurf braucht ein Modell, Batch genau mit Batch-Nummer', () => {
    expect(contentMetaSchema.safeParse(META).success).toBe(true);
    expect(contentMetaSchema.safeParse({ ...META, model: null }).success).toBe(false);
    expect(contentMetaSchema.safeParse({ ...META, origin: 'manual', model: null }).success).toBe(
      true,
    );
    expect(contentMetaSchema.safeParse({ ...META, origin: 'batch' }).success).toBe(false);
    expect(
      contentMetaSchema.safeParse({ ...META, origin: 'batch', batch_id: 'msgbatch_01' }).success,
    ).toBe(true);
    expect(contentMetaSchema.safeParse({ ...META, batch_id: 'msgbatch_01' }).success).toBe(false);
  });

  it('Prüfer und Prüfdatum nur gemeinsam; Datum im ISO-Format', () => {
    expect(contentMetaSchema.safeParse({ ...META, reviewed_by: 'KT' }).success).toBe(false);
    expect(
      contentMetaSchema.safeParse({ ...META, reviewed_by: 'KT', reviewed_at: '2026-10-03' })
        .success,
    ).toBe(true);
    expect(
      contentMetaSchema.safeParse({ ...META, reviewed_by: 'KT', reviewed_at: '03.10.2026' })
        .success,
    ).toBe(false);
    expect(contentMetaSchema.safeParse({ ...META, created_on: '2026-02-30' }).success).toBe(false);
  });

  it('unbekannte Felder werden abgelehnt (strikt)', () => {
    expect(contentMetaSchema.safeParse({ ...META, ai_generated: true }).success).toBe(false);
  });

  it('Kennzeichnung „KI-Entwurf – fachlich prüfen“', () => {
    expect(needsExpertReviewLabel(META)).toBe(true);
    expect(needsExpertReviewLabel({ ...META, expert_reviewed: true })).toBe(false);
    expect(needsExpertReviewLabel({ ...META, origin: 'manual', model: null })).toBe(false);
  });
});

describe('exerciseSchema (Ü1)', () => {
  it('gültige Übung', () => {
    expect(exerciseSchema.safeParse(makeExercise()).success).toBe(true);
  });

  it('Pflichtfelder und unbekannte Felder', () => {
    const withoutName: Record<string, unknown> = { ...makeExercise() };
    delete withoutName.name_en;
    expect(exerciseSchema.safeParse(withoutName).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...makeExercise(), video_url: 'x' }).success).toBe(false);
  });

  it('Grenzen: Version 1–1000, Schwierigkeit 1–3', () => {
    expect(exerciseSchema.safeParse(makeExercise({ version: 0 })).success).toBe(false);
    expect(exerciseSchema.safeParse(makeExercise({ version: 1000 })).success).toBe(true);
    expect(exerciseSchema.safeParse(makeExercise({ version: 1001 })).success).toBe(false);
    expect(exerciseSchema.safeParse(makeExercise({ difficulty: 3 })).success).toBe(true);
    expect(exerciseSchema.safeParse(makeExercise({ difficulty: 4 })).success).toBe(false);
    expect(exerciseSchema.safeParse(makeExercise({ difficulty: 1.5 })).success).toBe(false);
  });

  it('Textlängen und Leerzeichen am Rand', () => {
    expect(exerciseSchema.safeParse(makeExercise({ description_de: 'zu kurz' })).success).toBe(
      false,
    );
    expect(
      exerciseSchema.safeParse(makeExercise({ description_de: 'x'.repeat(601) })).success,
    ).toBe(false);
    expect(exerciseSchema.safeParse(makeExercise({ name_de: ' Kniebeuge' })).success).toBe(false);
    expect(exerciseSchema.safeParse(makeExercise({ steps_de: ['Nur ein Schritt.'] })).success).toBe(
      false,
    );
    expect(exerciseSchema.safeParse(makeExercise({ tips_de: [] })).success).toBe(false);
  });

  it('Muskeln: mindestens ein Hauptmuskel, keine Doppelungen, nicht Haupt- und Nebenmuskel zugleich', () => {
    expect(exerciseSchema.safeParse(makeExercise({ primary_muscles: [] })).success).toBe(false);
    expect(
      exerciseSchema.safeParse(makeExercise({ primary_muscles: ['glutes', 'glutes'] })).success,
    ).toBe(false);
    const both = exerciseSchema.safeParse(makeExercise({ secondary_muscles: ['glutes'] }));
    expect(messages(both)).toEqual(['Muskel gleichzeitig Haupt- und Nebenmuskel: glutes.']);
    expect(
      exerciseSchema.safeParse(makeExercise({ primary_muscles: ['abs'] as never })).success,
    ).toBe(true);
    expect(
      exerciseSchema.safeParse(makeExercise({ primary_muscles: ['nacken'] as never })).success,
    ).toBe(false);
  });

  it('Geräte-IDs im Katalog-Format (Existenz prüft Ü2), keine Doppelungen', () => {
    expect(exerciseSchema.safeParse(makeExercise({ equipment_ids: ['hovercraft'] })).success).toBe(
      true,
    );
    expect(exerciseSchema.safeParse(makeExercise({ equipment_ids: ['Hover Craft'] })).success).toBe(
      false,
    );
    expect(
      exerciseSchema.safeParse(makeExercise({ equipment_ids: ['barbell', 'barbell'] })).success,
    ).toBe(false);
  });

  it('Freigegeben nur mit eingetragenem Prüfer', () => {
    const published = makeExercise({ status: 'published' });
    expect(messages(exerciseSchema.safeParse(published))).toEqual([
      'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
    ]);
    expect(
      exerciseSchema.safeParse({
        ...published,
        meta: { ...META, reviewed_by: 'KT', reviewed_at: '2026-10-03' },
      }).success,
    ).toBe(true);
    // Entwurf und zurückgezogen brauchen keinen Prüfer.
    expect(exerciseSchema.safeParse(makeExercise({ status: 'archived' })).success).toBe(true);
  });

  it('Alternativen: Priorität 1–20, bekannter Grund', () => {
    const alt = (priority: number, reason = 'easier') =>
      exerciseSchema.safeParse(
        makeExercise({ alternatives: [{ alternative_id: 'goblet', reason, priority } as never] }),
      ).success;
    expect(alt(1)).toBe(true);
    expect(alt(20)).toBe(true);
    expect(alt(0)).toBe(false);
    expect(alt(21)).toBe(false);
    expect(alt(1, 'cheaper')).toBe(false);
  });
});

describe('templateExerciseSchema (Ü1)', () => {
  it('entweder Wiederholungen oder Dauer', () => {
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3)).success).toBe(true);
    expect(
      templateExerciseSchema.safeParse(
        item(1, 'x-y-z', 3, { reps_min: null, reps_max: null, duration_s: 30 }),
      ).success,
    ).toBe(true);
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { duration_s: 30 })).success).toBe(
      false,
    );
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { reps_max: null })).success).toBe(
      false,
    );
    expect(
      templateExerciseSchema.safeParse(
        item(1, 'x-y-z', 3, { reps_min: null, reps_max: null, duration_s: null }),
      ).success,
    ).toBe(false);
  });

  it('reps_min ≤ reps_max; harte Grenzen weiter als V4 (Entwürfe korrigierbar)', () => {
    expect(
      templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { reps_min: 12, reps_max: 10 })).success,
    ).toBe(false);
    // RPE 10 und 1 Wiederholung sind schema-gültig (V4 meldet sie rot).
    expect(
      templateExerciseSchema.safeParse(
        item(1, 'x-y-z', 3, { reps_min: 1, reps_max: 1, rpe_target: 10 }),
      ).success,
    ).toBe(true);
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 11)).success).toBe(false);
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 0)).success).toBe(false);
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { rpe_target: 7.3 })).success).toBe(
      false,
    );
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { rpe_target: 7.5 })).success).toBe(
      true,
    );
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { rest_s: 601 })).success).toBe(
      false,
    );
    expect(templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { rest_s: 0 })).success).toBe(true);
  });

  it('Supersatz-Gruppe: ein Großbuchstabe', () => {
    expect(
      templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { superset_group: 'A' })).success,
    ).toBe(true);
    expect(
      templateExerciseSchema.safeParse(item(1, 'x-y-z', 3, { superset_group: 'ab' })).success,
    ).toBe(false);
  });
});

describe('planTemplateSchema (Ü1)', () => {
  it('gültige Vorlage', () => {
    expect(planTemplateSchema.safeParse(makeTemplate()).success).toBe(true);
  });

  it('nur Ziele und Level der Matrix', () => {
    expect(
      planTemplateSchema.safeParse(makeTemplate({ goal_type: 'endurance' as never })).success,
    ).toBe(false);
    expect(
      planTemplateSchema.safeParse(makeTemplate({ experience_level: 'competitive' as never }))
        .success,
    ).toBe(false);
  });

  it('Minuten 10–240 und min ≤ max; 1–7 Tage', () => {
    expect(planTemplateSchema.safeParse(makeTemplate({ minutes_min: 9 })).success).toBe(false);
    expect(planTemplateSchema.safeParse(makeTemplate({ minutes_max: 241 })).success).toBe(false);
    expect(
      planTemplateSchema.safeParse(makeTemplate({ minutes_min: 60, minutes_max: 45 })).success,
    ).toBe(false);
    expect(planTemplateSchema.safeParse(makeTemplate({ sessions_per_week: 0 })).success).toBe(
      false,
    );
    expect(planTemplateSchema.safeParse(makeTemplate({ sessions_per_week: 8 })).success).toBe(
      false,
    );
  });

  it('Gerät nicht zugleich Pflicht und optional', () => {
    expect(
      planTemplateSchema.safeParse(
        makeTemplate({
          required_equipment_ids: ['dumbbells'],
          optional_equipment_ids: ['dumbbells'],
        }),
      ).success,
    ).toBe(false);
  });

  it('order_no je Einheit eindeutig; 1–12 Übungen je Einheit', () => {
    const template = makeTemplate();
    const first = template.sessions[0]!;
    const duplicate = { ...first, exercises: [item(1, 'a-b-c', 3), item(1, 'd-e-f', 3)] };
    expect(planTemplateSchema.safeParse({ ...template, sessions: [duplicate] }).success).toBe(
      false,
    );
    const empty = { ...first, exercises: [] };
    expect(planTemplateSchema.safeParse({ ...template, sessions: [empty] }).success).toBe(false);
    const many = {
      ...first,
      exercises: Array.from({ length: 13 }, (_, i) => item(i + 1, 'a-b-c', 3)),
    };
    expect(planTemplateSchema.safeParse({ ...template, sessions: [many] }).success).toBe(false);
  });
});
