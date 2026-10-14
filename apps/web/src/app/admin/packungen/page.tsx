import { PACKAGE_SIZE_LIMITS } from '@fitnessapp/core';
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

const grams = (value: number) => `${value.toLocaleString('de-DE')} g`;

/**
 * Packungsgrößen (docs/PLAN-PHASE-5.md 19.7 N11, KONZEPT 6.11) – nur ansehen. Entstehen offline über content-generate
 * (Art „package-sizes“) als Entwurf, freigegeben wird über content-review (Art „ids“). Genutzt werden sie erst von
 * der Resteplanung (N13/N14).
 */
export default async function PackageSizesPage() {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }
  const admin = getNutritionAdmin();
  const count = admin.packageSizes.length;

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="packungen" />
        <div>
          <h1 className={styles.title}>Packungsgrößen</h1>
          <p className={styles.subtitle}>
            {count} {count === 1 ? 'Eintrag' : 'Einträge'} · nur ansehen
          </p>
        </div>
        <NutritionNotices admin={admin} />

        {count === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Packungsgrößen</h2>
            <p>
              Sie entstehen über den Workflow <strong>content-generate</strong> (Art{' '}
              <em>package-sizes</em>) als Entwurf – erst, wenn es katalog-geprüfte Lebensmittel
              gibt. Ein Probelauf geht ohne Schlüssel.
            </p>
          </section>
        ) : (
          admin.packageSizes.map((entry) => {
            const p = entry.packageSize;
            return (
              <section key={p.id} className={styles.section} aria-labelledby={`packung-${p.id}`}>
                <h2 id={`packung-${p.id}`} className={styles.h2}>
                  {entry.foodName ?? p.food_id}: {grams(p.package_size_g)}
                </h2>
                <p className={styles.small}>
                  ID: <span className={styles.code}>{p.id}</span> · Lebensmittel:{' '}
                  <span className={styles.code}>{p.food_id}</span>
                </p>
                <ContentBadges
                  status={p.status}
                  needsExpertReview={entry.needsExpertReview}
                  summary={entry.summary}
                />
                <IssueReport issues={entry.issues} headingId={`pruefbericht-packung-${p.id}`} />
              </section>
            );
          })
        )}
        <p className={styles.small}>
          Übliche Handelsgröße bzw. kleinste übliche Kaufeinheit in Gramm (erlaubt{' '}
          {grams(PACKAGE_SIZE_LIMITS.grams.min)} bis {grams(PACKAGE_SIZE_LIMITS.grams.max)}). Sie
          ändert nie, welche Rezepte jemand bekommt oder wie viel – erst die Resteplanung nutzt sie
          (Aufrunden der Einkaufsliste, Reste zuerst verbrauchen).
        </p>
        <IdReleaseHint kind="package_size" />
      </main>
    </>
  );
}
