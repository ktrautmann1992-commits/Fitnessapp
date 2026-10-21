import { cycleModuleOffered } from '@fitnessapp/core';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ListRow, SectionLabel } from './design';
import { Body, Button, Card } from './ui';
import {
  cycleBackendFor,
  hasActiveCycleConsent,
  validCycleConsentGrantedAt,
} from '@/data/cycle-backend';
import { deCycle as C } from '@/i18n/de-cycle';
import { useApp } from '@/state/app-state';
import { peekCycleSettings } from '@/state/use-cycle';

/**
 * Einstiege ins Zyklus-Modul außerhalb des Zyklus-Bildschirms (Plan 7.2, 9.1, K7):
 * - `CycleMoreRow` unter „Mehr“: sichtbar, wenn das Modul angeboten wird (nicht „männlich“; Supabase nur mit
 *   Freischaltung) oder schon eine Einwilligung besteht (dann auch nach Wechsel auf „männlich“, S8),
 * - `CycleTodayCard` auf „Heute“: nur bei gültiger Einwilligung und nicht pausiert – OHNE Zyklus-Wort.
 */
export function useCycleVisible(): boolean {
  const app = useApp();
  const cycle = cycleBackendFor(app.backend);
  const consents = app.rows?.consents ?? [];
  const consentActive = hasActiveCycleConsent(consents);
  const offered = cycleModuleOffered(app.answers.sex ?? null);
  const [open, setOpen] = useState(cycle?.mode === 'local');
  useFocusEffect(
    useCallback(() => {
      if (!cycle || cycle.mode === 'local' || consentActive || !offered) return;
      let alive = true;
      cycle
        .access()
        .then((access) => {
          if (alive) setOpen(access.open);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [consentActive, cycle, offered]),
  );
  if (!cycle) return false;
  return consentActive || (offered && open);
}

export function CycleMoreRow({ onPress }: { onPress: () => void }) {
  const app = useApp();
  const visible = useCycleVisible();
  if (!visible) return null;
  const manage = !cycleModuleOffered(app.answers.sex ?? null);
  return (
    <ListRow
      icon="calendar"
      label={C.moreLabel}
      description={manage ? C.moreDescriptionManage : C.moreDescription}
      onPress={onPress}
      testID="more-cycle"
    />
  );
}

export function CycleTodayCard() {
  const router = useRouter();
  const app = useApp();
  const consentAt = validCycleConsentGrantedAt(app.rows?.consents ?? [], app.versions.cycle_data);
  const settings = peekCycleSettings(app.session?.userId ?? null);
  if (
    consentAt === null ||
    !cycleModuleOffered(app.answers.sex ?? null) ||
    !cycleBackendFor(app.backend) ||
    settings?.paused === true ||
    settings?.status === 'pregnant' ||
    settings === null
  ) {
    return null;
  }
  return (
    <View testID="today-checkin">
      <SectionLabel>{C.todayCard.title}</SectionLabel>
      <Card>
        <Body>{C.todayCard.body}</Body>
        <Button
          label={C.todayCard.open}
          variant="secondary"
          onPress={() => router.push('/zyklus' as Href)}
          testID="today-checkin-open"
        />
      </Card>
    </View>
  );
}
