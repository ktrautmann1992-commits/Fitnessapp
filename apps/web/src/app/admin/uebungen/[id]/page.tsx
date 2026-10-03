import { muscleNameDe } from '@fitnessapp/core';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/access';
import { isContentId } from '@/lib/admin/catalog';
import { getCatalog } from '@/lib/admin/data';
import {
  ALTERNATIVE_REASON_LABELS,
  CAUTION_TAG_LABELS,
  equipmentLabel,
  LOAD_TYPE_LABELS,
  MECHANICS_LABELS,
  MOVEMENT_PATTERN_LABELS,
} from '@/lib/admin/labels';

import { AdminHeader } from '../../_components/AdminHeader';
import { ContentBadges } from '../../_components/Badges';
import { IssueReport } from '../../_components/IssueReport';
import { AiDraftNotice, OriginSection } from '../../_components/Origin';
import { ReleaseHint } from '../../_components/ReleaseHint';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'leicht', 2: 'mittel', 3: 'schwer' };

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const catalog = getCatalog();
  const entry = isContentId(id) ? catalog.exerciseById.get(id) : undefined;
  if (!entry) {
    notFound();
  }
  const { exercise } = entry;
  const list = (values: readonly string[]) => (values.length === 0 ? '–' : values.join(', '));

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <Link className={styles.backLink} href="/admin?tab=uebungen">
          ← Alle Übungen
        </Link>
        <div>
          <h1 className={styles.title}>{exercise.name_de}</h1>
          <p className={styles.subtitle}>
            {exercise.name_en}
            {exercise.aliases_de.length > 0 ? ` · auch: ${exercise.aliases_de.join(', ')}` : ''}
          </p>
        </div>
        <ContentBadges
          status={exercise.status}
          needsExpertReview={entry.needsExpertReview}
          summary={entry.summary}
        />

        <IssueReport issues={entry.issues} />
        <AiDraftNotice show={entry.needsExpertReview} />

        <section className={styles.section} aria-labelledby="ansicht">
          <h2 id="ansicht" className={styles.h2}>
            So steht es später in der App
          </h2>
          <p>{exercise.description_de}</p>
          <h3 className={styles.h3}>Ausführung</h3>
          <ol className={styles.list}>
            {exercise.steps_de.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <h3 className={styles.h3}>Technik-Tipps</h3>
          <ul className={styles.list}>
            {exercise.tips_de.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
          <h3 className={styles.h3}>Typische Fehler</h3>
          <ul className={styles.list}>
            {exercise.common_mistakes_de.map((mistake, index) => (
              <li key={index}>{mistake}</li>
            ))}
          </ul>
          <h3 className={styles.h3}>Sicherheitshinweis</h3>
          <p>{exercise.safety_note_de}</p>
        </section>

        <section className={styles.section} aria-labelledby="steckbrief">
          <h2 id="steckbrief" className={styles.h2}>
            Steckbrief
          </h2>
          <dl className={styles.facts}>
            <dt>ID</dt>
            <dd className={styles.code}>{exercise.id}</dd>
            <dt>Bewegungsmuster</dt>
            <dd>{MOVEMENT_PATTERN_LABELS[exercise.movement_pattern]}</dd>
            <dt>Hauptmuskeln</dt>
            <dd>{list(exercise.primary_muscles.map(muscleNameDe))}</dd>
            <dt>Nebenmuskeln</dt>
            <dd>{list(exercise.secondary_muscles.map(muscleNameDe))}</dd>
            <dt>Geräte</dt>
            <dd>
              {exercise.equipment_ids.length === 0
                ? 'ohne Geräte'
                : exercise.equipment_ids.map(equipmentLabel).join(', ')}
            </dd>
            <dt>Art</dt>
            <dd>{MECHANICS_LABELS[exercise.mechanics]}</dd>
            <dt>Belastung</dt>
            <dd>{LOAD_TYPE_LABELS[exercise.load_type]}</dd>
            <dt>Einseitig</dt>
            <dd>{exercise.unilateral ? 'ja (je Seite)' : 'nein'}</dd>
            <dt>Schwierigkeit</dt>
            <dd>
              {exercise.difficulty} – {DIFFICULTY_LABELS[exercise.difficulty] ?? ''}
            </dd>
            <dt>Vorsicht-Merkmale</dt>
            <dd>{list(exercise.caution_tags.map((tag) => CAUTION_TAG_LABELS[tag]))}</dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="alternativen">
          <h2 id="alternativen" className={styles.h2}>
            Alternativen ({exercise.alternatives.length})
          </h2>
          {exercise.alternatives.length === 0 ? (
            <p className={styles.muted}>Keine Alternativen eingetragen.</p>
          ) : (
            <ul className={styles.list}>
              {[...exercise.alternatives]
                .sort((a, b) => a.priority - b.priority)
                .map((alternative) => {
                  const target = catalog.exerciseById.get(alternative.alternative_id);
                  return (
                    <li key={alternative.alternative_id}>
                      {target ? (
                        <Link
                          className={styles.link}
                          href={`/admin/uebungen/${target.exercise.id}`}
                        >
                          {target.exercise.name_de}
                        </Link>
                      ) : (
                        <span className={styles.code}>{alternative.alternative_id} (fehlt)</span>
                      )}{' '}
                      <span className={styles.muted}>
                        – {ALTERNATIVE_REASON_LABELS[alternative.reason]}, Priorität{' '}
                        {alternative.priority}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="verwendet">
          <h2 id="verwendet" className={styles.h2}>
            Verwendet in Vorlagen ({entry.usedIn.length})
          </h2>
          {entry.usedIn.length === 0 ? (
            <p className={styles.muted}>In keiner Plan-Vorlage verwendet.</p>
          ) : (
            <ul className={styles.list}>
              {entry.usedIn.map((template) => (
                <li key={template.id}>
                  <Link className={styles.link} href={`/admin/vorlagen/${template.id}`}>
                    {template.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <OriginSection meta={exercise.meta} version={exercise.version} />
        <ReleaseHint ids={[exercise.id]} scope="ID dieser Übung" />
      </main>
    </>
  );
}
