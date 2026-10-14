import { SHOPPING_CATEGORY_LABELS_DE } from '@fitnessapp/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';
import { getNutritionAdmin } from '@/lib/admin/data';
import { filterFoods, parseFoodFilters } from '@/lib/admin/nutrition';

import { AdminHeader } from '../_components/AdminHeader';
import { AdminNav } from '../_components/AdminNav';
import { ContentBadges } from '../_components/Badges';
import { CatalogChecklist } from '../_components/CatalogChecklist';
import { DisabledNotice } from '../_components/DisabledNotice';
import { IssueReport } from '../_components/IssueReport';
import { NutritionNotices } from '../_components/NutritionNotices';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Lebensmittel-Katalog (docs/PLAN-PHASE-5.md 13 N2d, R19) – nur ansehen, Checkliste der Katalog-Prüfung. */
export default async function FoodsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }

  const filters = parseFoodFilters(await searchParams);
  const admin = getNutritionAdmin();
  const shown = filterFoods(admin.foods, filters);
  const reviewed = admin.foods.filter((entry) => entry.catalogReviewed).length;
  const active = filters.q !== undefined || filters.pruefung !== undefined;
  const listIssues = admin.libraryIssues.filter((issue) => issue.kind === 'food');

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="lebensmittel" />
        <div>
          <h1 className={styles.title}>Lebensmittel</h1>
          <p className={styles.subtitle}>
            {admin.foods.length} Lebensmittel · {reviewed} katalog-geprüft ·{' '}
            {admin.foods.length - reviewed} offen
          </p>
        </div>

        <NutritionNotices admin={admin} />
        <CatalogChecklist />
        {listIssues.length > 0 && (
          <IssueReport issues={listIssues} title="Erwartungs- und Ausnahmeliste" />
        )}

        <details className={`${styles.section} ${styles.details}`} open={active}>
          <summary>Suche und Filter{active ? ' (aktiv)' : ''}</summary>
          <form
            method="get"
            action="/admin/lebensmittel"
            className={styles.filterGrid}
            role="search"
          >
            <div className={styles.filterRow}>
              <label className={styles.label} htmlFor="filter-q">
                Suche nach Name, ID oder Quell-ID
              </label>
              <input
                id="filter-q"
                name="q"
                type="search"
                className={styles.input}
                defaultValue={filters.q ?? ''}
                maxLength={100}
                placeholder="z. B. Haferflocken"
              />
            </div>
            <div className={styles.filterRow}>
              <label className={styles.label} htmlFor="filter-pruefung">
                Katalog-Prüfung
              </label>
              <select
                id="filter-pruefung"
                name="pruefung"
                className={styles.select}
                defaultValue={filters.pruefung ?? ''}
              >
                <option value="">alle</option>
                <option value="offen">noch offen</option>
                <option value="geprueft">katalog-geprüft</option>
              </select>
            </div>
            <div className={styles.filterActions}>
              <button type="submit" className={styles.button}>
                Anwenden
              </button>
              <Link className={styles.buttonSecondary} href="/admin/lebensmittel">
                Zurücksetzen
              </Link>
            </div>
          </form>
        </details>

        <p className={styles.muted} data-testid="trefferzahl" aria-live="polite">
          {active
            ? `${shown.length} von ${admin.foods.length} Treffern`
            : `${shown.length} Lebensmittel`}
        </p>

        {admin.foods.length === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Lebensmittel</h2>
            <p>
              Der Katalog entsteht nur über den Workflow <strong>foods-import</strong> (Nährwerte
              maschinell aus der Quelle). Den Pull Request gebt ihr selbst frei.
            </p>
          </section>
        ) : shown.length === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Keine Treffer</h2>
            <Link className={styles.buttonSecondary} href="/admin/lebensmittel">
              Filter zurücksetzen
            </Link>
          </section>
        ) : (
          <ul className={styles.cards} aria-label="Lebensmittel">
            {shown.map((entry) => (
              <li key={entry.food.id}>
                <Link className={styles.card} href={`/admin/lebensmittel/${entry.food.id}`}>
                  <h2 className={styles.cardTitle}>{entry.food.name_de}</h2>
                  <p className={styles.cardMeta}>
                    {SHOPPING_CATEGORY_LABELS_DE[entry.food.shopping_category]} · Quelle{' '}
                    {entry.food.source.ref} · in {entry.usedIn.length} Rezepten
                  </p>
                  <ContentBadges
                    status={entry.food.status}
                    needsExpertReview={entry.needsExpertReview}
                    summary={entry.summary}
                  />
                  <p className={styles.small}>
                    {entry.catalogReviewed
                      ? `katalog-geprüft von ${entry.food.meta.catalog_reviewed_by ?? ''}`
                      : 'Katalog-Prüfung offen'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
