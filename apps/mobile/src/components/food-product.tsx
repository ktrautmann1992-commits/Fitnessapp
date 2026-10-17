import {
  checkUserFoodProduct,
  isValidUserProductBrand,
  isValidUserProductName,
  normalizeBarcode,
  normalizeCustomMealName,
  OPEN_FOOD_FACTS,
  productDataIsOld,
  type ProductLookupResponse,
  type UserFoodProduct,
  userFoodProductSchema,
  USER_FOOD_PRODUCT_LIMITS,
} from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';

import { t } from '@/i18n';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  PER100_ROWS,
  per100Text,
  productCheckHints,
  productDateText,
} from '@/lib/food-product-format';
import type { UserProductPrefill } from '@/lib/product-handoff';

import { ConfirmDialog } from './screen';
import { Body, Button, Card, Checkbox, ChoiceList, Heading, Notice, TextField } from './ui';

type Found = Extract<ProductLookupResponse, { code: 'found' }>;

/**
 * Produktansicht (Etappe E4a, docs/PLAN-E4.md 2.2): Name, Marke, Packung als reiner Text; Nährwerte je 100 g/ml
 * (fehlend „–“, bei „Kalorienzahlen aus“ gar keine Zahlen); Hinweise der Prüfung; fester Satz zu Unverträglichkeiten;
 * Quellenangabe mit Lizenz (ODbL 4.3) und „Mehr zur Lizenz“; Link „Bei Open Food Facts ansehen“ nur nach dem Hinweis
 * auf die IP-Adresse (E4-G11). Keine Bilder, kein Nutri-Score, keine Bewertung (E4-G6, E4-G9). testIDs ohne Name/Marke.
 */
