import {
  RECIPE_CATEGORIES,
  RECIPE_UNIT_LABELS_DE,
  recipeReleaseBlockerText,
} from '@fitnessapp/core';
import Link from 'next/link';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/access';
import { isContentId } from '@/lib/admin/catalog';
import { getNutritionAdmin } from '@/lib/admin/data';
import {
  DIET_LABELS,
  foodGroupLabel,
  formatNumberDe,
  MEAL_TYPE_LABELS,
  NUTRIENT_FIELD_LABELS,
  pregnancyReasonLabel,
  TRAINING_TAG_LABELS,
} from '@/lib/admin/labels';

import { AdminHeader } from '../../_components/AdminHeader';
import { AdminNav } from '../../_components/AdminNav';
import { ContentBadges } from '../../_components/Badges';
import { IssueReport } from '../../_components/IssueReport';
import { AiDraftNotice, OriginSection } from '../../_components/Origin';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

const yesNo = (value: boolean) => (value ? 'ja' : 'nein');

/** Rezept im Redaktionsbereich (Etappe N2d) – nur ansehen. */
export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = getNutritionAdmin();
  const entry = isContentId(id) ? admin.recipeById.get(id) : undefined;
  if (!entry) {
    notFound();
  }
  const { recipe, facts } = entry;
  const categories = (recipe.categories ?? []).map(
    (cid) => RECIPE_CATEGORIES.find((c) => c.id === cid)?.name_de ?? cid,
  );
  const assumptions = recipe.meta.import_assumptions ?? [];
  const confirmedBy = recipe.meta.import_assumptions_confirmed_by ?? null;

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="rezepte" />
        <Link className={styles.backLink} href="/admin/rezepte">
          ← Alle Kategorien
        </Link>
        <div>
          <h1 className={styles.title}>{recipe.title_de}</h1>
          <p className={styles.subtitle}>
            {categories.length > 0 ? categories.join(' · ') : 'ohne Kategorie'}
          </p>
        </div>
        <ContentBadges
          status={recipe.status}
          needsExpertReview={entry.needsExpertReview}
          summary={entry.summary}
        />

        <section
          className={entry.blockers.length === 0 ? styles.noticeOk : styles.noticeWarning}
          aria-labelledby="freigabe"
        >
          <h2 id="freigabe" className={styles.h2}>
            {entry.releasePath === 'ids' ? 'Freigabe per ID' : 'Sammelfreigabe'}
          </h2>
          {entry.releasePath === 'ids' && (
            <p>
              Ohne Kategorie – über die Sammelfreigabe nicht erreichbar. Freigabe nur einzeln:
              content-review mit Art <em>ids</em> und der ID{' '}
              <span className={styles.code}>{recipe.id}</span> (gleiche Regeln und Häkchen).
            </p>
          )}
          {entry.blockers.length === 0 ? (
            <p>
              {entry.releasePath === 'ids'
                ? 'Würde bei der Freigabe per ID freigegeben.'
                : 'Würde bei der Sammelfreigabe seiner Kategorie freigegeben.'}
            </p>
          ) : (
            <>
              <p>Wird übersprungen:</p>
              <ul className={styles.list}>
                {entry.blockers.map((blocker) => (
                  <li key={blocker.kind}>{recipeReleaseBlockerText(blocker)}</li>
                ))}
              </ul>
              {entry.blockersWithConfirm.length === 0 && (
                <p className={styles.small}>
                  Mit dem Häkchen „Import-Annahmen geprüft“ würde es freigegeben.
                </p>
              )}
            </>
          )}
        </section>

        <IssueReport issues={entry.issues} />
        <AiDraftNotice show={entry.needsExpertReview} />

        <section className={styles.section} aria-labelledby="ansicht">
          <h2 id="ansicht" className={styles.h2}>
            So steht es später in der App
          </h2>
          <p>{recipe.description_de}</p>
          <h3 className={styles.h3}>
            Zutaten ({recipe.servings} {recipe.servings === 1 ? 'Portion' : 'Portionen'})
          </h3>
          <ul className={styles.list}>
            {recipe.ingredients.map((ingredient, index) => {
              const food = admin.foodById.get(ingredient.food_id);
              const amount =
                ingredient.display_de ??
                `${formatNumberDe(ingredient.amount)} ${RECIPE_UNIT_LABELS_DE[ingredient.unit]}`;
              return (
                <li key={`${ingredient.food_id}-${index}`}>
                  {amount}{' '}
                  {food ? (
                    <Link className={styles.link} href={`/admin/lebensmittel/${food.food.id}`}>
                      {food.food.name_de}
                    </Link>
                  ) : (
                    <span className={styles.code}>{ingredient.food_id} (fehlt im Katalog)</span>
                  )}
                  {ingredient.optional ? ' (optional)' : ''}
                  {ingredient.note_de ? ` – ${ingredient.note_de}` : ''}
                  <span className={`${styles.small} ${styles.muted}`}>
                    {food && !food.catalogReviewed ? ' · nicht katalog-geprüft' : ''}
                    {ingredient.heated === true ? ' · durchgegart' : ''}
                    {ingredient.heated === false ? ' · nicht durchgegart' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          <h3 className={styles.h3}>Zubereitung</h3>
          <ol className={styles.list}>
            {recipe.steps_de.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {recipe.tip_de && (
            <>
              <h3 className={styles.h3}>Tipp</h3>
              <p>{recipe.tip_de}</p>
            </>
          )}
        </section>

        <section className={styles.section} aria-labelledby="annahmen">
          <h2 id="annahmen" className={styles.h2}>
            Import-Annahmen „durchgegart“ ({assumptions.length})
          </h2>
          {assumptions.length === 0 ? (
            <p className={styles.muted}>Keine.</p>
          ) : (
            <>
              <p>
                {entry.assumptionsState === 'open'
                  ? 'Noch nicht bestätigt – zählt für die Schwangerschaft wie „nicht durchgegart“.'
                  : entry.assumptionsState === 'changed'
                    ? `Bestätigt von ${confirmedBy ?? '–'}, aber die Zubereitung (Zutaten, Schritte, Tipp, Zeiten, Titel, Beschreibung oder Geräte) seitdem geändert (Fingerabdruck passt nicht) – zählt wieder wie „nicht durchgegart“, bitte erneut bestätigen.`
                    : `Bestätigt von ${confirmedBy ?? '–'} (Fingerabdruck passt zur Zubereitung).`}
              </p>
              <ul className={styles.list}>
                {assumptions.map((assumption) => (
                  <li key={assumption.ingredient_index}>
                    <span className={styles.code}>{assumption.food_id}</span>:{' '}
                    {assumption.reason_de}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.section} aria-labelledby="berechnet">
          <h2 id="berechnet" className={styles.h2}>
            Berechnet aus den Zutaten
          </h2>
          {facts.nutrientsComplete ? (
            <dl className={styles.facts}>
              {(['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).map((key) => (
                <Fragment key={key}>
                  <dt>{NUTRIENT_FIELD_LABELS[key]} je Portion</dt>
                  <dd>
                    {formatNumberDe(facts.perServing[key])} (deklariert{' '}
                    {formatNumberDe(recipe.declared_per_serving[key])})
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <p className={styles.muted}>
              Nicht vollständig berechenbar (Lebensmittel fehlt oder Einheit nicht umrechenbar).
            </p>
          )}
          <dl className={styles.facts}>
            <dt>Ernährungsform</dt>
            <dd>
              {DIET_LABELS[facts.diet]} (deklariert {DIET_LABELS[recipe.declared_diet]})
            </dd>
            <dt>Allergene/Unverträglichkeiten</dt>
            <dd>
              {facts.allergens.length === 0 ? '–' : facts.allergens.map(foodGroupLabel).join(', ')}
            </dd>
            <dt>Schwein</dt>
            <dd>{yesNo(facts.containsPork)}</dd>
            <dt>Schwangerschafts-Hinweis</dt>
            <dd>
              {yesNo(facts.pregnancyCaution)} (deklariert {yesNo(recipe.declared_pregnancy_caution)}
              )
              {facts.pregnancyReasons.length > 0
                ? ` – ${facts.pregnancyReasons.map(pregnancyReasonLabel).join('; ')}`
                : ''}
            </dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="abweichungen">
          <h2 id="abweichungen" className={styles.h2}>
            Abweichungen aus dem Import-Bericht ({entry.deviations.length})
          </h2>
          <p className={styles.small}>
            Gründer-Datei (deklariert) gegen berechnet je Portion, über 3 %. Maßgeblich sind die
            berechneten Werte.
          </p>
          {entry.deviations.length === 0 ? (
            <p className={styles.muted}>
              {facts.nutrientsComplete
                ? 'Keine.'
                : 'Nicht prüfbar (nicht vollständig berechenbar).'}
            </p>
          ) : (
            <ul className={styles.list}>
              {entry.deviations.map((deviation) => (
                <li key={deviation.field}>
                  {NUTRIENT_FIELD_LABELS[deviation.field]}: deklariert{' '}
                  {formatNumberDe(deviation.file)}, berechnet {formatNumberDe(deviation.source)} (
                  {formatNumberDe(deviation.relative * 100)} %)
                  {deviation.level === 'review' ? ' – Zuordnung prüfen' : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="steckbrief">
          <h2 id="steckbrief" className={styles.h2}>
            Steckbrief
          </h2>
          <dl className={styles.facts}>
            <dt>ID</dt>
            <dd className={styles.code}>{recipe.id}</dd>
            <dt>Mahlzeit</dt>
            <dd>{recipe.meal_types.map((type) => MEAL_TYPE_LABELS[type]).join(', ')}</dd>
            <dt>Training</dt>
            <dd>
              {recipe.training_tags.length === 0
                ? '–'
                : recipe.training_tags.map((tag) => TRAINING_TAG_LABELS[tag]).join(', ')}
            </dd>
            {recipe.section_de && (
              <>
                <dt>Abschnitt</dt>
                <dd>{recipe.section_de}</dd>
              </>
            )}
            <dt>Zeit</dt>
            <dd>
              {recipe.total_minutes !== undefined ? `${recipe.total_minutes} Min. gesamt · ` : ''}
              {recipe.prep_minutes} Min. Vorbereitung · {recipe.cook_minutes} Min. Kochen
            </dd>
            <dt>Meal-Prep</dt>
            <dd>
              {recipe.meal_prep.suitable
                ? `geeignet, ${recipe.meal_prep.fridge_days} Tage Kühlschrank${recipe.meal_prep.freezable ? ', einfrierbar' : ''}`
                : 'nicht geeignet'}
            </dd>
            {recipe.meta.source_file && (
              <>
                <dt>Quelle</dt>
                <dd className={styles.code}>{recipe.meta.source_file}</dd>
              </>
            )}
          </dl>
        </section>

        <OriginSection meta={recipe.meta} version={recipe.version} />
      </main>
    </>
  );
}
