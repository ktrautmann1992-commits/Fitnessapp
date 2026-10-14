import styles from '../admin.module.css';

/**
 * Checkliste der menschlichen Katalog-Prüfung (Regel R19, docs/PLAN-PHASE-5.md 5.1.1 d). Erst danach sind Rezepte
 * mit diesem Lebensmittel nutzbar – auch im Testmodus.
 */
export const CATALOG_CHECKLIST: readonly string[] = [
  'Quell-ID passt zum Produkt (Bezeichnung in der Quelle vergleichen).',
  'Gruppen vollständig (Allergene/Unverträglichkeiten = Erwartungsliste).',
  'Tierische Bestandteile und Tierart (Fleischart, Gelatine-Herkunft).',
  'Schwangerschafts-Hinweis (z. B. Rohmilch, Rohwurst, Räucherfisch, Leber).',
  'Ersatzprodukte: nur für Gruppen, die das Ersatzprodukt wirklich nicht enthält.',
  'Haltbarkeit im Kühlschrank (Tage) und einfrierbar.',
  'Salz bei Aufschnitt und verarbeiteter Ware: Die Quelle ist oft ungesalzenes, gegartes Fleisch – Handelsware hat 1,5–2,5 g Salz je 100 g.',
  'Zeilen mit Lesart oder 🟡 im Gegencheck des Imports (Bericht von foods-import) zuerst ansehen.',
];

export function CatalogChecklist() {
  return (
    <section className={styles.section} aria-labelledby="checkliste">
      <h2 id="checkliste" className={styles.h2}>
        Checkliste Katalog-Prüfung (R19)
      </h2>
      <ol className={styles.list}>
        {CATALOG_CHECKLIST.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <p className={styles.small}>
        „Katalog geprüft“ setzt nur der Workflow <strong>content-review</strong> mit der Option
        „Katalog geprüft“ (Merge durch einen Menschen). Diese Option kommt mit Etappe N2b Teil 2 –
        bis dahin hier nur ansehen.
      </p>
    </section>
  );
}
