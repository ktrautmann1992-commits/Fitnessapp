import { describe, expect, it } from 'vitest';

import { readOriginalRecords } from './extract-source';
import { FDC_CSV_FILES, readFdcCsvZipRecords } from './fdc-csv';
import { unpackOriginal } from './original-format';
import { sourceNutrientRows } from './source-rows';
import { findSource, SOURCES } from './sources';
import { buildZip } from './test-helpers';

/** USDA FoodData Central (SR Legacy) als CSV-ZIP, langes Format – kleine Nachbildung mit echten Nährstoff-IDs. */
const NUTRIENT_CSV = [
  '"id","name","unit_name","nutrient_nbr","rank"',
  '"1003","Protein","G","203","600"',
  '"1004","Total lipid (fat)","G","204","800"',
  '"1005","Carbohydrate, by difference","G","205","1110"',
  '"1008","Energy","KCAL","208","300"',
  '"1018","Alcohol, ethyl","G","221","18200"',
  '"1079","Fiber, total dietary","G","291","1200"',
  '"1093","Sodium, Na","MG","307","5800"',
  '"1258","Fatty acids, total saturated","G","606","9700"',
  '"2000","Sugars, total including NLEA","G","269","1510"',
].join('\n');

const FOOD_CSV = [
  '"fdc_id","data_type","description","food_category_id","publication_date"',
  '"170923","sr_legacy_food","Spices, cumin seed","2","2019-04-01"',
  '"173180","sr_legacy_food","Beverages, Whey protein powder isolate","14","2019-04-01"',
].join('\n');

const row = (id: number, fdc: string, nutrient: string, amount: string) =>
  `"${id}","${fdc}","${nutrient}","${amount}","","","","","","",""`;

const FOOD_NUTRIENT_CSV = [
  '"id","fdc_id","nutrient_id","amount","data_points","derivation_id","min","max","median","footnote","min_year_acquired"',
  row(1, '170923', '1008', '375'),
  row(2, '170923', '1003', '17.81'),
  row(3, '170923', '1004', '22.27'),
  row(4, '170923', '1005', '44.24'),
  row(5, '170923', '1079', '10.5'),
  row(6, '170923', '2000', '2.25'),
  row(7, '170923', '1258', '1.535'),
  row(8, '170923', '1093', '168'),
  row(9, '173180', '1008', '359'),
  row(10, '173180', '1003', '78.13'),
  row(11, '173180', '1004', '1.56'),
  row(12, '173180', '1005', '6.25'),
  row(13, '173180', '1093', '469'),
].join('\n');

const zip = (extra: Record<string, string> = {}) =>
  buildZip({
    'FoodData_Central_sr_legacy_food_csv_2018-04/food.csv': FOOD_CSV,
    'FoodData_Central_sr_legacy_food_csv_2018-04/nutrient.csv': NUTRIENT_CSV,
    'FoodData_Central_sr_legacy_food_csv_2018-04/food_nutrient.csv': FOOD_NUTRIENT_CSV,
    ...extra,
  });

const USDA = findSource(SOURCES, 'usda_fdc', 'sr-legacy-2018-04');

