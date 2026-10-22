/**
 * kcal je Einheit (Gründer-Wunsch „kcal verbrannt für jede Einheit“; docs/KONZEPT.md Abschnitt 5): Wert der Uhr
 * („laut Uhr“) oder Schätzung aus Dauer, Intensität und Gewicht. Erscheint nie auf dem Story-Bild.
 */
export const deSessionKcal = {
  value: (kcal: string) => `ca. ${kcal} kcal`,
  valueShort: (kcal: string) => `ca. ${kcal}`,
  a11y: (kcal: string, watch: boolean) =>
    `Etwa ${kcal} Kilokalorien verbrannt, ${watch ? 'laut Uhr' : 'geschätzt aus Dauer, Intensität und Gewicht'}`,
  watch: 'laut Uhr',
  estimate: 'geschätzt aus Dauer, Intensität und Gewicht',
  statLabelWatch: 'kcal laut Uhr',
  statLabelEstimate: 'kcal geschätzt',
  statLabel: 'kcal',
  needsWeight: 'Für kcal: Gewicht im Profil angeben',
  needsConsent: 'Für kcal: Einwilligung Gesundheitsdaten erteilen und Gewicht angeben',
  enterWeight: 'Gewicht angeben',
  grantConsent: 'Einwilligung erteilen',
  noValue: '–',
  dayTotal: (kcal: string) => `Im Training verbrannt: ca. ${kcal} kcal`,
  dayTotalA11y: (kcal: string) => `Im Training etwa ${kcal} Kilokalorien verbrannt`,
  dayTotalNote:
    'Summe der Einheiten mit Ruheumsatz. Die Ernährung zählt nur den Mehrverbrauch durchs Training – dort ist die Zahl kleiner.',
} as const;
