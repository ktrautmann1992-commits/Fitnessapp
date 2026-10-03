import {
  EQUIPMENT_LOCATIONS,
  MOVEMENT_PATTERNS,
  TEMPLATE_EXPERIENCE_LEVELS,
  TEMPLATE_GOAL_TYPES,
} from '@fitnessapp/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getAdminAccess } from '@/lib/admin/access';
import {
  type AdminFilters,
  countByStatus,
  type ExerciseEntry,
  filterExercises,
  filterTemplates,
  hasActiveFilters,
  parseFilters,
  type TemplateEntry,
  usedEquipmentIds,
} from '@/lib/admin/catalog';
import { getCatalog } from '@/lib/admin/data';
import {
  equipmentLabel,
  GOAL_LABELS,
  ISSUE_KIND_LABELS,
  LEVEL_LABELS,
  LOCATION_LABELS,
  MOVEMENT_PATTERN_LABELS,
  STATUS_LABELS,
  STATUS_PLURAL_LABELS,
} from '@/lib/admin/labels';

import { AdminHeader } from './_components/AdminHeader';
import { ContentBadges } from './_components/Badges';
import { DisabledNotice } from './_components/DisabledNotice';
import { IssueReport } from './_components/IssueReport';
import { ReleaseHint } from './_components/ReleaseHint';
import styles from './admin.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  // Serverseitige Prüfung in der Seite selbst (zusätzlich zu src/proxy.ts).
  const access = await getAdminAccess();
  if (access.state === 'disabled') {
    return <DisabledNotice reasons={access.reasons} />;
  }
  if (access.state !== 'ok') {
    redirect('/admin/login');
  }

  const filters = parseFilters(await searchParams);
  const catalog = getCatalog();
  const isExercises = filters.tab === 'uebungen';
  const exercises = filterExercises(catalog.exercises, filters);
  const templates = filterTemplates(catalog.templates, filters);
  const visibleIds = isExercises
    ? exercises.map((entry) => entry.exercise.id)
    : templates.map((entry) => entry.template.id);
  const allStatuses = isExercises
    ? catalog.exercises.map((entry) => entry.exercise.status)
    : catalog.templates.map((entry) => entry.template.status);
  const counts = countByStatus(allStatuses);
  const total = allStatuses.length;
  const shown = visibleIds.length;
  const active = hasActiveFilters(filters);
  const nothingAtAll = catalog.exercises.length + catalog.templates.length === 0;

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <div>
          <h1 className={styles.title}>Inhalte prüfen</h1>
          <p className={styles.subtitle}>
            {catalog.exercises.length} Übungen · {catalog.templates.length} Vorlagen
          </p>
        </div>

        {catalog.blockingTotal > 0 && (
          <p className={styles.noticeError} role="alert">
            {catalog.blockingTotal} blockierende Fehler (Schema/Datei oder rot an freigegebenen
            Inhalten) – <strong>ci</strong> und content-seed schlagen so fehl. Details unten bzw. in
            den Detailansichten.
          </p>
        )}

        {(catalog.brokenFiles.length > 0 || catalog.strayFiles.length > 0) && (
          <section className={styles.noticeError} aria-labelledby="kaputte-dateien">
            <h2 id="kaputte-dateien" className={styles.h2}>
              Dateien mit Fehlern
            </h2>
            <p>
              Diese Dateien konnten nicht als Inhalt gelesen werden und erscheinen nicht in den
              Listen:
            </p>
            <ul className={styles.list}>
              {catalog.strayFiles.map((file) => (
                <li key={file}>
                  <span className={styles.code}>{file}</span> – keine JSON-Datei
                </li>
              ))}
              {catalog.brokenFiles.map((file) => (
                <li key={`${file.kind}:${file.id}`}>
                  {ISSUE_KIND_LABELS[file.kind]} <span className={styles.code}>{file.id}</span>:{' '}
                  {file.issues
                    .map(
                      (issue) =>
                        `${issue.rule} ${issue.path ? `(${issue.path}) ` : ''}${issue.message}`,
                    )
                    .join(' · ')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className={styles.tabs} aria-label="Inhaltsart">
          <Link
            href="/admin?tab=uebungen"
            className={isExercises ? styles.tabActive : styles.tab}
            aria-current={isExercises ? 'page' : undefined}
          >
            Übungen ({catalog.exercises.length})
          </Link>
          <Link
            href="/admin?tab=vorlagen"
            className={isExercises ? styles.tab : styles.tabActive}
            aria-current={isExercises ? undefined : 'page'}
          >
            Plan-Vorlagen ({catalog.templates.length})
          </Link>
        </nav>

        <p className={styles.muted}>
          {counts.draft} {STATUS_PLURAL_LABELS.draft} · {counts.published}{' '}
          {STATUS_PLURAL_LABELS.published} · {counts.archived} {STATUS_PLURAL_LABELS.archived}
        </p>

        {isExercises && catalog.libraryIssues.length > 0 && (
          <IssueReport issues={catalog.libraryIssues} title="Hinweise zur ganzen Bibliothek" />
        )}

        <FilterForm
          filters={filters}
          equipmentIds={usedEquipmentIds(catalog.exercises)}
          active={active}
        />

        <p className={styles.muted} data-testid="trefferzahl" aria-live="polite">
          {active
            ? `${shown} von ${total} Treffern`
            : `${total} ${isExercises ? 'Übungen' : 'Vorlagen'}`}
        </p>

        {nothingAtAll ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Noch keine Inhalte</h2>
            <p>
              Im Repository liegen noch keine Übungen oder Vorlagen. Neue Entwürfe kommen über den
              Workflow <strong>content-generate</strong> (docs/SETUP.md, „Inhalte erzeugen und
              freigeben am Handy“).
            </p>
          </section>
        ) : shown === 0 ? (
          <section className={styles.section}>
            <h2 className={styles.h2}>Keine Treffer</h2>
            <p>Mit diesen Filtern gibt es keine {isExercises ? 'Übungen' : 'Vorlagen'}.</p>
            <Link className={styles.buttonSecondary} href={`/admin?tab=${filters.tab}`}>
              Filter zurücksetzen
            </Link>
          </section>
        ) : isExercises ? (
          <ExerciseList entries={exercises} />
        ) : (
          <TemplateList entries={templates} />
        )}

        <ReleaseHint
          ids={visibleIds}
          scope={
            active
              ? 'IDs dieser Trefferliste'
              : isExercises
                ? 'IDs aller Übungen'
                : 'IDs aller Vorlagen'
          }
        />
      </main>
    </>
  );
}

function ExerciseList({ entries }: { entries: readonly ExerciseEntry[] }) {
  return (
    <ul className={styles.cards} aria-label="Übungen">
      {entries.map((entry) => {
        const { exercise } = entry;
        const equipment =
          exercise.equipment_ids.length === 0
            ? 'ohne Geräte'
            : exercise.equipment_ids.map(equipmentLabel).join(', ');
        return (
          <li key={exercise.id}>
            <Link className={styles.card} href={`/admin/uebungen/${exercise.id}`}>
              <h2 className={styles.cardTitle}>{exercise.name_de}</h2>
              <p className={styles.cardMeta}>
                {MOVEMENT_PATTERN_LABELS[exercise.movement_pattern]} · {equipment}
              </p>
              <ContentBadges
                status={exercise.status}
                needsExpertReview={entry.needsExpertReview}
                summary={entry.summary}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TemplateList({ entries }: { entries: readonly TemplateEntry[] }) {
  return (
    <ul className={styles.cards} aria-label="Plan-Vorlagen">
      {entries.map((entry) => {
        const { template } = entry;
        return (
          <li key={template.id}>
            <Link className={styles.card} href={`/admin/vorlagen/${template.id}`}>
              <h2 className={styles.cardTitle}>{template.title_de}</h2>
              <p className={styles.cardMeta}>
                {GOAL_LABELS[template.goal_type]} · {LEVEL_LABELS[template.experience_level]} ·{' '}
                {template.sessions_per_week} Tage · {LOCATION_LABELS[template.location]} ·{' '}
                {template.minutes_min}–{template.minutes_max} min
              </p>
              <ContentBadges
                status={template.status}
                needsExpertReview={entry.needsExpertReview}
                summary={entry.summary}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | number | undefined;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className={styles.filterRow}>
      <label className={styles.label} htmlFor={`filter-${name}`}>
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        className={styles.select}
        defaultValue={value === undefined ? '' : String(value)}
      >
        <option value="">alle</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Suche und Filter als normales GET-Formular (funktioniert auch ohne JavaScript). */
function FilterForm({
  filters,
  equipmentIds,
  active,
}: {
  filters: AdminFilters;
  equipmentIds: readonly string[];
  active: boolean;
}) {
  const isExercises = filters.tab === 'uebungen';
  const activeCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'tab' && value !== undefined,
  ).length;
  return (
    <details className={`${styles.section} ${styles.details}`} open={active}>
      <summary>Suche und Filter{activeCount > 0 ? ` (${activeCount} aktiv)` : ''}</summary>
      <form method="get" action="/admin" className={styles.filterGrid} role="search">
        <input type="hidden" name="tab" value={filters.tab} />
        <div className={styles.filterRow}>
          <label className={styles.label} htmlFor="filter-q">
            Suche nach Name oder ID
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            className={styles.input}
            defaultValue={filters.q ?? ''}
            maxLength={100}
            placeholder={isExercises ? 'z. B. Kniebeuge' : 'z. B. Muskelaufbau'}
          />
        </div>
        <Select
          name="status"
          label="Status"
          value={filters.status}
          options={Object.entries(STATUS_LABELS)}
        />
        {isExercises ? (
          <>
            <Select
              name="muster"
              label="Bewegungsmuster"
              value={filters.muster}
              options={MOVEMENT_PATTERNS.map(
                (pattern) => [pattern, MOVEMENT_PATTERN_LABELS[pattern]] as const,
              )}
            />
            <Select
              name="geraet"
              label="Gerät"
              value={filters.geraet}
              options={[
                ['ohne', 'ohne Geräte'] as const,
                ...equipmentIds.map((id) => [id, equipmentLabel(id)] as const),
              ]}
            />
          </>
        ) : (
          <>
            <Select
              name="ziel"
              label="Ziel"
              value={filters.ziel}
              options={TEMPLATE_GOAL_TYPES.map((goal) => [goal, GOAL_LABELS[goal]] as const)}
            />
            <Select
              name="level"
              label="Level"
              value={filters.level}
              options={TEMPLATE_EXPERIENCE_LEVELS.map(
                (level) => [level, LEVEL_LABELS[level]] as const,
              )}
            />
            <Select
              name="tage"
              label="Tage pro Woche"
              value={filters.tage}
              options={[1, 2, 3, 4, 5, 6, 7].map((days) => [String(days), `${days} Tage`] as const)}
            />
            <Select
              name="ort"
              label="Ort"
              value={filters.ort}
              options={EQUIPMENT_LOCATIONS.map(
                (location) => [location, LOCATION_LABELS[location]] as const,
              )}
            />
          </>
        )}
        <Select
          name="fehler"
          label="Prüfergebnis"
          value={filters.fehler}
          options={[
            ['rot', 'hat rote Fehler'],
            ['gelb', 'hat gelbe Hinweise'],
            ['ohne', 'ohne Befunde'],
          ]}
        />
        <Select
          name="ki"
          label="Fachliche Prüfung"
          value={filters.ki}
          options={[
            ['offen', 'KI-Entwurf – fachlich prüfen'],
            ['geprueft', 'fachlich geprüft'],
          ]}
        />
        <div className={styles.filterActions}>
          <button type="submit" className={styles.button}>
            Anwenden
          </button>
          <Link className={styles.buttonSecondary} href={`/admin?tab=${filters.tab}`}>
            Zurücksetzen
          </Link>
        </div>
      </form>
    </details>
  );
}
