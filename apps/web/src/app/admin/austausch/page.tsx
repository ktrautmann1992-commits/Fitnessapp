import { INGREDIENT_ROLE_LABELS_DE, ROLE_MEASURE_DE } from '@fitnessapp/core';
import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';
import { getNutritionAdmin } from '@/lib/admin/data';

import { AdminHeader } from '../_components/AdminHeader';
import { AdminNav } from '../_components/AdminNav';
import { ContentBadges } from '../_components/Badges';
import { DisabledNotice } from '../_components/DisabledNotice';
import { IssueReport } from '../_components/IssueReport';
import { NutritionNotices } from '../_components/NutritionNotices';
import { IdReleaseHint } from '../_components/RecipeReleaseHint';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

/**
 * Austausch-Tabelle (docs/PLAN-PHASE-5.md 19.7 N9, KONZEPT 6.9) – nur ansehen. Entsteht offline über content-generate
 * (Art „ingredient-substitutions“) als Entwurf, freigegeben wird über content-review (Art „ids“).
 */
export default async function SubstitutionsPage() {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }
  const admin = getNutritionAdmin();
  const count = admin.substitutions.length;

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="austausch" />
        <div>
          <h1 className={styles.title}>Zutaten-Austausch</h1>
          <p className={styles.subtitle}>
            {count} {count === 1 ? 'Eintrag' : 'Einträge'} · nur ansehen
          </p>
        </div>
        <NutritionNotices admin={admin} />

        {count === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Austausch-Einträge</h2>
            <p>
              Sie entstehen über den Workflow <strong>content-generate</strong> (Art{' '}
              <em>ingredient-substitutions</em>) als Entwurf – erst, wenn es katalog-geprüfte
              Lebensmittel gibt. Ein Probelauf geht ohne Schlüssel.
            </p>
          </section>
        ) : (
          admin.substitutions.map((entry) => {
            const s = entry.substitution;
            return (
              <section key={s.id} className={styles.section} aria-labelledby={`austausch-${s.id}`}>
                <h2 id={`austausch-${s.id}`} className={styles.h2}>
                  {entry.foodName ?? s.food_id} → {entry.substituteName ?? s.substitute_food_id}
                </h2>
                <p className={styles.small}>
                  ID: <span className={styles.code}>{s.id}</span>
                </p>
                <ContentBadges
                  status={s.status}
                  needsExpertReview={entry.needsExpertReview}
                  summary={entry.summary}
                />
                <dl className={styles.facts}>
                  <dt>Rolle</dt>
                  <dd>
                    {INGREDIENT_ROLE_LABELS_DE[s.role]} (Messgröße: {ROLE_MEASURE_DE[s.role]})
                  </dd>
                  <dt>Faktor</dt>
                  <dd>
                    {s.factor.toLocaleString('de-DE')} × Masse der Zutat (
                    <span className={styles.code}>{s.food_id}</span> →{' '}
                    <span className={styles.code}>{s.substitute_food_id}</span>)
                  </dd>
                  <dt>Hinweis</dt>
                  <dd>{s.note_de}</dd>
                </dl>
                <IssueReport issues={entry.issues} headingId={`pruefbericht-austausch-${s.id}`} />
              </section>
            );
          })
        )}
        <p className={styles.small}>
          Angeboten wird ein Austausch in der App nur, wenn das geänderte Rezept den kompletten
          Filter der Person besteht (Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“,
          Schwangerschaft), die Mengen je Portion passen (R11) und der Tag im Planband bleibt.
        </p>
        <IdReleaseHint kind="ingredient_substitution" />
      </main>
    </>
  );
}
