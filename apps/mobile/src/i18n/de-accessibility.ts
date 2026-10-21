/**
 * Texte zur Barrierefreiheit (docs/PLAN-FIT-IM-ALTER.md Abschnitt 12, Etappe FA5): „Große Ansicht“ und „Anleitungen
 * vorlesen“. Einfache Sprache, kurze Sätze. Kein Hinweis auf Alter oder Gesundheit im Text („passt für dich“), damit
 * niemand bewertet wird.
 */
export const deAccessibility = {
  section: 'Lesen und Hören',
  largeView: 'Große Ansicht',
  largeViewHint:
    'Größere Schrift, größere Knöpfe und stärkerer Kontrast. Auf „Heute“ siehst du nur das Wichtigste.',
  largeViewSuggestion: 'Tipp: Die große Ansicht ist besser lesbar. Probier sie einfach aus.',
  readAloud: 'Anleitungen vorlesen',
  readAloudHint:
    'Ein Knopf liest Übungsanleitungen vor. Das macht die Sprachausgabe deines Geräts. Es werden nur Anleitungen vorgelesen, nie deine Daten.',
  readAloudUnavailable:
    'Auf diesem Gerät gibt es keine deutsche Sprachausgabe, die ohne Internet funktioniert. Darum ist Vorlesen hier nicht möglich.',
  readAloudButton: 'Anleitung vorlesen',
  readAloudStop: 'Vorlesen stoppen',
  readAloudA11y: (name: string) => `Anleitung für ${name} vorlesen`,
  todayMore: 'Mehr anzeigen',
  todayLess: 'Weniger anzeigen',
  largePrint: 'Großdruck (größere Schrift)',
  largePrintHint: 'Der Plan wird mit größerer Schrift gedruckt. Er braucht dann mehr Seiten.',
} as const;
