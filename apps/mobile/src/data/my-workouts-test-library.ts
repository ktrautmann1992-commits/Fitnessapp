import { type Exercise, exerciseSchema, isFlowPoseId } from '@fitnessapp/core';

import { CONTENT_BUNDLE } from '../generated/content-files';

/** Nur für Tests: freigegebene Übungen aus dem gebündelten Inhalt (ohne Yoga-Posen), wie PlanLibrary.exercises. */
export function testLibrary(): ReadonlyMap<string, Exercise> {
  const exercises = CONTENT_BUNDLE.files.flatMap((file) => {
    const parsed = exerciseSchema.safeParse(file.data);
    return parsed.success && parsed.data.status === 'published' && !isFlowPoseId(parsed.data.id)
      ? [parsed.data]
      : [];
  });
  return new Map(exercises.map((e) => [e.id, e] as const));
}
