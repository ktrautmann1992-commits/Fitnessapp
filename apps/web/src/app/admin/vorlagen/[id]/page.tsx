import { muscleNameDe, type TemplateExercise } from '@fitnessapp/core';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireAdmin } from '@/lib/admin/access';
import { isContentId, pushPullStats, sessionStats, volumeBars } from '@/lib/admin/catalog';
import { getCatalog } from '@/lib/admin/data';
import {
  equipmentLabel,
  FOCUS_LABELS,
  formatNumberDe,
  GOAL_LABELS,
  LEVEL_LABELS,
  LOCATION_LABELS,
} from '@/lib/admin/labels';

import { AdminHeader } from '../../_components/AdminHeader';
import { ContentBadges } from '../../_components/Badges';
import { IssueReport } from '../../_components/IssueReport';
import { AiDraftNotice, OriginSection } from '../../_components/Origin';
import { ReleaseHint } from '../../_components/ReleaseHint';
import styles from '../../admin.module.css';

export const dynamic = 'force-dynamic';

const SEX_LABELS = {
  male: 'Männer',
  female: 'Frauen',
  diverse: 'divers',
  unspecified: 'ohne Angabe',
} as const;

function dose(item: TemplateExercise): string {
  const work =
    item.duration_s !== null
      ? `${item.sets} × ${item.duration_s} s`
      : item.reps_min === item.reps_max
        ? `${item.sets} × ${item.reps_min} Wdh.`
        : `${item.sets} × ${item.reps_min}–${item.reps_max} Wdh.`;
  return `${work} · Pause ${item.rest_s} s · RPE ${formatNumberDe(item.rpe_target)}${
    item.superset_group !== null ? ` · Supersatz ${item.superset_group}` : ''
  }`;
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const catalog = getCatalog();
  const entry = isContentId(id) ? catalog.templateById.get(id) : undefined;
  if (!entry) {
    notFound();
  }
  const { template } = entry;
  const stats = sessionStats(template);
  const bars = volumeBars(template, catalog.exerciseById);
  const scale = Math.max(...bars.map((bar) => Math.max(bar.sets, bar.max)), 1) * 1.1;
  const pushPull = pushPullStats(template, catalog.exerciseById);
  const pct = (value: number) => `${Math.min(100, (value / scale) * 100).toFixed(1)}%`;
  const equipmentList = (ids: readonly string[]) =>
    ids.length === 0 ? '–' : ids.map(equipmentLabel).join(', ');

  return (
    <>
      <AdminHeader loggedIn />
      <main className={styles.stack}>
        <Link className={styles.backLink} href="/admin?tab=vorlagen">
          ← Alle Vorlagen
        </Link>
        <div>
          <h1 className={styles.title}>{template.title_de}</h1>
          <p className={styles.subtitle}>
            {GOAL_LABELS[template.goal_type]} · {LEVEL_LABELS[template.experience_level]} ·{' '}
            {template.sessions_per_week} Tage · {LOCATION_LABELS[template.location]} ·{' '}
            {template.minutes_min}–{template.minutes_max} min
          </p>
        </div>
        <ContentBadges
          status={template.status}
          needsExpertReview={entry.needsExpertReview}
          summary={entry.summary}
        />

        <IssueReport issues={entry.issues} />
        <AiDraftNotice show={entry.needsExpertReview} />

        <section className={styles.section} aria-labelledby="beschreibung">
          <h2 id="beschreibung" className={styles.h2}>
            Beschreibung
          </h2>
          <p>{template.description_de}</p>
          <dl className={styles.facts}>
            <dt>ID</dt>
            <dd className={styles.code}>{template.id}</dd>
            <dt>Pflicht-Geräte</dt>
            <dd>{equipmentList(template.required_equipment_ids)}</dd>
            <dt>Optionale Geräte</dt>
            <dd>{equipmentList(template.optional_equipment_ids)}</dd>
            <dt>Für</dt>
            <dd>{template.sex === null ? 'alle' : SEX_LABELS[template.sex]}</dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="woche">
          <h2 id="woche" className={styles.h2}>
            Wochenübersicht
          </h2>
          {template.sessions.map((session, index) => {
            const stat = stats[index]!;
            return (
              <div key={session.day_index} className={styles.session}>
                <div className={styles.sessionHead}>
                  <h3 className={styles.h3}>
                    Tag {session.day_index} · {session.name_de}
                  </h3>
                  <span className={stat.withinWindow ? styles.badge : styles.badgeWarning}>
                    ca. {stat.estimatedMinutes} min
                  </span>
                </div>
                <p className={`${styles.small} ${styles.muted}`}>
                  {FOCUS_LABELS[session.focus]} · geschätzte Dauer {stat.estimatedMinutes} min
                  (erlaubt {formatNumberDe(stat.window.min)}–{formatNumberDe(stat.window.max)} min)
                </p>
                <p className={styles.small}>
                  <strong>Aufwärmen:</strong> {session.warmup_de}
                </p>
                <ol className={styles.items} aria-label={`Übungen Tag ${session.day_index}`}>
                  {[...session.exercises]
                    .sort((a, b) => a.order_no - b.order_no)
                    .map((item) => {
                      const target = catalog.exerciseById.get(item.exercise_id);
                      return (
                        <li key={item.order_no} className={styles.item}>
                          <span className={styles.itemNo} aria-hidden>
                            {item.order_no}
                          </span>
                          <div>
                            {target ? (
                              <Link
                                className={styles.link}
                                href={`/admin/uebungen/${target.exercise.id}`}
                              >
                                {target.exercise.name_de}
                              </Link>
                            ) : (
                              <span className={styles.code}>{item.exercise_id} (fehlt)</span>
                            )}
                            <div className={styles.itemDose}>{dose(item)}</div>
                            {item.notes_de !== null && (
                              <div className={styles.itemDose}>{item.notes_de}</div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ol>
                <p className={styles.small}>
                  <strong>Cool-down:</strong> {session.cooldown_de}
                </p>
              </div>
            );
          })}
        </section>

        <section className={styles.section} aria-labelledby="volumen">
          <h2 id="volumen" className={styles.h2}>
            Wochensätze pro Muskelgruppe
          </h2>
          <p className={`${styles.small} ${styles.muted}`}>
            Hauptmuskel 1 Satz, Nebenmuskel ½ Satz. Grüner Bereich = Ziel für{' '}
            {GOAL_LABELS[template.goal_type]} · {LEVEL_LABELS[template.experience_level]}. Gelb =
            unter dem Ziel, rot = über der Obergrenze.
          </p>
          <ul className={styles.bars}>
            {bars.map((bar) => {
              const zoneStart = bar.min ?? 0;
              return (
                <li key={bar.muscle}>
                  <div className={styles.barLabel}>
                    <span>{muscleNameDe(bar.muscle)}</span>
                    <span className={styles.muted}>
                      {formatNumberDe(bar.sets)} Sätze (Ziel{' '}
                      {bar.min === null ? `bis ${bar.max}` : `${bar.min}–${bar.max}`})
                    </span>
                  </div>
                  <div
                    className={styles.barTrack}
                    role="img"
                    aria-label={`${muscleNameDe(bar.muscle)}: ${formatNumberDe(bar.sets)} Sätze, Ziel ${
                      bar.min === null ? `bis ${bar.max}` : `${bar.min} bis ${bar.max}`
                    }, ${bar.state === 'ok' ? 'im Zielbereich' : bar.state === 'low' ? 'darunter' : 'darüber'}`}
                  >
                    <span
                      className={styles.barZone}
                      style={{
                        left: pct(zoneStart),
                        width: `calc(${pct(bar.max)} - ${pct(zoneStart)})`,
                      }}
                    />
                    <span
                      className={`${styles.barFill} ${
                        bar.state === 'ok'
                          ? styles.barOk
                          : bar.state === 'low'
                            ? styles.barLow
                            : styles.barHigh
                      }`}
                      style={{ width: pct(bar.sets) }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={styles.h3}>
            Drücken : Ziehen = {pushPull.push} : {pushPull.pull} Sätze{' '}
            {pushPull.balanced ? '(ausgewogen)' : '(nicht ausgewogen – Hinweis V7)'}
          </p>
        </section>

        <OriginSection meta={template.meta} version={template.version} />
        <ReleaseHint ids={[template.id]} scope="ID dieser Vorlage" />
      </main>
    </>
  );
}
