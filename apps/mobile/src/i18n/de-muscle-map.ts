/**
 * Texte der Muskelkarte und des Bildes „Ausgangsposition“ (Nachtrag „Muskelkarte“ in
 * docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md). Farbe nie allein: Legende und Screenreader-Text nennen die Muskeln in Worten.
 */
export const deMuscleMap = {
  title: 'Beanspruchte Muskeln',
  front: 'Vorn',
  back: 'Hinten',
  primaryLegend: 'Hauptmuskeln',
  secondaryLegend: 'Mitbeteiligt',
  legendLine: (label: string, names: readonly string[]) => `${label}: ${names.join(', ')}`,
  a11yPrimary: (names: readonly string[]) => `Trainiert vor allem: ${names.join(', ')}.`,
  a11ySecondary: (names: readonly string[]) => `Mitbeteiligt: ${names.join(', ')}.`,
  a11yNone: 'Keine Angaben zu den beanspruchten Muskeln.',
  openLarge: 'Muskelkarte groß anzeigen.',
  close: 'Schließen',
  dialogTitle: (exerciseName: string) => `Muskeln: ${exerciseName}`,
  note: 'Vereinfachte Darstellung der Muskelgruppen.',
  startPositionTitle: 'Ausgangsposition',
  imageCredit: (creator: string, license: string) => `Bild: ${creator} · ${license}`,
  ownIllustration: 'Eigene Illustration von Alpha5, vereinfachte Darstellung.',
  // Übungsfotos (docs/UEBUNGSFOTOS.md): sichtbarer KI-Hinweis wie bei Workout- und Rezeptbildern.
  aiPhotoNotice: 'KI-Bild',
  aiPhotoA11y: 'Hinweis: KI-Bild',
  aiPhotoCredit: 'KI-Bild von Alpha5: mit KI erzeugtes Foto der Ausgangsposition.',
};
