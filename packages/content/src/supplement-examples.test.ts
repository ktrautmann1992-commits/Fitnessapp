import { describe, expect, it } from 'vitest';

import { renderSupplementExamples, SUPPLEMENT_EXAMPLE_PERSONS } from './supplement-examples';

describe('Beispiel-Empfehlungen Supplemente (CI-Zusammenfassung, Plan 6 Etappe SU1)', () => {
  const markdown = renderSupplementExamples();

  it('zehn Test-Personen, je eine Zeile', () => {
    expect(SUPPLEMENT_EXAMPLE_PERSONS).toHaveLength(10);
    for (const person of SUPPLEMENT_EXAMPLE_PERSONS)
      expect(markdown).toContain(`| ${person.name} |`);
  });

  it('zeigt die wichtigen Fälle', () => {
    const row = (name: string) =>
      markdown.split('\n').find((line) => line.startsWith(`| ${name} |`))!;
    expect(row('Anna')).toContain('**passt**, 3 g');
    expect(row('Anna')).toContain('20 µg (800 IE) (Richtwert)');
    expect(row('Ben')).toContain('ab 18');
    expect(row('Clara')).toContain('nur BfR-Hinweis');
    expect(row('Clara').match(/nicht für dich/g)).toHaveLength(4);
    expect(row('Emma')).toContain('≤ 120 mg/Einnahme, ≤ 220 mg/Tag, abends nicht');
    expect(row('Emma')).toContain('pflanzlich');
    expect(row('Felix')).toContain('Doping-Hinweis');
    expect(row('Felix')).toContain('≤ 200 mg/Einnahme, ≤ 400 mg/Tag, nur vor 16 Uhr');
    expect(row('Hannes')).toContain('ärztlich abklären');
    expect(row('Ilse')).not.toContain('passt');
    expect(row('Jonas')).toContain('ärztlich abklären');
    expect(markdown).toContain('**Hannes:** Bitte vor dem Start ärztlich abklären.');
  });

  it('keine Shop-Links, keine URLs', () => {
    expect(markdown).not.toMatch(/https?:|anzeige/i);
  });

  it('stabil (feste Daten, kein „heute“)', () => {
    expect(renderSupplementExamples()).toBe(markdown);
  });
});
