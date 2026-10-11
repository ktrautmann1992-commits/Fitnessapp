/**
 * Kanonische CSV-Zeilen für Quellauszüge (docs/PLAN-PHASE-5.md 5.1, R2-B2).
 *
 * Eine „Zeile der Original-Datei“ ist die Folge der Zellen-Texte genau so, wie sie in der Original-Datei stehen
 * (bei xlsx der gespeicherte Text bzw. die gespeicherte Zahl, bei csv das Feld). Sie wird mit `serializeRecord`
 * immer gleich in eine CSV-Zeile übersetzt (RFC 4180, Komma, Anführungszeichen nur wenn nötig). `extract.csv`
 * besteht ausschließlich aus solchen Zeilen; `sources-integrity` prüft jede Zeile gegen die neu geladene
 * Original-Datei. Es gibt keine Umrechnung und keine Rundung.
 */

/** Ein Feld in Anführungszeichen, wenn es Komma, Anführungszeichen, Zeilenumbruch oder Rand-Leerzeichen hat. */
function serializeField(value: string): string {
  if (/[",\r\n]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Eine Zeile (Zellen-Texte) als CSV-Datensatz ohne Zeilenende. Leere Zellen am Ende fallen weg. */
export function serializeRecord(cells: readonly string[]): string {
  let end = cells.length;
  while (end > 0 && cells[end - 1] === '') {
    end -= 1;
  }
  return cells.slice(0, end).map(serializeField).join(',');
}

/** Ganze CSV-Datei aus Zeilen (Zeilenende `\n`, auch nach der letzten Zeile). */
export function serializeCsv(records: readonly (readonly string[])[]): string {
  return records.map((record) => `${serializeRecord(record)}\n`).join('');
}

/**
 * Liest CSV (RFC 4180) mit beliebigem Trennzeichen. Anführungszeichen dürfen Trennzeichen und Zeilenumbrüche
 * enthalten. Leere Zeilen werden übersprungen. Wirft bei offenem Anführungszeichen am Dateiende.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  const input = text.startsWith('﻿') ? text.slice(1) : text;

  const endRecord = () => {
    if (fieldStarted || record.length > 0 || field !== '') {
      record.push(field);
      records.push(record);
    }
    record = [];
    field = '';
    fieldStarted = false;
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === '') {
      inQuotes = true;
      fieldStarted = true;
    } else if (char === delimiter) {
      record.push(field);
      field = '';
      fieldStarted = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      endRecord();
    } else {
      field += char;
      fieldStarted = true;
    }
  }
  if (inQuotes) {
    throw new Error('CSV: Anführungszeichen am Dateiende nicht geschlossen.');
  }
  endRecord();
  return records;
}
