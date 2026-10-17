import { describe, expect, it } from 'vitest';

import type { UserPlanRow } from '@/data/types';

import { planNameLine, planTitleText } from './plan-title';

const inputs = (goalType: string, discipline: string | null, endurance = true) => ({
  goalType,
  discipline,
  experienceLevel: 'advanced',
  schedule: {
    mode: 'fixed',
    slots: [
      { weekday: 1, kind: 'strength_gym', minutes: 60 },
      { weekday: 2, kind: endurance ? 'endurance' : 'strength_gym', minutes: 30 },
    ],
  },
  trainingLocation: 'gym',
  homeEquipment: [],
});

const plan = (templateTitle: string | null, planInputs: unknown) =>
  ({ template_title_de: templateTitle, inputs: planInputs }) as unknown as UserPlanRow;

describe('planTitleText', () => {
  it('Ziel Ausdauer → „Ausdauer-Grundlage – <Disziplin>“ statt Vorlagenname', () => {
    expect(planTitleText(plan('Allgemeine Fitness', inputs('endurance', 'marathon')))).toBe(
      'Ausdauer-Grundlage – Marathon',
    );
    expect(planTitleText(plan(null, inputs('endurance', 'triathlon_long')))).toBe(
      'Ausdauer-Grundlage – Triathlon Langdistanz',
    );
    expect(planTitleText(plan(null, inputs('endurance', null)))).toBe('Ausdauer-Grundlage');
  });

  it('Ziel Ausdauer ohne Ausdauer-Tag → Vorlagenname statt Ausdauer-Grundlage', () => {
    expect(planTitleText(plan('Allgemeine Fitness', inputs('endurance', 'marathon', false)))).toBe(
      'Vorlage: Allgemeine Fitness',
    );
  });

  it('andere Ziele: Vorlage bzw. Ausdauer-Plan; unlesbare Angaben → Vorlagenname', () => {
    expect(planTitleText(plan('Muskelaufbau 3×', inputs('muscle_gain', null)))).toBe(
      'Vorlage: Muskelaufbau 3×',
    );
    expect(planTitleText(plan(null, inputs('general_fitness', null)))).toBe('Ausdauer-Plan');
    expect(planTitleText(plan('Allgemeine Fitness', { kaputt: true }))).toBe(
      'Vorlage: Allgemeine Fitness',
    );
  });
});

describe('planNameLine (Etappe Z5: Planname mit zwei Zielen)', () => {
  it('ein Ziel, zwei Ziele, Ausdauer-Grundlage; nie Wunschgewicht oder Tempo', () => {
    expect(planNameLine(plan('X', inputs('fat_loss', null, false)))).toBe(
      'Dein Plan: Abnehmen · 2 Tage',
    );
    expect(
      planNameLine(
        plan('X', { ...inputs('fat_loss', null, false), secondaryGoalType: 'muscle_gain' }),
      ),
    ).toBe('Dein Plan: Abnehmen + Muskelaufbau · 2 Tage');
    expect(
      planNameLine(plan('X', { ...inputs('fat_loss', '10k'), secondaryGoalType: 'endurance' })),
    ).toBe('Dein Plan: Abnehmen + Ausdauer · 1 × Kraft, 1 × Ausdauer');
    expect(
      planNameLine(
        plan('X', { ...inputs('endurance', 'marathon'), secondaryGoalType: 'fat_loss' }),
      ),
    ).toBe('Dein Plan: Ausdauer-Grundlage – Marathon + Abnehmen · 1 × Kraft, 1 × Ausdauer');
    // Gespeichertes `null` = kein Nebenziel; unlesbare Angaben → null.
    expect(
      planNameLine(plan('X', { ...inputs('muscle_gain', null, false), secondaryGoalType: null })),
    ).toBe('Dein Plan: Muskelaufbau · 2 Tage');
    expect(planNameLine(plan('X', { goalType: 'kaputt' }))).toBeNull();
    expect(
      planNameLine(
        plan('X', { ...inputs('fat_loss', null, false), secondaryGoalType: 'muscle_gain' }),
      ),
    ).not.toMatch(/kg|%|Woche|Wunsch|Tempo/);
  });
});
