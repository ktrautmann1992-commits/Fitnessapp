import { SHOPPING_CATEGORY_LABELS_DE } from '@fitnessapp/core';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/access';
import { isContentId } from '@/lib/admin/catalog';
import { getNutritionAdmin } from '@/lib/admin/data';
import {
  ANIMAL_LABELS,
  foodGroupLabel,
  formatDateDe,
  formatNumberDe,
  MEAT_KIND_LABELS,
} from '@/lib/admin/labels';

import { AdminHeader } from '../../_components/AdminHeader';
import { AdminNav } from '../../_components/AdminNav';
import { ContentBadges } from '../../_components/Badges';
import { CatalogChecklist } from '../../_components/CatalogChecklist';
import { IssueReport } from '../../_components/IssueReport';
import { OriginSection } from '../../_components/Origin';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

const yesNo = (value: boolean) => (value ? 'ja' : 'nein');
const grams = (value: number | null | undefined) =>
  value === null || value === undefined ? 'nicht bestimmt' : `${formatNumberDe(value)} g`;

/** Lebensmittel mit allen Angaben, die die Checkliste der Katalog-Prüfung (R19) braucht – nur ansehen. */
export default async function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = getNutritionAdmin();
  const entry = isContentId(id) ? admin.foodById.get(id) : undefined;
  if (!entry) {
    notFound();
  }
  const { food } = entry;
  const n = food.nutrients_per_100g;
  const missingExpected =
    entry.expectedGroups === null
      ? []
      : entry.expectedGroups.filter((group) => !(food.groups as readonly string[]).includes(group));

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="lebensmittel" />
        <Link className={styles.backLink} href="/admin/lebensmittel">
          ← Alle Lebensmittel
        </Link>
        <div>
          <h1 className={styles.title}>{food.name_de}</h1>
          <p className={styles.subtitle}>
            {food.aliases_de.length > 0 ? `auch: ${food.aliases_de.join(', ')}` : food.id}
          </p>
        </div>
        <ContentBadges
          status={food.status}
          needsExpertReview={entry.needsExpertReview}
          summary={entry.summary}
        />
        <p className={entry.catalogReviewed ? styles.noticeOk : styles.noticeWarning} role="note">
          {entry.catalogReviewed
            ? `Katalog-geprüft von ${food.meta.catalog_reviewed_by ?? ''} am ${formatDateDe(food.meta.catalog_reviewed_at ?? '')}.`
            : 'Katalog-Prüfung offen – Rezepte mit diesem Lebensmittel sind nicht nutzbar (auch nicht im Testmodus).'}
        </p>

        <IssueReport issues={entry.issues} />

        <section className={styles.section} aria-labelledby="pruefpunkte">
          <h2 id="pruefpunkte" className={styles.h2}>
            Angaben zur Katalog-Prüfung
          </h2>
          <dl className={styles.facts}>
            <dt>1. Quelle</dt>
            <dd>
              {food.source.db.toUpperCase()} {food.source.version}, Quell-ID{' '}
              <span className={styles.code}>{food.source.ref}</span> – „{food.source.name}“ (
              {food.source.category}) · Lizenz {food.source.license} · abgerufen{' '}
              {formatDateDe(food.source.retrieved_at)}
            </dd>
            <dt>2. Gruppen</dt>
            <dd>
              {food.groups.length === 0 ? 'keine' : food.groups.map(foodGroupLabel).join(', ')}
              <br />
              <span className={styles.small}>
                Erwartungsliste:{' '}
                {entry.expectedGroups === null
                  ? 'kein Eintrag'
                  : entry.expectedGroups.length === 0
                    ? 'keine Gruppen'
                    : entry.expectedGroups.map(foodGroupLabel).join(', ')}
                {missingExpected.length > 0
                  ? ` – fehlt am Lebensmittel: ${missingExpected.map(foodGroupLabel).join(', ')}`
                  : ''}
              </span>
            </dd>
            <dt>3. Tierisch</dt>
            <dd>
              {food.animal.length === 0
                ? 'pflanzlich'
                : food.animal.map((kind) => ANIMAL_LABELS[kind]).join(', ')}
              {food.meat_kind.length > 0
                ? ` · Tierart: ${food.meat_kind.map((kind) => MEAT_KIND_LABELS[kind]).join(', ')}`
                : ''}
              {food.gelatin_origin ? ` · Gelatine: ${food.gelatin_origin}` : ''}
            </dd>
            <dt>4. Schwangerschafts-Hinweis</dt>
            <dd>{yesNo(food.pregnancy_caution)}</dd>
            <dt>5. Ersatzprodukte</dt>
            <dd>
              {food.substitutes.length === 0
                ? 'keine'
                : food.substitutes
                    .map(
                      (s) =>
                        `${admin.foodById.get(s.food_id)?.food.name_de ?? `${s.food_id} (fehlt)`} für ${s.for_groups.map(foodGroupLabel).join(', ')}`,
                    )
                    .join(' · ')}
            </dd>
            <dt>6. Haltbarkeit</dt>
            <dd>
              {food.max_fridge_days} Tage Kühlschrank · einfrierbar: {yesNo(food.freezable)}
            </dd>
            <dt>7. Salz je 100 g</dt>
            <dd>
              {grams(n.salt_g)} · Einkauf: {SHOPPING_CATEGORY_LABELS_DE[food.shopping_category]}
            </dd>
            <dt>Alkohol</dt>
            <dd>{yesNo(food.alcohol)}</dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="naehrwerte">
          <h2 id="naehrwerte" className={styles.h2}>
            Nährwerte je 100 g (aus der Quelle)
          </h2>
          <dl className={styles.facts}>
            <dt>Energie</dt>
            <dd>{formatNumberDe(n.kcal)} kcal</dd>
            <dt>Eiweiß</dt>
            <dd>{grams(n.protein_g)}</dd>
            <dt>Kohlenhydrate</dt>
            <dd>{grams(n.carbs_g)}</dd>
            <dt>davon Zucker</dt>
            <dd>{grams(n.sugar_g)}</dd>
            <dt>Fett</dt>
            <dd>{grams(n.fat_g)}</dd>
            <dt>gesättigte Fettsäuren</dt>
            <dd>{grams(n.sat_fat_g)}</dd>
            <dt>Ballaststoffe</dt>
            <dd>{grams(n.fiber_g)}</dd>
            <dt>Salz</dt>
            <dd>{grams(n.salt_g)}</dd>
          </dl>
          <p className={styles.small}>
            Einheiten:{' '}
            {[
              food.units.piece_g !== undefined
                ? `1 Stück = ${formatNumberDe(food.units.piece_g)} g`
                : null,
              food.units.tbsp_g !== undefined
                ? `1 EL = ${formatNumberDe(food.units.tbsp_g)} g`
                : null,
              food.units.tsp_g !== undefined
                ? `1 TL = ${formatNumberDe(food.units.tsp_g)} g`
                : null,
              food.units.ml_to_g !== undefined
                ? `1 ml = ${formatNumberDe(food.units.ml_to_g)} g`
                : null,
            ]
              .filter((text) => text !== null)
              .join(' · ') || 'keine (nur Gramm)'}
          </p>
        </section>

        <section className={styles.section} aria-labelledby="verwendet">
          <h2 id="verwendet" className={styles.h2}>
            In Rezepten ({entry.usedIn.length})
          </h2>
          {entry.usedIn.length === 0 ? (
            <p className={styles.muted}>In keinem Rezept.</p>
          ) : (
            <ul className={styles.list}>
              {entry.usedIn.map((recipe) => (
                <li key={recipe.id}>
                  <Link className={styles.link} href={`/admin/rezepte/${recipe.id}`}>
                    {recipe.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CatalogChecklist />
        <OriginSection meta={food.meta} version={food.version} />
      </main>
    </>
  );
}
