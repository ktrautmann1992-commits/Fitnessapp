import { recipeReleaseBlockerText } from '@fitnessapp/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';
import { getNutritionAdmin } from '@/lib/admin/data';
import { MEAL_TYPE_LABELS, STATUS_PLURAL_LABELS } from '@/lib/admin/labels';
import { parseRecipeGroup, type RecipeEntry, type RecipeGroup } from '@/lib/admin/nutrition';

import { AdminHeader } from '../_components/AdminHeader';
import { AdminNav } from '../_components/AdminNav';
import { ContentBadges } from '../_components/Badges';
import { DisabledNotice } from '../_components/DisabledNotice';
import { IssueReport } from '../_components/IssueReport';
import { NutritionNotices } from '../_components/NutritionNotices';
import { RecipeReleaseHint } from '../_components/RecipeReleaseHint';
import styles from '../admin.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Rezepte nach Kategorie (docs/PLAN-PHASE-5.md 19.5, Etappe N2d) – nur ansehen. */
export default async function RecipesPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }

  const selected = parseRecipeGroup(await searchParams);
  const admin = getNutritionAdmin();
  const group = selected === undefined ? undefined : admin.groups.find((g) => g.id === selected);

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <AdminNav current="rezepte" />
        <div>
          <h1 className={styles.title}>Rezepte</h1>
          <p className={styles.subtitle}>
            {admin.recipes.length} Rezepte · nach Kategorie (ein Rezept kann in mehreren stehen)
          </p>
        </div>

        <NutritionNotices admin={admin} />

        {admin.recipes.length === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Rezepte</h2>
            <p>
              Rezepte kommen über den Workflow <strong>alpha5-import</strong> als Entwurf ins
              Repository – erst nach dem Lebensmittel-Katalog (<strong>foods-import</strong>,
              docs/SETUP.md Teil J).
            </p>
          </section>
        ) : group === undefined ? (
          <GroupList groups={admin.groups} />
        ) : (
          <GroupDetail group={group} />
        )}

        {admin.libraryIssues.length > 0 && group === undefined && (
          <IssueReport issues={admin.libraryIssues} title="Hinweise zum ganzen Bestand" />
        )}

        <RecipeReleaseHint
          {...(group === undefined
            ? {}
            : group.id === 'ohne'
              ? { withoutCategory: true }
              : { category: { id: group.id, name: group.name } })}
        />
      </main>
    </>
  );
}

function GroupList({ groups }: { groups: readonly RecipeGroup[] }) {
  return (
    <ul className={styles.cards} aria-label="Kategorien">
      {groups.map((group) => (
        <li key={group.id}>
          <Link className={styles.card} href={`/admin/rezepte?kategorie=${group.id}`}>
            <h2 className={styles.cardTitle}>
              {group.name} ({group.recipes.length})
            </h2>
            <GroupFacts group={group} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupFacts({ group }: { group: RecipeGroup }) {
  return (
    <dl className={styles.facts}>
      <dt>{STATUS_PLURAL_LABELS.draft}</dt>
      <dd>{group.counts.draft}</dd>
      <dt>{STATUS_PLURAL_LABELS.published}</dt>
      <dd>{group.counts.published}</dd>
      {group.counts.archived > 0 && (
        <>
          <dt>{STATUS_PLURAL_LABELS.archived}</dt>
          <dd>{group.counts.archived}</dd>
        </>
      )}
      <dt>mit rotem Befund</dt>
      <dd>{group.withRed}</dd>
      <dt>Zutaten ohne Katalog-Prüfung</dt>
      <dd>{group.withUnreviewedFoods}</dd>
      <dt>offene Annahme „durchgegart“</dt>
      <dd>{group.withOpenAssumptions}</dd>
      <dt>Abweichung Import-Bericht</dt>
      <dd>{group.withDeviations}</dd>
      <dt>{group.id === 'ohne' ? 'bereit zur Freigabe per ID' : 'bereit zur Sammelfreigabe'}</dt>
      <dd>
        {group.ready}
        {group.readyWithConfirm !== group.ready
          ? ` (mit „Import-Annahmen geprüft“: ${group.readyWithConfirm})`
          : ''}
      </dd>
    </dl>
  );
}

function GroupDetail({ group }: { group: RecipeGroup }) {
  return (
    <>
      <Link className={styles.backLink} href="/admin/rezepte">
        ← Alle Kategorien
      </Link>
      <section className={styles.section} aria-labelledby="kategorie">
        <h2 id="kategorie" className={styles.h2}>
          {group.name} ({group.recipes.length})
        </h2>
        <GroupFacts group={group} />
      </section>
      {group.recipes.length === 0 ? (
        <p className={styles.muted}>In dieser Kategorie gibt es keine Rezepte.</p>
      ) : (
        <ul className={styles.cards} aria-label="Rezepte">
          {group.recipes.map((entry) => (
            <RecipeCard key={entry.recipe.id} entry={entry} />
          ))}
        </ul>
      )}
    </>
  );
}

function RecipeCard({ entry }: { entry: RecipeEntry }) {
  const { recipe } = entry;
  return (
    <li>
      <Link className={styles.card} href={`/admin/rezepte/${recipe.id}`}>
        <h3 className={styles.cardTitle}>{recipe.title_de}</h3>
        <p className={styles.cardMeta}>
          {recipe.meal_types.map((type) => MEAL_TYPE_LABELS[type]).join(', ')} · {recipe.servings}{' '}
          {recipe.servings === 1 ? 'Portion' : 'Portionen'}
        </p>
        <ContentBadges
          status={recipe.status}
          needsExpertReview={entry.needsExpertReview}
          summary={entry.summary}
        />
        <p className={styles.small}>
          {entry.releasePath === 'ids' ? 'Freigabe per ID' : 'Sammelfreigabe'}
          {entry.blockers.length === 0
            ? ': wird freigegeben'
            : `: übersprungen – ${entry.blockers.map(recipeReleaseBlockerText).join(' · ')}`}
        </p>
      </Link>
    </li>
  );
}