describe('USDA FoodData Central CSV-ZIP (fdc-csv.ts)', () => {
  it('Quelle steht in der Allowlist, Format fdc_csv_zip, Prüfsumme und Spalten festgenagelt', () => {
    expect(USDA?.format).toBe('fdc_csv_zip');
    expect(USDA?.url).toMatch(/^https:\/\/fdc\.nal\.usda\.gov\//);
    expect(USDA?.originalSha256).toBe(
      'b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0',
    );
    expect(USDA?.columnsStatus).toBe('confirmed');
    expect(USDA?.urlStatus).toBe('confirmed');
  });

  it('stellt das lange Format in eine Zeile je Lebensmittel um – Werte als Text unverändert, fehlende leer', () => {
    const records = readFdcCsvZipRecords(zip());
    expect(records[0]).toEqual([
      'fdc_id',
      'description',
      '1003 Protein (g)',
      '1004 Total lipid (fat) (g)',
      '1005 Carbohydrate, by difference (g)',
      '1008 Energy (kcal)',
      '1079 Fiber, total dietary (g)',
      '1093 Sodium, Na (mg)',
      '1258 Fatty acids, total saturated (g)',
      '2000 Sugars, total including NLEA (g)',
    ]);
    expect(records[1]).toEqual([
      '170923',
      'Spices, cumin seed',
      '17.81',
      '22.27',
      '44.24',
      '375',
      '10.5',
      '168',
      '1.535',
      '2.25',
    ]);
    // Whey ohne Ballaststoffe, Zucker, gesättigte FS in der Quelle → leere Zellen (nie 0).
    expect(records[2]).toEqual([
      '173180',
      'Beverages, Whey protein powder isolate',
      '78.13',
      '1.56',
      '6.25',
      '359',
      '',
      '469',
      '',
      '',
    ]);
    // Deterministisch: zweimal gelesen = gleiche Tabelle (sources-integrity rechnet nach).
    expect(readFdcCsvZipRecords(zip())).toEqual(records);
  });

  it('fehlende oder doppelte Datei im ZIP → Abbruch mit Liste (nie geraten)', () => {
    const withoutFood = buildZip({
      'a/nutrient.csv': NUTRIENT_CSV,
      'a/food_nutrient.csv': FOOD_NUTRIENT_CSV,
    });
    expect(() => readFdcCsvZipRecords(withoutFood)).toThrow(/food\.csv: fehlt/);
    expect(() => readFdcCsvZipRecords(zip({ 'b/food.csv': FOOD_CSV }))).toThrow(/food\.csv: 2-mal/);
    expect(FDC_CSV_FILES).toEqual(['food.csv', 'nutrient.csv', 'food_nutrient.csv']);
  });

  it('doppelter Nährstoff je Lebensmittel → Abbruch', () => {
    const doubled = buildZip({
      'food.csv': FOOD_CSV,
      'nutrient.csv': NUTRIENT_CSV,
      'food_nutrient.csv': `${FOOD_NUTRIENT_CSV}\n${row(99, '170923', '1003', '18')}`,
    });
    expect(() => readFdcCsvZipRecords(doubled)).toThrow(/1003 für Lebensmittel 170923 mehrfach/);
  });

  it('unpackOriginal behält das ganze ZIP als Original-Datei (Prüfsumme über das Archiv)', () => {
    if (USDA === undefined) throw new Error('USDA fehlt');
    const buffer = zip();
    const unpacked = unpackOriginal(buffer, USDA, {
      status: 200,
      contentType: 'application/zip',
      contentDisposition: null,
      finalUrl: USDA.url,
    });
    expect(unpacked.data.equals(buffer)).toBe(true);
    expect(readOriginalRecords(unpacked.data, USDA)).toEqual(readFdcCsvZipRecords(buffer));
  });

  it('Nährwerte: verfügbare KH = by difference − Ballaststoffe, Salz aus Natrium; fehlende Ballaststoffe → keine KH', () => {
    if (USDA === undefined) throw new Error('USDA fehlt');
    const result = sourceNutrientRows(readFdcCsvZipRecords(zip()), USDA);
    expect(result.rows.get('170923')?.nutrients_per_100g).toMatchObject({
      kcal: 375,
      protein_g: 17.81,
      carbs_g: 33.74,
      sugar_g: 2.25,
      fat_g: 22.27,
      sat_fat_g: 1.535,
      fiber_g: 10.5,
      salt_g: 0.42,
    });
    // Ohne Ballaststoff-Wert lassen sich verfügbare KH nicht bestimmen → Zeile nicht übernommen (nie geschätzt).
    expect(result.rows.has('173180')).toBe(false);
    expect(result.problems.find((p) => p.ref === '173180')?.message).toMatch(/carbs_g/);
  });
});
