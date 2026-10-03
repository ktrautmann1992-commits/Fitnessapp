import styles from '../admin.module.css';
import { CopyButton } from './CopyButton';

/**
 * Freigeben in Stufe A: per Workflow content-review in der GitHub-App (docs/PLAN-PHASE-2.md Abschnitt 6,
 * „Freigeben und Bearbeiten“). Der Redaktionsbereich selbst schreibt nichts.
 */
export function ReleaseHint({ ids, scope }: { ids: readonly string[]; scope: string }) {
  const text = ids.join(', ');
  return (
    <section className={styles.section} aria-labelledby="freigeben">
      <h2 id="freigeben" className={styles.h2}>
        Freigeben
      </h2>
      <p>
        Freigeben = in der GitHub-App den Workflow <strong>content-review</strong> starten bzw. den
        Pull Request mergen. Hier im Redaktionsbereich wird nichts geändert.
      </p>
      <ol className={styles.list}>
        <li>Unten die IDs kopieren.</li>
        <li>
          GitHub-App → Repository → <strong>Actions</strong> → <strong>content-review</strong> →{' '}
          <strong>Run workflow</strong>.
        </li>
        <li>
          <strong>IDs</strong> einfügen, <strong>Neuer Status</strong> wählen (<em>published</em> =
          freigeben, <em>archived</em> = zurückziehen, <em>draft</em> = zurück auf Entwurf), bei{' '}
          <strong>Wer hat geprüft?</strong> euer Kürzel → <strong>Run workflow</strong>.
        </li>
        <li>
          Der Workflow prüft alles und öffnet einen Pull Request. Ist <strong>ci</strong> grün und
          passt die Vorschau, den Pull Request <strong>mergen</strong> – erst das ist die Freigabe.
        </li>
      </ol>
      <p className={styles.small}>
        Rote Fehler blockieren die Freigabe. Inhalte mit „KI-Entwurf – fachlich prüfen“ vor dem
        öffentlichen Start zusätzlich von einer Fachperson prüfen lassen.
      </p>
      {ids.length === 0 ? (
        <p className={styles.muted}>Keine IDs in dieser Auswahl.</p>
      ) : (
        <div className={styles.stack}>
          <label className={styles.label} htmlFor="ids-zum-kopieren">
            {scope} ({ids.length})
          </label>
          <textarea
            id="ids-zum-kopieren"
            className={styles.idBox}
            readOnly
            value={text}
            rows={Math.min(6, ids.length + 1)}
          />
          <CopyButton text={text} label={ids.length === 1 ? 'ID kopieren' : 'IDs kopieren'} />
        </div>
      )}
    </section>
  );
}
