import {
  cleanSessionsToGo,
  skillPathExerciseIds,
  type SkillPathView,
  skillPathViews,
  type SkillStageView,
} from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { skillGateContextFromRows } from '@/data/skill-paths';
import { t } from '@/i18n';
import { todayIso } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useTrainingModes } from '@/state/use-training-modes';

const C = t.calisthenics.skills;

/**
 * Skill-Pfade (Calisthenics, docs/PLAN-CALISTHENICS-SCHLINGE.md 2.5): je Pfad die Stufenleiter mit aktueller Stufe,
 * nächstem Ziel und – falls gesperrt – den Gründen. Alles aus packages/core (skillPathViews); neutral und privat:
 * keine Abzeichen, keine Ranglisten, kein Teilen. Gratis, ohne KI.
 */
export default function SkillPathsScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const modes = useTrainingModes();
  const today = todayIso();
  const { ensureLibrary, library, rows, safetyRules } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const lib = library.kind === 'ready' ? library.library : null;
  const views = useMemo(() => {
    if (!rows || !lib || !safetyRules) return null;
    const ctx = skillGateContextFromRows({
      rows,
      library: lib,
      rules: safetyRules,
      modes: modes.state,
      today,
    });
    return ctx ? skillPathViews(ctx) : null;
  }, [rows, lib, safetyRules, modes.state, today]);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/mehr' as Href));
  const footer = <Button label={t.glossary.back} variant="secondary" onPress={back} />;
  const frame = (children: React.ReactNode) => (
    <Screen area="training" icon="trend" title={C.title} testID="skill-paths" footer={footer}>
      {children}
    </Screen>
  );
  if (library.kind === 'idle' || library.kind === 'loading') return frame(<LoadingState />);
  if (!lib) {
    return frame(
      <Notice tone="warning" testID="skill-paths-error">
        <Body>{C.loadError}</Body>
        <Button label={C.retry} variant="secondary" onPress={() => void ensureLibrary()} />
      </Notice>,
    );
  }
  const available = skillPathExerciseIds().some((id) => lib.exercises.get(id)?.status);
  const open = (exerciseId: string) =>
    router.push(`/uebungen/${encodeURIComponent(exerciseId)}` as Href);

  return frame(
    <>
      <Body>{C.intro}</Body>
      <Body muted>{C.clean}</Body>
      <Body muted>{C.privacy}</Body>
      {!available || !views ? (
        <Notice tone="info" testID="skill-paths-empty">
          {C.empty}
        </Notice>
      ) : (
        (['basics', 'skills'] as const).map((group) => (
          <View key={group} style={styles.group}>
            <Heading level={2}>{C.groups[group]}</Heading>
            {views
              .filter((v) => v.group === group)
              .map((view) => (
                <PathCard
                  key={view.pathId}
                  view={view}
                  onOpen={open}
                  nameOfId={(id) => lib.exercises.get(id)?.name_de ?? id}
                  textColor={theme.text}
                />
              ))}
          </View>
        ))
      )}
    </>,
  );
}

