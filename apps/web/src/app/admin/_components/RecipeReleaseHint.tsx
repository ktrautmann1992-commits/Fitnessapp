import styles from '../admin.module.css';

/**
 * Freigabe von Rezepten (docs/PLAN-PHASE-5.md 19.5, Etappe N2d): über den Workflow content-review in der GitHub-App –
 * pro Kategorie (Art „recipe“) oder einzeln per ID (Art „ids“, z. B. für Rezepte ohne Kategorie). Der
 * Redaktionsbereich selbst schreibt nichts.
 */
export function RecipeReleaseHint({
  category,
  withoutCategory = false,
}: {
  category?: { id: string; name: string };
  withoutCategory?: boolean;
}) {
  return (
    <section className={styles.section} aria-labelledby="sammelfreigabe">
      <h2 id="sammelfreigabe" className={styles.h2}>
        {withoutCategory
          ? 'Freigabe per ID (ohne Kategorie)'
          : `Sammelfreigabe ${category ? `„${category.name}“` : 'pro Kategorie'}`}
      </h2>
      <p>
        Freigeben = in der GitHub-App den Workflow <strong>content-review</strong> starten und den
        Pull Request mergen. Hier wird nichts geändert.
      </p>
      <ol className={styles.list}>
        <li>
          GitHub-App → Repository → <strong>Actions</strong> → <strong>content-review</strong> →{' '}
          <strong>Run workflow</strong>.
        </li>
        {withoutCategory ? (
          <li>
            <strong>Art</strong>: <em>ids</em> · <strong>IDs</strong>: die IDs der Rezepte (stehen
            unten auf der Rezept-Seite, mit Komma getrennt) · <strong>Neuer Status</strong>:{' '}
            <em>published</em> · <strong>Wer hat geprüft?</strong>: euer Kürzel.
          </li>
        ) : (
          <>
            <li>
              <strong>Art</strong>: <em>recipe</em> · <strong>Neuer Status</strong>:{' '}
              <em>published</em> · <strong>Wer hat geprüft?</strong>: euer Kürzel.
            </li>
            <li>
              <strong>Kategorie</strong>:{' '}
              {category ? (
                <span className={styles.code}>{category.id}</span>
              ) : (
                'die gewünschte Kategorie'
              )}
              .
            </li>
          </>
        )}
        <li>
          Häkchen <strong>fachlich geprüft</strong> nur, wenn eine Fachperson die Rezepte geprüft
          hat. Häkchen <strong>Import-Annahmen geprüft</strong> nur, wenn ihr bei den Rezepten mit
          offener Annahme „durchgegart“ die Zubereitung gelesen habt (bestätigt die Annahme, der
          Schwangerschafts-Hinweis wird neu berechnet). Wird die Zubereitung später geändert, gilt
          die Bestätigung nicht mehr.
        </li>
        <li>
          <strong>Run workflow</strong>. Der Workflow gibt nur Entwürfe frei, die keinen roten
          Befund haben, nur katalog-geprüfte und freigegebene Lebensmittel nutzen und keine offene
          Annahme haben. Übersprungene stehen mit Grund im Pull Request.
        </li>
        <li>
          Ist <strong>ci</strong> grün und passt alles: Pull Request <strong>mergen</strong> – erst
          das ist die Freigabe.
        </li>
      </ol>
      <p className={styles.small}>
        Für den Livegang (ab N7) Rezepte nur mit „fachlich geprüft“ freigeben.{' '}
        {withoutCategory
          ? 'Rezepte ohne Kategorie erreicht die Sammelfreigabe nie – nur dieser Weg.'
          : 'Rezepte ohne Kategorie gibt es nur einzeln per ID frei (Art „ids“).'}
      </p>
    </section>
  );
}

/**
 * Freigabe von Meal-Prep-Plänen, Ratgebern, Austausch-Einträgen und Packungsgrößen per ID (Gründer-Entscheidung
 * 14.10.2026, Wächter-Empfehlung; Austausch seit Etappe N9, Packungsgrößen seit N11).
 */
export function IdReleaseHint({
  kind,
}: {
  kind: 'meal_prep_plan' | 'guide' | 'ingredient_substitution' | 'package_size';
}) {
  return (
    <section className={styles.section} aria-labelledby="freigabe-per-id">
      <h2 id="freigabe-per-id" className={styles.h2}>
        Freigabe per ID
      </h2>
      <ol className={styles.list}>
        <li>
          GitHub-App → Repository → <strong>Actions</strong> → <strong>content-review</strong> →{' '}
          <strong>Run workflow</strong>.
        </li>
        <li>
          <strong>Art</strong>: <em>ids</em> · <strong>IDs</strong>: die ID (steht unter dem Titel)
          · <strong>Neuer Status</strong>: <em>published</em> · <strong>Wer hat geprüft?</strong>:
          euer Kürzel.
        </li>
        <li>
          {kind === 'meal_prep_plan'
            ? 'Freigegeben wird ein Plan nur, wenn alle seine Rezepte danach freigegeben sind (schon vorher oder im selben Lauf – dann die Rezept-IDs mit angeben) und kein roter Befund bleibt (Aufbewahrung nach R9/R20).'
            : kind === 'guide'
              ? 'Freigegeben wird ein Ratgeber nur ohne roten Befund (u. a. Health-Claims-Textregeln).'
              : kind === 'package_size'
                ? 'Freigegeben wird eine Packungsgröße nur ohne roten Befund (R24: Lebensmittel freigegeben und katalog-geprüft, 1–5.000 g, nicht kleiner als ein Stück, je Lebensmittel ein Eintrag). Bitte die Grammzahl mit einer üblichen Packung im Laden vergleichen.'
                : 'Freigegeben wird ein Austausch nur ohne roten Befund (R23: beide Lebensmittel freigegeben und katalog-geprüft, Faktor hält die Messgröße der Rolle ±10 %, kein Alkohol; Hinweis-Text ohne Heilversprechen).'}
        </li>
        <li>
          Ist <strong>ci</strong> grün: Pull Request <strong>mergen</strong> – erst das ist die
          Freigabe.
        </li>
      </ol>
      <p className={styles.small}>
        Für den Livegang (ab N7) nur mit Häkchen „fachlich geprüft“. Lebensmittel laufen nicht über
        diesen Weg (Katalog-Prüfung).
      </p>
    </section>
  );
}
