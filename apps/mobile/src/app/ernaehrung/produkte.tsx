import { canAddUserFoodProduct, type UserFoodProduct } from '@fitnessapp/core';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { UserFoodProductForm } from '@/components/food-product';
import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { newId } from '@/data/create-backend';
import type { UserFoodProductRow } from '@/data/types';
import { userFoodProductFromRow, userFoodProductsFromRows } from '@/data/user-food-product-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatKcal } from '@/lib/nutrition-format';
import { setProductHandoff, type UserProductPrefill } from '@/lib/product-handoff';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { healthConsentStatus, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/**
 * Ernährung → „Eigene Gerichte“ → „Eigene Produkte“ (Etappe E4a, docs/PLAN-E4.md 2.3): Liste (zuletzt geändert
 * zuerst), Anlegen, Ändern, Löschen (mit Rückfrage; eingetragene Tage behalten ihre Werte), Eintragen (über die
 * Produktansicht). Höchstens 200. Nur mit Einwilligung health_data (Name/Marke = Freitext); ohne gültige Einwilligung
 * nur Löschen. Bei „Kalorienzahlen aus“ kein Anlegen/Ändern (E4-G8) und keine kcal. testIDs nur mit Position.
 */
export default function UserFoodProductsScreen() {
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const view = useNutritionWeek(today);
  const [editing, setEditing] = useState<{ id: string; prefill: UserProductPrefill } | null>(null);
  const [deleting, setDeleting] = useState<UserFoodProductRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const rows = app.rows;
  const back = () =>
    router.canGoBack() ? router.back() : router.replace('/ernaehrung/gerichte' as Href);
  const shell = (children: ReactNode) => (
    <Screen
      title={t.foodProduct.ownTitle}
      testID="user-products"
      footer={
        <Button
          label={t.foodLog.done}
          variant="secondary"
          onPress={back}
          testID="user-products-done"
        />
      }
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.foodLog.unsupported}</Notice>);
  }
  if (!nutritionReady(view)) return shell(<NutritionGate view={view} />);
  const products = userFoodProductsFromRows(rows);
  const consentValid = healthConsentStatus(rows, app.versions) === 'valid';
  const showNumbers = view.showNumbers;
  const canEdit = consentValid && showNumbers;
  const canAdd = canEdit && canAddUserFoodProduct(products);

  if (editing !== null) {
    return shell(
      <>
        <Heading level={2}>
          {products.some((p) => p.id === editing.id)
            ? t.foodProduct.ownEditTitle
            : t.foodProduct.ownCreateTitle}
        </Heading>
        <UserFoodProductForm
          id={editing.id}
          initial={editing.prefill}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(product: UserFoodProduct) => {
            setBusy(true);
            app
              .saveUserFoodProduct(product)
              .then(() => {
                setEditing(null);
                setMessage({ text: t.foodProduct.ownSaved, tone: 'success' });
              })
              .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
              .finally(() => setBusy(false));
          }}
        />
        {message ? (
          <Notice tone={message.tone} testID="user-products-message">
            {message.text}
          </Notice>
        ) : null}
      </>,
    );
  }

  return shell(
    <>
      <Body>{t.foodProduct.ownIntro}</Body>
      <Body muted>{t.foodProduct.ownPrivacy}</Body>
      {!consentValid ? (
        <Notice tone="info" testID="user-products-consent">
          <Body>{t.foodProduct.ownConsentMissing}</Body>
          <Button
            label={t.foodLog.consentButton}
            variant="secondary"
            onPress={() => router.push('/health-consent')}
          />
        </Notice>
      ) : null}
      {consentValid && !showNumbers ? (
        <Notice tone="info" testID="user-product-numbers-off">
          {t.foodProduct.ownNumbersOff}
        </Notice>
      ) : null}
      <Body muted testID="user-products-count">
        {t.foodProduct.ownCount(products.length)}
      </Body>
      {canEdit ? (
        <Button
          label={t.foodProduct.ownCreate}
          disabled={!canAdd}
          onPress={() => setEditing({ id: newId(), prefill: {} })}
          testID="user-products-create"
        />
      ) : null}
      {canEdit && !canAdd ? (
        <Notice tone="info" testID="user-products-limit">
          {t.foodProduct.ownLimit}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="user-products-message">
          {message.text}
        </Notice>
      ) : null}
      {products.length === 0 ? (
        <Body muted testID="user-products-empty">
          {t.foodProduct.ownEmpty}
        </Body>
      ) : (
        <View style={{ gap: 8 }} testID="user-products-list">
          {products.map((product, index) => (
            <Card key={product.id}>
              <Body>{product.name_de}</Body>
              {product.brand_de !== null ? <Body muted>{product.brand_de}</Body> : null}
              {showNumbers ? (
                <Body
                  muted
                >{`${formatKcal(product.kcal)} kcal ${t.foodProduct.per100(product.base_unit).toLowerCase()}`}</Body>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {consentValid ? (
                  <Button
                    label={t.foodProduct.ownUse}
                    accessibilityLabel={t.foodProduct.ownUseA11y(product.name_de)}
                    variant="secondary"
                    onPress={() => {
                      setProductHandoff({ ownId: product.id });
                      router.push(`/ernaehrung/produkt?tag=${today}` as Href);
                    }}
                    testID={`user-products-use-${index}`}
                  />
                ) : null}
                {canEdit ? (
                  <Button
                    label={t.foodProduct.ownEdit}
                    accessibilityLabel={t.foodProduct.ownEditA11y(product.name_de)}
                    variant="secondary"
                    onPress={() =>
                      setEditing({ id: product.id, prefill: userFoodProductFromRow(product) })
                    }
                    testID={`user-products-edit-${index}`}
                  />
                ) : null}
                <Button
                  label={t.foodProduct.ownDelete}
                  accessibilityLabel={t.foodProduct.ownDeleteA11y(product.name_de)}
                  variant="danger"
                  disabled={busy}
                  onPress={() => setDeleting(product)}
                  testID={`user-products-delete-${index}`}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={deleting !== null}
        title={t.foodProduct.ownDeleteTitle}
        message={t.foodProduct.ownDeleteText}
        confirmLabel={t.foodProduct.ownDelete}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const product = deleting;
          setDeleting(null);
          if (!product) return;
          setBusy(true);
          app
            .deleteUserFoodProduct(product.id)
            .then(() => setMessage({ text: t.foodProduct.ownDeleted, tone: 'success' }))
            .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
            .finally(() => setBusy(false));
        }}
        testID="user-products-delete-dialog"
      />
    </>,
  );
}
