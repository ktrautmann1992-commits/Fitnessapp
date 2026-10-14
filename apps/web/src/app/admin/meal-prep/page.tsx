import { PREP_WEEKDAY_LABELS_DE } from '@fitnessapp/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';
import { getNutritionAdmin } from '@/lib/admin/data';
import { STORAGE_METHOD_LABELS } from '@/lib/admin/labels';

import { AdminHeader } from '../_components/AdminHeader';
import { AdminNav } from '../_components/AdminNav';
import { ContentBadges } from '../_components/Badges';
import { DisabledNotice } from '../_components/DisabledNotice';
import { IssueReport } from '../_components/IssueReport';
import { NutritionNotices } from '../_components/NutritionNotices';
import { IdReleaseHint } from '../_components/RecipeReleaseHint';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

/** Meal-Prep-Wochenpläne (docs/PLAN-PHASE-5.md 19.5, Etappe N2d) – nur ansehen. */
export default async function MealPrepPage() {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }
  const admin = getNutritionAdmin();

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="meal-prep" />
        <div>
          <h1 className={styles.title}>Meal-Prep-Pläne</h1>
          <p className={styles.subtitle}>{admin.mealPrepPlans.length} Wochenpläne · nur ansehen</p>
        </div>
        <NutritionNotices admin={admin} />

        {admin.mealPrepPlans.length === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Meal-Prep-Pläne</h2>
            <p>
              Sie kommen mit den Rezepten über den Workflow <strong>alpha5-import</strong> als
              Entwurf.
            </p>
          </section>
        ) : (
          admin.mealPrepPlans.map((entry) => {
            const { plan } = entry;
            return (
              <section key={plan.id} className={styles.section} aria-labelledby={`plan-${plan.id}`}>
                <h2 id={`plan-${plan.id}`} className={styles.h2}>
                  {plan.title_de}
                </h2>
                <p className={styles.small}>
                  ID: <span className={styles.code}>{plan.id}</span>
                </p>
                <ContentBadges
                  status={plan.status}
                  needsExpertReview={entry.needsExpertReview}
                  summary={entry.summary}
                />
                <p>{plan.description_de}</p>
                <h3 className={styles.h3}>Rezepte</h3>
                <ul className={styles.list}>
                  {entry.recipes.map((recipe) => (
                    <li key={recipe.id}>
                      {recipe.title === null ? (
                        <span className={styles.code}>{recipe.id} (fehlt)</span>
                      ) : (
                        <Link className={styles.link} href={`/admin/rezepte/${recipe.id}`}>
                          {recipe.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                <h3 className={styles.h3}>Kochtag</h3>
                <ol className={styles.list}>
                  {plan.cook_steps.map((step, index) => (
                    <li key={index}>
                      Minute {step.start_min}: {step.text_de}
                    </li>
                  ))}
                </ol>
                <h3 className={styles.h3}>Aufbewahrung</h3>
                <ul className={styles.list}>
                  {plan.storage_plan.map((item) => (
                    <li key={`${item.recipe_id}-${item.weekday}`}>
                      {PREP_WEEKDAY_LABELS_DE[item.weekday]}:{' '}
                      <span className={styles.code}>{item.recipe_id}</span> –{' '}
                      {STORAGE_METHOD_LABELS[item.method]}
                    </li>
                  ))}
                </ul>
                {plan.storage_de.length > 0 && (
                  <ul className={styles.list}>
                    {plan.storage_de.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                )}
                <IssueReport issues={entry.issues} headingId={`pruefbericht-plan-${plan.id}`} />
              </section>
            );
          })
        )}
        <IdReleaseHint kind="meal_prep_plan" />
      </main>
    </>
  );
}