function PathCard({
  view,
  onOpen,
  nameOfId,
  textColor,
}: {
  view: SkillPathView;
  onOpen: (exerciseId: string) => void;
  nameOfId: (exerciseId: string) => string;
  textColor: string;
}) {
  const total = view.stages.length;
  const current = view.stages[view.currentIndex];
  const next = view.stages[view.currentIndex + 1];
  const nameOf = (stage: SkillStageView | undefined) => stage?.nameDe ?? stage?.exerciseId ?? '';
  return (
    <View testID={`skill-path-${view.pathId}`}>
      <Card>
        <Heading level={2}>{C.paths[view.pathId]}</Heading>
        {current ? (
          <View style={styles.summary} testID={`skill-current-${view.pathId}`}>
            <Text style={[styles.currentName, { color: textColor }]}>
              {C.current(nameOf(current))}
            </Text>
            <Body muted>
              {C.stageOf(current.index + 1, total)} ·{' '}
              {C.target(current.target.sets, current.target.reps, current.target.seconds)}
            </Body>
            {!current.gate.allowed ? (
              <Body muted>{C.currentLocked}</Body>
            ) : !view.started ? (
              <Body muted>{C.notStarted}</Body>
            ) : view.suggestion === null && next ? (
              <Body muted>{C.toGo(cleanSessionsToGo(current.progress))}</Body>
            ) : null}
          </View>
        ) : null}
        {view.suggestion === 'advance' && next ? (
          <Notice tone="success" testID={`skill-suggestion-${view.pathId}`}>
            {C.suggestion.advance(nameOf(next))}
          </Notice>
        ) : view.suggestion === 'blocked' ? (
          <Notice tone="info" testID={`skill-suggestion-${view.pathId}`}>
            {C.suggestion.blocked}
          </Notice>
        ) : view.suggestion === 'mastered' ? (
          <Notice tone="success" testID={`skill-suggestion-${view.pathId}`}>
            {C.suggestion.mastered}
          </Notice>
        ) : view.suggestion === 'regress' ? (
          <Notice tone="info" testID={`skill-suggestion-${view.pathId}`}>
            {C.suggestion.regress(nameOf(view.stages[view.currentIndex - 1]))}
          </Notice>
        ) : null}
        <View style={styles.stages}>
          {view.stages.map((stage) => (
            <StageRow
              key={stage.exerciseId}
              pathId={view.pathId}
              stage={stage}
              total={total}
              onOpen={onOpen}
              nameOfId={nameOfId}
              textColor={textColor}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

const MARK: Record<SkillStageView['role'], string> = {
  done: '✓',
  current: '●',
  next: '○',
  later: '○',
};

function StageRow({
  pathId,
  stage,
  total,
  onOpen,
  nameOfId,
  textColor,
}: {
  pathId: string;
  stage: SkillStageView;
  total: number;
  onOpen: (exerciseId: string) => void;
  nameOfId: (exerciseId: string) => string;
  textColor: string;
}) {
  const name = stage.nameDe ?? stage.exerciseId;
  // Sperren bei allen Stufen außer geübten (auch die erste Stufe eines Skills kann für Einsteiger gesperrt sein).
  const locked = stage.role !== 'done' && !stage.gate.allowed;
  const reasons = stage.gate.reasons.map((r) => C.locks[r]);
  const requirementLines = stage.gate.requirements
    .filter((r) => !r.met)
    .map((r) => C.requirement(nameOfId(r.exerciseId), r.best, r.reps));
  const label = locked
    ? C.lockedA11y(name, reasons.join(', '))
    : C.stageA11y(stage.index + 1, total, name, C.roles[stage.role]);
  return (
    <View style={styles.stage} testID={`skill-stage-${pathId}-${stage.index}`}>
      <Pressable
        accessibilityRole={stage.nameDe ? 'link' : 'text'}
        accessibilityLabel={label}
        disabled={!stage.nameDe}
        onPress={() => onOpen(stage.exerciseId)}
        style={styles.stageHead}
      >
        <Text
          style={[
            styles.mark,
            { color: textColor, opacity: stage.role === 'later' || locked ? 0.55 : 1 },
          ]}
        >
          {MARK[stage.role]}
        </Text>
        <View style={styles.stageText}>
          <Text
            style={[
              styles.stageName,
              {
                color: textColor,
                fontWeight: stage.role === 'current' ? fontWeight.bold : fontWeight.regular,
                opacity: stage.role === 'later' || locked ? 0.7 : 1,
              },
            ]}
          >
            {name}
          </Text>
          <Body muted>
            {C.roles[stage.role]} ·{' '}
            {C.target(stage.target.sets, stage.target.reps, stage.target.seconds)}
          </Body>
          {locked ? (
            <Body muted testID={`skill-lock-${pathId}-${stage.index}`}>
              {reasons.join(' · ')}
            </Body>
          ) : null}
          {locked && requirementLines.length > 0 && stage.role !== 'later'
            ? requirementLines.map((line) => (
                <Body key={line} muted>
                  {line}
                </Body>
              ))
            : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  summary: { gap: 2 },
  currentName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  stages: { gap: spacing.xs, marginTop: spacing.xs },
  stage: { minHeight: 44 },
  stageHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  mark: { fontSize: fontSize.md, width: 18, textAlign: 'center' },
  stageText: { flex: 1, gap: 2 },
  stageName: { fontSize: fontSize.md },
});
