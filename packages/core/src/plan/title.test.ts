import { describe, expect, it } from 'vitest';

import { ENDURANCE_DISCIPLINES, GOAL_TYPES } from '../enums';

import { planTitle } from './title';

const withEndurance = { slots: [{ kind: 'strength_gym' }, { kind: 'endurance' }] };
const strengthOnly = { slots: [{ kind: 'strength_gym' }, { kind: 'strength_home' }] };

describe('planTitle', () => {
  it('Ziel Ausdauer → Ausdauer-Grundlage mit Disziplin, auch mit Kraft-Vorlage', () => {
    for (const discipline of ENDURANCE_DISCIPLINES) {
      expect(
        planTitle({
          template_title_de: 'Allgemeine Fitness',
          inputs: { goalType: 'endurance', discipline, schedule: withEndurance },
        }),
      ).toEqual({ kind: 'endurance_base', discipline });
    }
    expect(
      planTitle({
        template_title_de: null,
        inputs: { goalType: 'endurance', discipline: null, schedule: withEndurance },
      }),
    ).toEqual({ kind: 'endurance_base', discipline: null });
  });

  it('andere Ziele → Vorlagenname bzw. reiner Ausdauer-Plan', () => {
    for (const goalType of GOAL_TYPES.filter((g) => g !== 'endurance')) {
      expect(
        planTitle({
          template_title_de: 'Ganzkörper 3×',
          inputs: { goalType, discipline: null, schedule: withEndurance },
        }),
      ).toEqual({ kind: 'template', title: 'Ganzkörper 3×' });
      expect(
        planTitle({
          template_title_de: null,
          inputs: { goalType, discipline: null, schedule: withEndurance },
        }),
      ).toEqual({ kind: 'endurance_only' });
    }
  });

  it('Ziel Ausdauer ohne Ausdauer-Tag → keine Ausdauer-Grundlage (Vorlagenname bzw. Ausdauer-Plan)', () => {
    expect(
      planTitle({
        template_title_de: 'Allgemeine Fitness',
        inputs: { goalType: 'endurance', discipline: 'marathon', schedule: strengthOnly },
      }),
    ).toEqual({ kind: 'template', title: 'Allgemeine Fitness' });
    expect(
      planTitle({
        template_title_de: null,
        inputs: { goalType: 'endurance', discipline: '10k', schedule: { slots: [] } },
      }),
    ).toEqual({ kind: 'endurance_only' });
  });

  it('unlesbare Angaben → Vorlagenname (nie Absturz)', () => {
    expect(planTitle({ template_title_de: 'Allgemeine Fitness', inputs: null })).toEqual({
      kind: 'template',
      title: 'Allgemeine Fitness',
    });
    expect(planTitle({ template_title_de: null, inputs: null })).toEqual({
      kind: 'endurance_only',
    });
  });
});
