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

/** Ratgeber-Seiten (docs/PLAN-PHASE-5.md 19.5, Etappe N2d) – nur ansehen. */
export default async function GuidesPage() {
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
        <AdminNav current="ratgeber" />
        <div>
          <h1 className={styles.title}>Ratgeber</h1>
          <p className={styles.subtitle}>
            {admin.guides.length} {admin.guides.length === 1 ? 'Ratgeber-Seite' : 'Ratgeber-Seiten'}{' '}
            · nur ansehen
          </p>
        </div>
        <NutritionNotices admin={admin} />

        {admin.guides.length === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Ratgeber</h2>
            <p>
              Sie kommen mit den Rezepten über den Workflow <strong>alpha5-import</strong> als
              Entwurf.
            </p>
          </section>
        ) : (
          admin.guides.map((entry) => {
            const { guide } = entry;
            return (
              <section
                key={guide.id}
                className={styles.section}
                aria-labelledby={`ratgeber-${guide.id}`}
              >
                <h2 id={`ratgeber-${guide.id}`} className={styles.h2}>
                  {guide.title_de}
                </h2>
                <p className={styles.small}>
                  ID: <span className={styles.code}>{guide.id}</span>
                </p>
                <ContentBadges
                  status={guide.status}
                  needsExpertReview={entry.needsExpertReview}
                  summary={entry.summary}
                />
                {guide.intro_de && <p>{guide.intro_de}</p>}
                {guide.sections.map((section) => (
                  <div key={section.heading_de}>
                    <h3 className={styles.h3}>{section.heading_de}</h3>
                    {section.body_de.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                    {section.notice_de && (
                      <p className={styles.noticeWarning}>{section.notice_de}</p>
                    )}
                  </div>
                ))}
                {(guide.places ?? []).map((place) => (
                  <div key={place.name_de}>
                    <h3 className={styles.h3}>{place.name_de}</h3>
                    <p className={styles.small}>Gut: {place.good_de.join(' · ') || '–'}</p>
                    <p className={styles.small}>
                      Seltener: {place.less_often_de.join(' · ') || '–'}
                    </p>
                    {place.tip_de && <p className={styles.small}>Tipp: {place.tip_de}</p>}
                  </div>
                ))}
                <IssueReport
                  issues={entry.issues}
                  headingId={`pruefbericht-ratgeber-${guide.id}`}
                />
              </section>
            );
          })
        )}
        <IdReleaseHint kind="guide" />
      </main>
    </>
  );
}
