import {
  addDays,
  monthBounds,
  monthReview,
  type MonthReview,
  WEIGHT_TREND,
} from '@fitnessapp/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useWeightHistory, useWeightTrendHidden } from '@/components/weight-trend';
import { deviceStore } from '@/data/create-backend';
import { readJson, writeJson } from '@/data/kv';
import { monthReviewInput, weightTrendVisibility, type WeightTrendVisibility } from '@/data/review';
import { useToday } from '@/lib/use-today';

import { useApp } from './app-state';
import { healthConsentStatus } from './flow';

/** Zuletzt geöffneter Rückblick-Monat (nur auf dem Gerät) – für das Angebot am Monatsanfang. */
export const MONTH_REVIEW_OPENED_KEY = 'fitnessapp.month-review-opened.v1';

export function useMonthReviewOpened(): [string | null | undefined, (month: string) => void] {
  const [opened, setOpened] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void readJson<string>(deviceStore, MONTH_REVIEW_OPENED_KEY)
      .then((value) => setOpened(typeof value === 'string' ? value : null))
      .catch(() => setOpened(null));
  }, []);
  const markOpened = useCallback((month: string) => {
    setOpened((current) => (current && current >= month ? current : month));
    void readJson<string>(deviceStore, MONTH_REVIEW_OPENED_KEY)
      .then((stored) =>
        stored && stored >= month
          ? undefined
          : writeJson(deviceStore, MONTH_REVIEW_OPENED_KEY, month),
      )
      .catch(() => undefined);
  }, []);
  return [opened, markOpened];
}

export type MonthReviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | {
      readonly kind: 'ready';
      readonly review: MonthReview;
      readonly weight: WeightTrendVisibility;
      readonly offline: boolean;
    };

/**
 * Monatsrückblick eines Monats (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3): Zeilen → `monthReview()` aus packages/core.
 * Gewicht nur bei Einwilligung, „Kalorienzahlen anzeigen“ an und nicht ausgeblendet; Essen nur mit Tagebuch und
 * Einwilligung. Alles nur im Arbeitsspeicher.
 */
export function useMonthReview(month: string): MonthReviewState {
  const app = useApp();
  const today = useToday();
  const [hidden] = useWeightTrendHidden();
  const rows = app.rows;
  const consentValid = rows ? healthConsentStatus(rows, app.versions) === 'valid' : false;
  const visibility =
    rows && hidden !== null
      ? weightTrendVisibility({ rows, consentValid, hiddenOnDevice: hidden })
      : null;
  const from = addDays(monthBounds(month).first, -WEIGHT_TREND.resetAfterGapDays);
  const { state: history } = useWeightHistory(visibility === 'visible', from);
  return useMemo((): MonthReviewState => {
    if (!rows || visibility === null) return { kind: 'loading' };
    const showWeight = visibility === 'visible';
    if (showWeight && history.kind === 'loading') return { kind: 'loading' };
    const weight = showWeight && history.kind === 'ready' ? history.entries : null;
    try {
      const review = monthReview(
        monthReviewInput({
          rows,
          month,
          today,
          foodLogAvailable: app.backend.supportsNutrition && consentValid,
          weight,
        }),
      );
      return {
        kind: 'ready',
        review,
        weight: showWeight && history.kind === 'error' ? 'hidden' : visibility,
        offline: history.kind === 'ready' && history.offline,
      };
    } catch {
      // Nie Werte loggen (Gesundheitsdaten).
      return { kind: 'error' };
    }
  }, [rows, visibility, history, month, today, app.backend.supportsNutrition, consentValid]);
}
