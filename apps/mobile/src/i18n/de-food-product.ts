import { type FoodProductCheckReason, USER_FOOD_PRODUCT_LIMITS } from '@fitnessapp/core';

/**
 * Texte der Produktabfrage per Barcode-Nummer und der eigenen Produkte (Etappe E4a, docs/PLAN-E4.md 2, 6.1).
 * Ruhige, neutrale Sprache wie das Ernährungstagebuch: keine Bewertung von Produkten (kein „gesund/ungesund“, kein
 * Nutri-Score, E4-G9). Bei „Kalorienzahlen aus“ keine kcal und keine Makros – Hinweise ohne Zahlen. Fehlertexte nennen
 * nie Nummer, Name oder Marke. Wird in `de.ts` unter `foodProduct` eingebunden.
 */
const U = USER_FOOD_PRODUCT_LIMITS;
const n = (value: number) => value.toLocaleString('de-DE');

export const deFoodProduct = {
  title: 'Produkt (Barcode)',
  open: 'Produkt (Barcode)',
  openHint:
    'Die Nummer unter dem Strichcode eintippen – Name und Nährwerte kommen von Open Food Facts.',
  consentNeeded:
    'Für Produkte brauchen wir deine Einwilligung in die Verarbeitung von Gesundheitsdaten – sie gehören zu deinem Ernährungstagebuch.',
  consentButton: 'Einwilligung erteilen',
  codeLabel: 'Nummer unter dem Strichcode',
  codeHint: 'Die 8 oder 13 Ziffern unter dem Strichcode',
  search: 'Produkt suchen',
  // Kamera (Etappe E4b, Plan 5): Bilder werden nie gespeichert oder gesendet – nur die Nummer.
  scan: {
    button: 'Mit der Kamera scannen',
    title: 'Strichcode scannen',
    starting: 'Kamera startet …',
    hint: 'Halte den Strichcode in den Rahmen – er wird automatisch erkannt.',
    privacy:
      'Die Kamerabilder bleiben auf deinem Gerät und werden nicht gespeichert – nur die Nummer zählt.',
    cancel: 'Abbrechen und Nummer eintippen',
    previewLabel: 'Kamera-Vorschau',
    denied: 'Ohne Kamera-Erlaubnis kannst du die Nummer eintippen.',
    deniedHowToWeb:
      'Erlaubnis ändern: In Chrome auf Android tippst du links neben der Adresse auf das Symbol → Berechtigungen → Kamera. Auf dem iPhone: Einstellungen → Chrome (bzw. Safari) → Kamera; danach die Seite neu laden.',
    deniedHowToApp: 'Erlaubnis ändern: Einstellungen → Alpha5 → Kamera.',
    openSettings: 'Einstellungen öffnen',
    unavailable:
      'Die Kamera ließ sich nicht starten (keine Kamera gefunden oder gerade von einer anderen App genutzt) – tipp die Nummer ein.',
  },
  searching: 'Suche Produkt …',
  invalidCode: 'Die Nummer stimmt nicht – bitte noch einmal abtippen.',
  notFoodCode:
    'Dieser Code gilt nur im Laden (z. B. Frischetheke) oder ist kein Lebensmittel – trag das Lebensmittel über die Suche ein.',
  notFound: 'Dieses Produkt kennen wir noch nicht.',
  blocked: 'Für dieses Produkt fehlen verlässliche Nährwerte.',
  offline:
    'Für die Produktabfrage brauchst du Internet. Eigene Produkte und die Suche gehen auch offline.',
  unavailable:
    'Open Food Facts ist gerade nicht erreichbar – versuch es in ein paar Minuten noch einmal oder leg ein eigenes Produkt an.',
  rateLimitedHour:
    'Du hast in der letzten Stunde sehr viele Produkte abgefragt – in einer Stunde geht es wieder. Eigene Produkte und die Suche gehen weiter.',
  rateLimitedDay:
    'Du hast heute sehr viele Produkte abgefragt – ab morgen geht es wieder. Eigene Produkte und die Suche gehen weiter.',
  notConfigured:
    'Die Produktabfrage ist noch nicht eingeschaltet. Eigene Produkte und die Suche gehen schon.',
  noConsent: 'Für die Produktabfrage fehlt die Einwilligung in Gesundheitsdaten.',
  failed: 'Das hat nicht geklappt – bitte gleich noch einmal versuchen.',
  createOwn: 'Eigenes Produkt anlegen',
  quickInstead: 'Schnelleintrag stattdessen',
  editValues: 'Werte ändern',
  lookUpAnyway: 'Stattdessen bei Open Food Facts nachsehen',
  ownFound: 'Dein eigenes Produkt mit dieser Nummer:',
  // Produktansicht
  per100: (unit: 'g' | 'ml') => (unit === 'ml' ? 'Je 100 ml' : 'Je 100 g'),
  nutrients: {
    kcal: 'Energie',
    protein_g: 'Eiweiß',
    carbs_g: 'Kohlenhydrate',
    sugar_g: 'davon Zucker',
    fat_g: 'Fett',
    sat_fat_g: 'davon gesättigte Fettsäuren',
    fiber_g: 'Ballaststoffe',
    salt_g: 'Salz',
  },
  missingValue: '–',
  numbersHidden: 'Nährwerte ausgeblendet („Kalorienzahlen aus“).',
  review: 'Werte prüfen: Die Angaben wirken nicht ganz stimmig.',
  reviewConfirm: 'Ich habe die Werte mit der Packung verglichen',
  reviewNeeded: 'Bitte vergleiche die Werte zuerst mit der Packung.',
  reasons: {
    energy_missing: 'Es fehlt die Angabe zur Energie.',
    macro_missing: 'Es fehlen Angaben zu Eiweiß, Kohlenhydraten oder Fett.',
    invalid_value: 'Mindestens ein Wert ist ungültig.',
    kcal_too_high: 'Die Energie-Angabe ist zu hoch für 100 g.',
    macro_too_high: 'Ein Nährwert ist höher als 100 g je 100 g.',
    macro_sum_too_high: 'Die Nährwerte ergeben zusammen mehr als 100 g je 100 g.',
    kj_kcal_mismatch: 'kJ und kcal passen nicht zusammen (vermutlich vertauscht).',
    prepared_only: 'Die Werte gelten nur für das zubereitete Produkt.',
    atwater_mismatch: 'Energie und Nährwerte passen nicht ganz zusammen.',
    kcal_from_kj: 'Die kcal sind aus kJ umgerechnet.',
    from_serving: 'Die Werte sind aus der Portionsangabe umgerechnet.',
    unit_assumed: 'Ob es um Gramm oder Milliliter geht, ist nicht angegeben – wir nehmen Gramm an.',
    sugar_over_carbs: 'Zucker ist höher angegeben als Kohlenhydrate.',
    sat_fat_over_fat: 'Gesättigte Fettsäuren sind höher angegeben als Fett.',
    upper_bound: 'Einige Werte sind als „weniger als“ angegeben.',
    serving_ignored: 'Die Portionsangabe ist unplausibel und wird nicht genutzt.',
  } satisfies Record<FoodProductCheckReason, string>,
  /** Bei „Zahlen aus“: Hinweise ohne Zahlen und ohne Nährwert-Namen. */
  reviewNoNumbers: 'Die Angaben wirken unvollständig – bitte mit der Packung vergleichen.',
  blockedNoNumbers: 'Die Angaben dieses Produkts sind nicht verlässlich.',
  oldData: (date: string) => `Angaben vom ${date} – bitte mit der Packung vergleichen.`,
  stale: (date: string) => `Stand vom ${date} (Open Food Facts gerade nicht erreichbar).`,
  allergenNote:
    'Wir prüfen Produkte nicht auf deine Unverträglichkeiten – lies die Zutatenliste auf der Packung.',
  source: (date: string) =>
    `Produktdaten: Open Food Facts (openfoodfacts.org), Lizenz ODbL 1.0 · abgerufen am ${date} · Angaben ohne Gewähr – bitte mit der Packung vergleichen.`,
  licenseLink: 'Mehr zur Lizenz',
  offLink: 'Bei Open Food Facts ansehen',
  offLinkTitle: 'App verlassen?',
  offLinkText: 'Dabei verlässt du die App; Open Food Facts sieht dann deine IP-Adresse.',
  offLinkConfirm: 'Weiter zu Open Food Facts',
  mockNote:
    'Testmodus: Antwort einer Attrappe mit ausgedachten Testwerten – keine Daten von Open Food Facts.',
  testCodesTitle: 'Testnummern (nur im Testmodus)',
  // Menge
  amountLabel: (unit: 'g' | 'ml') => (unit === 'ml' ? 'Menge in ml' : 'Menge in g'),
  amountInvalid: 'Bitte eine Menge von 1 bis 2.000 eingeben.',
  choice: {
    half: (amount: string, unit: string) => `½ Portion (${amount} ${unit})`,
    serving: (amount: string, unit: string) => `1 Portion (${amount} ${unit})`,
    double: (amount: string, unit: string) => `2 Portionen (${amount} ${unit})`,
    package: (amount: string, unit: string) => `ganze Packung (${amount} ${unit})`,
  },
  add: 'Eintragen',
  cancel: 'Abbrechen',
  saved: 'Eingetragen.',
  savedFavorite: 'Als Favorit merken',
  // Eigene Produkte
  ownTitle: 'Eigene Produkte',
  ownIntro:
    'Produkte, die Open Food Facts nicht kennt oder deren Werte nicht stimmen – mit den Werten von der Packung.',
  ownPrivacy:
    'Deine Angaben – nur für dich sichtbar. Widerrufst du die Einwilligung in Gesundheitsdaten, werden sie gelöscht.',
  ownEmpty: 'Noch keine eigenen Produkte.',
  ownCount: (count: number) => `${count} von ${n(U.maxProducts)} Produkten`,
  ownLimit: `Du hast schon ${n(U.maxProducts)} eigene Produkte. Lösche zuerst eines, um ein neues anzulegen.`,
  ownCreate: 'Neues Produkt anlegen',
  ownEditTitle: 'Eigenes Produkt ändern',
  ownCreateTitle: 'Eigenes Produkt anlegen',
  ownNumbersOff:
    'Bei „Kalorienzahlen aus“ lassen sich keine eigenen Produkte anlegen (dafür müsstest du Werte eintippen). Trag das Produkt als Schnelleintrag ein oder schalte die Zahlen kurz ein.',
  ownUse: 'Eintragen',
  ownEdit: 'Ändern',
  ownDelete: 'Löschen',
  ownDeleteA11y: (name: string) => `${name} löschen`,
  ownEditA11y: (name: string) => `${name} ändern`,
  ownUseA11y: (name: string) => `${name} eintragen`,
  ownDeleteTitle: 'Produkt löschen?',
  ownDeleteText:
    'Das Produkt wird gelöscht. Bereits eingetragene Tage behalten ihre Werte und heißen dann „Eigenes Produkt“.',
  ownDeleted: 'Produkt gelöscht.',
  ownSaved: 'Produkt gespeichert.',
  ownConsentMissing:
    'Ohne gültige Einwilligung in Gesundheitsdaten kannst du eigene Produkte nur löschen.',
  field: {
    name: 'Name',
    nameHint: `1–${U.nameMaxChars} Zeichen`,
    brand: 'Marke (freiwillig)',
    brandHint: `Höchstens ${U.brandMaxChars} Zeichen`,
    code: 'Nummer unter dem Strichcode (freiwillig)',
    unit: 'Angaben je',
    unitG: '100 g',
    unitMl: '100 ml',
    kcal: 'Energie (kcal)',
    protein: 'Eiweiß (g)',
    carbs: 'Kohlenhydrate (g)',
    sugar: 'davon Zucker (g, freiwillig)',
    fat: 'Fett (g)',
    salt: 'Salz (g, freiwillig)',
    serving: 'Portion in g bzw. ml (freiwillig)',
  },
  fieldInvalid: {
    name: 'Bitte einen Namen mit 1 bis 60 Zeichen eingeben.',
    brand: 'Die Marke darf höchstens 40 Zeichen haben.',
    code: 'Die Nummer stimmt nicht – bitte noch einmal abtippen.',
    kcal: `Bitte ganze kcal von 0 bis ${n(U.kcal.max)} eingeben.`,
    per100: 'Bitte einen Wert von 0 bis 100 mit höchstens einer Nachkommastelle eingeben.',
    serving: 'Bitte eine Portion von 1 bis 2.000 eingeben.',
    sum: 'Diese Werte sind zusammen mehr als 100 g je 100 g – bitte prüfen.',
  },
  ownConfirmTitle: 'Stimmen die Werte?',
  ownConfirmText:
    'Energie und Nährwerte passen nicht ganz zusammen. Bitte mit der Packung vergleichen.',
  ownConfirmYes: 'Werte stimmen',
  save: 'Speichern',
  errors: {
    unavailable:
      'Dieses Produkt ist nicht mehr im Zwischenspeicher – bitte das Produkt neu abrufen und noch einmal eintragen.',
    limit: `Höchstens ${n(U.maxProducts)} eigene Produkte.`,
    productLimit:
      'Du hast in letzter Zeit sehr viele Produkte abgefragt bzw. eingetragen – in einer Stunde (bzw. ab morgen) geht es wieder. Eigene Produkte und die Suche gehen weiter.',
    rejected: 'Das Produkt konnte nicht gespeichert werden – bitte die Angaben prüfen.',
  },
  // Lizenzen und Quellen (Einstellungen)
  licenses: {
    title: 'Lizenzen und Quellen',
    open: 'Lizenzen und Quellen',
    blsTitle: 'Nährwerte unseres Lebensmittel-Katalogs',
    bls: 'Nährwerte: Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut, Lizenz CC BY 4.0 (creativecommons.org/licenses/by/4.0); umgerechnet und gerundet.',
    offTitle: 'Produktdaten von Open Food Facts',
    off: 'Diese App enthält Informationen aus Open Food Facts (openfoodfacts.org), die unter der Open Database License (ODbL 1.0, opendatacommons.org/licenses/odbl/1-0/) bereitgestellt werden. Einzelne Inhalte stehen unter der Database Contents License (DbCL 1.0, opendatacommons.org/licenses/dbcl/1-0/).',
    methodTitle: 'Methode unserer Änderungen',
    method:
      'Wir übernehmen die Werte je 100 g/ml unverändert und rechnen nur so um: kJ → kcal (÷ 4,184), Natrium → Salz (× 2,5), Portionswerte → je 100 g, Runden auf ganze kcal und 0,1 g; Texte werden gekürzt und von Steuerzeichen bereinigt. Die Original-Daten erhältst du bei Open Food Facts (world.openfoodfacts.org/data).',
    images: 'Produktbilder von Open Food Facts zeigen wir nicht.',
    draft: 'Entwurf – Wortlaut wird vor dem Start rechtlich geprüft.',
  },
} as const;