export function ProductCard({
  found,
  showNumbers,
  now,
  reviewConfirmed,
  onReviewConfirmed,
}: {
  found: Found;
  showNumbers: boolean;
  now: string;
  reviewConfirmed: boolean;
  onReviewConfirmed: (checked: boolean) => void;
}) {
  const router = useRouter();
  const [leave, setLeave] = useState(false);
  const { product, check } = found;
  const hints = productCheckHints(check.level, check.reasons, showNumbers);
  const lastModified = product.source.off_last_modified;
  return (
    <View style={{ gap: 12 }} testID="food-product-card">
      <Card>
        <Heading level={2}>{product.name_de}</Heading>
        {product.brand_de !== null ? <Body>{product.brand_de}</Body> : null}
        {product.quantity_label !== null ? <Body muted>{product.quantity_label}</Body> : null}
        {found.mock ? (
          <Body muted testID="food-product-mock">
            {t.foodProduct.mockNote}
          </Body>
        ) : null}
        {found.stale ? (
          <Body muted testID="food-product-stale">
            {t.foodProduct.stale(productDateText(product.source.retrieved_at))}
          </Body>
        ) : null}
      </Card>
      {showNumbers && check.level !== 'blocked' ? (
        <Card>
          <Body>{t.foodProduct.per100(product.base_unit)}</Body>
          <View testID="food-product-nutrients" style={{ gap: 2 }}>
            {PER100_ROWS.map((key) => (
              <View
                key={key}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
              >
                <Body muted>{t.foodProduct.nutrients[key]}</Body>
                <Body>{per100Text(key, product.per100[key])}</Body>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {!showNumbers ? <Body muted>{t.foodProduct.numbersHidden}</Body> : null}
      {check.level === 'blocked' ? (
        <Notice tone="warning" testID="food-product-blocked">
          <Body>{t.foodProduct.blocked}</Body>
          {hints.map((hint) => (
            <Body key={hint}>{hint}</Body>
          ))}
        </Notice>
      ) : null}
      {check.level === 'review' ? (
        <Notice tone="warning" testID="food-product-review">
          <Body>{showNumbers ? t.foodProduct.review : t.foodProduct.reviewNoNumbers}</Body>
          {showNumbers ? hints.map((hint) => <Body key={hint}>{hint}</Body>) : null}
          <Checkbox
            label={t.foodProduct.reviewConfirm}
            checked={reviewConfirmed}
            onChange={onReviewConfirmed}
            testID="food-product-review-confirm"
          />
        </Notice>
      ) : null}
      {lastModified !== null && productDataIsOld(lastModified, now) ? (
        <Body muted>{t.foodProduct.oldData(productDateText(lastModified))}</Body>
      ) : null}
      <Body muted>{t.foodProduct.allergenNote}</Body>
      <Body muted testID="food-product-source">
        {t.foodProduct.source(productDateText(product.source.retrieved_at))}
      </Body>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          label={t.foodProduct.licenseLink}
          variant="link"
          onPress={() => router.push('/lizenzen' as Href)}
          testID="food-product-license"
        />
        {found.mock ? null : (
          <Button
            label={t.foodProduct.offLink}
            variant="link"
            onPress={() => setLeave(true)}
            testID="food-product-off-link"
          />
        )}
      </View>
      <ConfirmDialog
        visible={leave}
        title={t.foodProduct.offLinkTitle}
        message={t.foodProduct.offLinkText}
        confirmLabel={t.foodProduct.offLinkConfirm}
        confirmVariant="primary"
        onCancel={() => setLeave(false)}
        onConfirm={() => {
          setLeave(false);
          void Linking.openURL(`${OPEN_FOOD_FACTS.productPageUrl}${product.code}`);
        }}
        testID="food-product-off-dialog"
      />
    </View>
  );
}

type FieldKey = 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'sugar_g' | 'salt_g' | 'serving_g';

/**
 * Eigenes Produkt anlegen bzw. ändern (Plan 2.3): Name (Pflicht), Marke und Nummer (freiwillig), Bezug 100 g/100 ml,
 * kcal/Eiweiß/Kohlenhydrate/Fett (Pflicht), Zucker/Salz/Portion (freiwillig). Prüfung aus packages/core: unmögliche
 * Werte nicht speicherbar, Atwater-Abweichung → ruhige Rückfrage „Stimmen die Werte?“. Nur mit Zahlen (bei „Zahlen aus“
 * zeigt der Bildschirm stattdessen den Hinweis, E4-G8). „Deine Angaben – nur für dich sichtbar“.
 */
export function UserFoodProductForm({
  id,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  id: string;
  initial: UserProductPrefill;
  busy: boolean;
  onSave: (product: UserFoodProduct) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name_de ?? '');
  const [brand, setBrand] = useState(initial.brand_de ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  const [unit, setUnit] = useState<'g' | 'ml'>(initial.base_unit ?? 'g');
  const [values, setValues] = useState<Record<FieldKey, string>>({
    kcal: formatDecimal(initial.kcal ?? null),
    protein_g: formatDecimal(initial.protein_g ?? null),
    carbs_g: formatDecimal(initial.carbs_g ?? null),
    fat_g: formatDecimal(initial.fat_g ?? null),
    sugar_g: formatDecimal(initial.sugar_g ?? null),
    salt_g: formatDecimal(initial.salt_g ?? null),
    serving_g: formatDecimal(initial.serving_g ?? null),
  });
  const [errors, setErrors] = useState<
    Partial<Record<FieldKey | 'name' | 'brand' | 'code' | 'sum', string>>
  >({});
  const [confirm, setConfirm] = useState<UserFoodProduct | null>(null);
  const F = t.foodProduct.field;
  const E = t.foodProduct.fieldInvalid;
  const U = USER_FOOD_PRODUCT_LIMITS;

  function build(): UserFoodProduct | null {
    const next: typeof errors = {};
    const cleanName = normalizeCustomMealName(name);
    const cleanBrand = normalizeCustomMealName(brand);
    if (!isValidUserProductName(cleanName)) next.name = E.name;
    if (cleanBrand !== '' && !isValidUserProductBrand(cleanBrand)) next.brand = E.brand;
    let normalizedCode: string | null = null;
    if (code.trim() !== '') {
      const checked = normalizeBarcode(code);
      if (checked.ok) normalizedCode = checked.code;
      else next.code = E.code;
    }
    const num = (key: FieldKey) => {
      const value = parseDecimal(values[key]);
      return value === null || Number.isNaN(value) ? null : value;
    };
    const per100 = (key: FieldKey, required: boolean) => {
      const value = num(key);
      if (value === null) {
        if (required || values[key].trim() !== '') next[key] = E.per100;
        return null;
      }
      if (value < U.per100G.min || value > U.per100G.max || Math.round(value * 10) / 10 !== value) {
        next[key] = E.per100;
      }
      return value;
    };
    const kcal = num('kcal');
    if (kcal === null || !Number.isInteger(kcal) || kcal < U.kcal.min || kcal > U.kcal.max) {
      next.kcal = E.kcal;
    }
    const protein = per100('protein_g', true);
    const carbs = per100('carbs_g', true);
    const fat = per100('fat_g', true);
    const sugar = per100('sugar_g', false);
    const salt = per100('salt_g', false);
    const serving = num('serving_g');
    if (
      values.serving_g.trim() !== '' &&
      (serving === null ||
        serving < U.servingG.min ||
        serving > U.servingG.max ||
        Math.round(serving * 10) / 10 !== serving)
    ) {
      next.serving_g = E.serving;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return null;
    }
    const parsed = userFoodProductSchema.safeParse({
      id,
      name_de: cleanName,
      brand_de: cleanBrand === '' ? null : cleanBrand,
      code: normalizedCode,
      base_unit: unit,
      kcal,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      sugar_g: sugar,
      salt_g: salt,
      serving_g: values.serving_g.trim() === '' ? null : serving,
      based_on_off: initial.based_on_off ?? false,
    });
    if (!parsed.success || checkUserFoodProduct(parsed.data).level === 'blocked') {
      setErrors({ sum: E.sum });
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  const field = (key: FieldKey, label: string) => (
    <TextField
      key={key}
      label={label}
      value={values[key]}
      onChangeText={(text) => setValues((v) => ({ ...v, [key]: text }))}
      keyboardType="decimal-pad"
      maxLength={7}
      error={errors[key]}
      testID={`user-product-${key}`}
    />
  );

  return (
    <View style={{ gap: 8 }} testID="user-product-form">
      <Notice tone="info">{t.foodProduct.ownPrivacy}</Notice>
      <TextField
        label={F.name}
        hint={F.nameHint}
        value={name}
        onChangeText={setName}
        maxLength={U.nameMaxChars + 10}
        error={errors.name}
        testID="user-product-name"
      />
      <TextField
        label={F.brand}
        hint={F.brandHint}
        value={brand}
        onChangeText={setBrand}
        maxLength={U.brandMaxChars + 10}
        error={errors.brand}
        testID="user-product-brand"
      />
      <TextField
        label={F.code}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={20}
        error={errors.code}
        testID="user-product-code"
      />
      <ChoiceList
        label={F.unit}
        horizontal
        options={[
          { value: 'g' as const, label: F.unitG },
          { value: 'ml' as const, label: F.unitMl },
        ]}
        value={unit}
        onChange={setUnit}
      />
      {field('kcal', F.kcal)}
      {field('protein_g', F.protein)}
      {field('carbs_g', F.carbs)}
      {field('sugar_g', F.sugar)}
      {field('fat_g', F.fat)}
      {field('salt_g', F.salt)}
      {field('serving_g', F.serving)}
      {errors.sum ? (
        <Notice tone="warning" testID="user-product-sum">
          {errors.sum}
        </Notice>
      ) : null}
      <Button
        label={t.foodProduct.save}
        loading={busy}
        onPress={() => {
          const product = build();
          if (product === null) return;
          if (checkUserFoodProduct(product).level === 'review') {
            setConfirm(product);
            return;
          }
          onSave(product);
        }}
        testID="user-product-save"
      />
      <Button
        label={t.foodProduct.cancel}
        variant="secondary"
        onPress={onCancel}
        testID="user-product-cancel"
      />
      <ConfirmDialog
        visible={confirm !== null}
        title={t.foodProduct.ownConfirmTitle}
        message={t.foodProduct.ownConfirmText}
        confirmLabel={t.foodProduct.ownConfirmYes}
        confirmVariant="primary"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const product = confirm;
          setConfirm(null);
          if (product) onSave(product);
        }}
        testID="user-product-confirm"
      />
    </View>
  );
}
