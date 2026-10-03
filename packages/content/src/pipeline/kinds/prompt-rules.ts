/**
 * Gemeinsame Regeln für alle Anfrage-Texte (docs/PLAN-PHASE-2.md Abschnitt 8, CLAUDE.md „Sicherheit der
 * Empfehlungen“). Die Begriffe kommen aus denselben Listen, die Regel Ü6 prüft.
 */
import { EQUIPMENT, FORBIDDEN_BRANDS, FORBIDDEN_MEDICAL_TERMS } from '@fitnessapp/core';

export const ROLE_TEXT =
  'Du schreibst Inhalte für eine deutschsprachige Fitness-App (Deutschland, Österreich, Schweiz). ' +
  'Zielgruppe: gesunde Erwachsene ab 16 Jahren, von Einsteigern bis Fortgeschrittenen. ' +
  'Deine Antwort ist ein Entwurf, den Menschen prüfen und erst danach freigeben.';

export function textRules(): string {
  const medical = FORBIDDEN_MEDICAL_TERMS.map((rule) => rule.label).join(', ');
  const brands = FORBIDDEN_BRANDS.map((rule) => rule.label).join(', ');
  return [
    'Regeln für alle Texte:',
    '- Sprache: Deutsch, klar und kurz, sachlich. Kurze Sätze, Fachbegriffe nur mit Erklärung.',
    '- Beschreibe Technik und Training – keine Behandlung. Keine Diagnosen, keine Heil-, Gesundheits- oder Erfolgsversprechen, keine Aussagen über Krankheiten oder Beschwerden.',
    `- Diese Wörter (und Wortformen) sind verboten: ${medical}.`,
    `- Keine Marken- oder Herstellernamen (z. B. ${brands}); nenne Geräte allgemein.`,
    '- Sicherheitshinweise allgemein halten, z. B.: „Bei Schmerzen, Schwindel oder ungewohnten Beschwerden die Übung beenden.“',
    '- Keine Maximaltests, kein Training bis zum völligen Versagen.',
    '- Kein Text am Anfang oder Ende mit Leerzeichen; keine Emojis, kein Markdown.',
  ].join('\n');
}

/** Geräte-Katalog als Liste für den Anfrage-Text. */
export function equipmentCatalogText(options: { homeOnly?: boolean } = {}): string {
  const items = EQUIPMENT.filter(
    (item) => item.id !== 'other' && (!options.homeOnly || item.homeSelectable),
  );
  return items
    .map(
      (item) =>
        `- ${item.id}: ${item.nameDe}${item.homeSelectable ? '' : ' (nur Studio, nie zu Hause)'}`,
    )
    .join('\n');
}

export const OUTPUT_FORMAT_TEXT =
  'Antworte ausschließlich mit dem JSON-Objekt im vorgegebenen Schema. Erlaubte Werte (IDs, Aufzählungen) ' +
  'stehen im Schema; erfinde keine neuen.';
