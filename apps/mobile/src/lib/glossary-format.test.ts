import { describe, expect, it } from 'vitest';

import { equipmentText, featureLine, listLine } from './glossary-format';

describe('Glossar-Texte', () => {
  it('Geräte-Kurztext', () => {
    expect(equipmentText([])).toBe('ohne Geräte');
    expect(equipmentText([{ name: 'Kurzhanteln' }, { name: 'Flachbank' }])).toBe(
      'Kurzhanteln, Flachbank',
    );
  });

  it('Listenzeile: Bereich · Geräte', () => {
    expect(listLine({ movement_pattern: 'hinge', equipment_ids: ['barbell'] })).toBe(
      'Hüfte/Gesäß · Langhantel mit Scheiben',
    );
    expect(listLine({ movement_pattern: 'core_flexion', equipment_ids: [] })).toBe(
      'Rumpf · ohne Geräte',
    );
  });

  it('Merkmal-Zeile mit Schwierigkeit als Wort, Halten und einseitig', () => {
    expect(
      featureLine({
        group: 'legs',
        equipment: [],
        difficulty: 'easy',
        loadType: 'hold',
        unilateral: true,
      }),
    ).toBe('Beine · ohne Geräte · Schwierigkeit: leicht · Halten · einseitig');
    expect(
      featureLine({
        group: 'pull',
        equipment: [{ id: 'dumbbells', name: 'Kurzhanteln' }],
        difficulty: 'hard',
        loadType: 'reps',
        unilateral: false,
      }),
    ).toBe('Ziehen/Rücken · Kurzhanteln · Schwierigkeit: anspruchsvoll · Wiederholungen');
  });
});
