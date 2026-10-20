import { CATALOG_CHECKLIST } from '@fitnessapp/core';

import styles from '../admin.module.css';

/**
 * Checkliste der menschlichen Katalog-Prüfung (Regel R19, docs/PLAN-PHASE-5.md 5.1.1 d). Erst danach sind Rezepte
 * mit diesem Lebensmittel nutzbar – auch im Testmodus. Der Text steht in packages/core (`CATALOG_CHECKLIST`), damit
 * Redaktionsbereich und Workflow content-review dieselbe Liste zeigen (Wächter N2d K6).
 */
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
        „Katalog geprüft“ setzt nur der Workflow <strong>content-review</strong> mit Art{' '}
        <strong>katalog</strong> (IDs der Lebensmittel oder „rezepte“, Prüfer = Name). Er öffnet
        einen Pull Request; wirksam erst mit dem Merge durch einen Menschen.
      </p>
    </section>
  );
}
