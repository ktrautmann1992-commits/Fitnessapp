/**
 * Quelle auf blsdb.de (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b): Download-Link aus der Seite lesen, Bot-Sperren
 * erkennen (nie umgehen), Format der Antwort erkennen, höflich abrufen. Alle Seiten und Dateien sind ATTRAPPEN.
 */
import { describe, expect, it } from 'vitest';

import { fetchSourceOriginal, USER_AGENT } from './download';
import {
  detectChallenge,
  findDownloadLinks,
  maskUrl,
  selectDownloadLink,
  SourceDownloadError,
} from './download-page';
import { sha256Hex } from './extract-source';
import {
  diagnoseOriginal,
  filenameFromContentDisposition,
  unpackOriginal,
} from './original-format';
import { decodeXmlText, readXlsxRows, XLSX_LIMITS } from './xlsx';
import {
  buildZip,
  downloadPageHtml,
  fakeSite,
  TEST_PAGE_SOURCE,
  TEST_SOURCE,
  testOriginal,
} from './test-helpers';

const PAGE = TEST_PAGE_SOURCE.url;
const CONFIG = { linkPath: '/download', tokenParam: 'token', redirectHosts: [] as string[] };
const META = {
  status: 200,
  contentType: 'application/octet-stream',
  contentDisposition: null,
  finalUrl: 'https://daten.example.org/download?token=ABCD-EFGH',
};
const noWait = { sleep: () => Promise.resolve(), retryDelaysMs: [1, 1] };

function errorOf(fn: () => unknown): SourceDownloadError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SourceDownloadError);
    return error as SourceDownloadError;
  }
  throw new Error('kein Fehler geworfen');
}

describe('Download-Link aus der Seite lesen', () => {
  it('genau ein Treffer (relativ, &amp; aufgelöst, doppelter Knopf zählt einmal) → Link', () => {
    const html = downloadPageHtml([
      '/download?token=6NHL-47N5-K4S1&amp;lang=de',
      'https://daten.example.org/download?token=6NHL-47N5-K4S1&lang=de',
      '/faq',
      '/download',
    ]);
    expect(selectDownloadLink(html, PAGE, CONFIG)).toBe(
      'https://daten.example.org/download?token=6NHL-47N5-K4S1&lang=de',
    );
  });

  it('kein Treffer → Abbruch mit Liste der Links (Codes gekürzt)', () => {
    const error = errorOf(() =>
      selectDownloadLink(downloadPageHtml(['/faq', '/download', '/download?token=']), PAGE, CONFIG),
    );
    expect(error.message).toMatch(/Kein Download-Link .*genau einen Link/);
    expect(error.diagnostics.join('\n')).toMatch(/Links auf der Seite \(3/);
  });

  it('zwei verschiedene Treffer → Abbruch, es wird nicht geraten', () => {
    const error = errorOf(() =>
      selectDownloadLink(
        downloadPageHtml(['/download?token=AAAA-1111', '/download?token=BBBB-2222']),
        PAGE,
        CONFIG,
      ),
    );
    expect(error.message).toMatch(/2 verschiedene Download-Links/);
    expect(error.diagnostics[0]).toContain('token=AAAA…');
  });

  it('fremder Host oder http:// zählt nie – auch nicht als einziger Treffer', () => {
    const html = downloadPageHtml([
      'https://boese.example.com/download?token=XXXX-1234',
      'http://daten.example.org/download?token=YYYY-1234',
    ]);
    const search = findDownloadLinks(html, PAGE, CONFIG);
    expect(search.matches).toEqual([]);
    expect(search.foreign).toHaveLength(2);
    const error = errorOf(() => selectDownloadLink(html, PAGE, CONFIG));
    expect(error.diagnostics.join('\n')).toMatch(/Ignoriert \(fremder Host.*boese\.example\.com/);
    // Ein fremder Link neben dem echten stört nicht – genutzt wird nur der eigene Host.
    const mixed = downloadPageHtml([
      'https://boese.example.com/download?token=XXXX-1234',
      '/download?token=ECHT-1234',
    ]);
    expect(selectDownloadLink(mixed, PAGE, CONFIG)).toBe(
      'https://daten.example.org/download?token=ECHT-1234',
    );
  });

  it('Codes werden im Protokoll gekürzt', () => {
    expect(maskUrl('https://blsdb.de/download?token=6NHL-47N5-K4S1-57KY')).toBe(
      'https://blsdb.de/download?token=6NHL…',
    );
  });
});

describe('Bot-Sperre / Anmeldeseite erkennen (nie umgehen)', () => {
  it('Weiterleitung auf /pow-challenge, Captcha, Passwortfeld → erkannt', () => {
    expect(
      detectChallenge('<html></html>', 'https://www.example.org/pow-challenge?redirect_url=%2Fx'),
    ).toMatch(/Sperre/);
    expect(detectChallenge('<div class="g-recaptcha"></div>', PAGE)).not.toBeNull();
    expect(detectChallenge('<form><input type="password" name="pw"></form>', PAGE)).not.toBeNull();
    expect(detectChallenge('<title>Just a moment...</title>', PAGE)).not.toBeNull();
    expect(detectChallenge(downloadPageHtml(['/download?token=A1B2-C3D4']), PAGE)).toBeNull();
  });

  it('Seite mit Challenge → Abbruch mit klarer Meldung, Datei wird nicht angefragt', async () => {
    const site = fakeSite({
      [PAGE]: {
        body: '<html><head><title>Bitte warten</title></head><body><script src="/pow-challenge.js"></script></body></html>',
        headers: { 'content-type': 'text/html' },
        redirectTo: 'https://daten.example.org/pow-challenge?redirect_url=%2Fdownload',
      },
    });
    await expect(fetchSourceOriginal(TEST_PAGE_SOURCE, site.fetch, noWait)).rejects.toThrow(
      /Bot-Sperre .*NICHT umgangen/,
    );
    expect(site.requests).toHaveLength(1);
  });

  it('Download-Link liefert eine Challenge-Seite statt der Datei → Abbruch', async () => {
    const site = fakeSite({
      [PAGE]: { body: downloadPageHtml(['/download?token=A1B2-C3D4']) },
      'https://daten.example.org/download?token=*': {
        body: '<!DOCTYPE html><html><div class="cf-turnstile"></div></html>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    });
    await expect(fetchSourceOriginal(TEST_PAGE_SOURCE, site.fetch, noWait)).rejects.toThrow(
      /Bot-Sperre/,
    );
  });
});

describe('Abruf über die Download-Seite', () => {
  it('Seite, dann Datei – nacheinander, mit User-Agent, Referer und Cookie der Seite', async () => {
    const original = testOriginal();
    const site = fakeSite({
      [PAGE]: {
        body: downloadPageHtml(['/download?token=A1B2-C3D4-E5F6']),
        headers: { 'content-type': 'text/html', 'set-cookie': 'sitzung=abc123; Path=/; HttpOnly' },
      },
      'https://daten.example.org/download?token=*': {
        body: original,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': 'attachment; filename="BLS_4_0_Daten_2025_DE.xlsx"',
        },
      },
    });
    const fetched = await fetchSourceOriginal(TEST_PAGE_SOURCE, site.fetch, noWait);
    expect(sha256Hex(fetched.data)).toBe(sha256Hex(original));
    expect(fetched.filename).toBe('BLS_4_0_Daten_2025_DE.xlsx');
    expect(fetched.container).toBe('datei');
    expect(fetched.downloadUrl).toBe('https://daten.example.org/download?token=A1B2…');
    expect(site.requests.map((r) => r.url)).toEqual([
      PAGE,
      'https://daten.example.org/download?token=A1B2-C3D4-E5F6',
    ]);
    for (const request of site.requests) {
      expect(request.headers['User-Agent']).toBe(USER_AGENT);
    }
    expect(USER_AGENT).toMatch(/Alpha5.*github\.com\/.*Fitnessapp/);
    expect(site.requests[1]?.headers.Referer).toBe(PAGE);
    expect(site.requests[1]?.headers.Cookie).toBe('sitzung=abc123');
    expect(fetched.details.join('\n')).toMatch(/Download-Link aus der Seite/);
  });

  it('Download leitet auf fremden Host weiter → Abbruch', async () => {
    const site = fakeSite({
      [PAGE]: { body: downloadPageHtml(['/download?token=A1B2-C3D4']) },
      'https://daten.example.org/download?token=*': {
        body: testOriginal(),
        redirectTo: 'https://cdn.boese.example.com/x.xlsx',
      },
    });
    await expect(fetchSourceOriginal(TEST_PAGE_SOURCE, site.fetch, noWait)).rejects.toThrow(
      /fremden Host cdn\.boese\.example\.com/,
    );
    const allowed = {
      ...TEST_PAGE_SOURCE,
      downloadPage: { ...CONFIG, redirectHosts: ['cdn.boese.example.com'] },
    };
    expect((await fetchSourceOriginal(allowed, site.fetch, noWait)).data.length).toBeGreaterThan(0);
  });

  it('Seite nicht erreichbar (404) bzw. leitet auf anderen Host → Abbruch mit Meldung', async () => {
    await expect(fetchSourceOriginal(TEST_PAGE_SOURCE, fakeSite({}).fetch, noWait)).rejects.toThrow(
      /Download-Seite .* nicht geladen: HTTP 404/,
    );
    const moved = fakeSite({
      [PAGE]: { body: downloadPageHtml([]), redirectTo: 'https://anderer.example.net/download' },
    });
    await expect(fetchSourceOriginal(TEST_PAGE_SOURCE, moved.fetch, noWait)).rejects.toThrow(
      /fremde Adresse/,
    );
  });

  it('wiederholt bei 503 (wie bisher), danach Erfolg', async () => {
    let calls = 0;
    const site = fakeSite({ [TEST_SOURCE.url]: { body: testOriginal() } });
    const flaky: typeof site.fetch = (url, init) => {
      calls += 1;
      return calls === 1
        ? Promise.resolve({
            ok: false,
            status: 503,
            url,
            headers: { get: () => null },
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          })
        : site.fetch(url, init);
    };
    const fetched = await fetchSourceOriginal(TEST_SOURCE, flaky, noWait);
    expect(calls).toBe(2);
    expect(fetched.data.length).toBeGreaterThan(0);
  });
});

describe('Format der Antwort erkennen', () => {
  it('xlsx direkt → unverändert', () => {
    const xlsx = testOriginal();
    const result = unpackOriginal(xlsx, TEST_SOURCE, META);
    expect(result.data.equals(xlsx)).toBe(true);
    expect(result.container).toBe('datei');
  });

  it('ZIP mit genau einer xlsx (plus PDF) → entpackt, Prüfsumme der xlsx', () => {
    const xlsx = testOriginal();
    const zip = buildZip({
      'BLS_4_0/Dokumentation.pdf': '%PDF-1.4 Test',
      'BLS_4_0/Daten.xlsx': xlsx,
    });
    const result = unpackOriginal(zip, TEST_SOURCE, {
      ...META,
      contentDisposition: "attachment; filename*=UTF-8''BLS_4_0_Daten.zip",
    });
    expect(result.container).toBe('zip');
    expect(result.filename).toBe('Daten.xlsx');
    expect(result.data.equals(xlsx)).toBe(true);
    expect(result.details.join('\n')).toMatch(/BLS_4_0_Daten\.zip/);
    expect(result.details.join('\n')).toMatch(/2 Einträge/);
  });

  it('ZIP mit zwei xlsx → der mit dem Namen aus sources.ts, sonst Abbruch', () => {
    const xlsx = testOriginal();
    const zip = buildZip({ 'original.xlsx': xlsx, 'english.xlsx': xlsx });
    expect(unpackOriginal(zip, TEST_SOURCE, META).filename).toBe('original.xlsx');
    const ambiguous = buildZip({ 'a.xlsx': xlsx, 'b.xlsx': xlsx });
    const error = errorOf(() => unpackOriginal(ambiguous, TEST_SOURCE, META));
    expect(error.message).toMatch(/2 \.xlsx-Dateien/);
    expect(error.diagnostics.join('\n')).toMatch(/`a\.xlsx`.*`b\.xlsx`/);
  });

  it('ZIP nur mit csv, sources.ts erwartet xlsx → Abbruch mit Einträgen; bei format csv → entpackt', () => {
    const zip = buildZip({ 'BLS_4_0_Daten.csv': 'SBLS;ST\nA;B\n', 'liesmich.txt': 'x' });
    const error = errorOf(() => unpackOriginal(zip, TEST_SOURCE, META));
    expect(error.message).toMatch(/keine \.xlsx-Datei/);
    expect(error.diagnostics.join('\n')).toMatch(/BLS_4_0_Daten\.csv/);
    const csv = unpackOriginal(zip, { ...TEST_SOURCE, format: 'csv' }, META);
    expect(csv.data.toString()).toBe('SBLS;ST\nA;B\n');
  });

  it('Webseite oder unbekanntes Format → Abbruch mit Status, Typ, Größe, Dateiname', () => {
    const html = errorOf(() =>
      unpackOriginal(Buffer.from('<!DOCTYPE html><html>Startseite</html>'), TEST_SOURCE, {
        ...META,
        contentType: 'text/html',
      }),
    );
    expect(html.message).toMatch(/Webseite statt der Datei.*HTTP 200.*text\/html.*Größe/);
    const other = errorOf(() =>
      unpackOriginal(Buffer.from('%PDF-1.4'), TEST_SOURCE, {
        ...META,
        contentDisposition: 'attachment; filename="info.pdf"',
      }),
    );
    expect(other.message).toMatch(/weder xlsx noch ZIP.*Dateiname laut Server info\.pdf/);
  });

  it('Dateiname aus Content-Disposition (ohne Pfad)', () => {
    expect(filenameFromContentDisposition('attachment; filename="../../a.xlsx"')).toBe('a.xlsx');
    expect(filenameFromContentDisposition("attachment; filename*=UTF-8''BLS%204.0.zip")).toBe(
      'BLS 4.0.zip',
    );
    expect(filenameFromContentDisposition('inline')).toBeNull();
    expect(filenameFromContentDisposition(null)).toBeNull();
  });

  it('Diagnose: Blätter, Zeilenzahl, Kopfzeile – keine Nährwerte', () => {
    const lines = diagnoseOriginal(testOriginal(), TEST_SOURCE).join('\n');
    expect(lines).toMatch(/Tabellenblätter: BLS/);
    expect(lines).toMatch(/Kopfzeile .*0: SBLS \| 1: ST/);
    expect(lines).not.toMatch(/Haferflocken|370/);
  });
});

describe('Wächter-Nachtrag blsdb: NK1/NK2', () => {
  it('NK2: ungültige Zeichenreferenz → Ersatzzeichen statt RangeError (auch in Links der Seite)', () => {
    expect(decodeXmlText('a&#99999999;b&#xD800;c&#228;')).toBe('a\uFFFDb\uFFFDcä');
    const html = downloadPageHtml(['/download?token=A1B2&#99999999;', '/download?token=ECHT-1234']);
    expect(() => findDownloadLinks(html, PAGE, CONFIG)).not.toThrow();
  });

  it('NK1: Grenze je Eintrag 128 MB, Gesamtgrenze für die entpackte Arbeitsmappe', () => {
    expect(XLSX_LIMITS.maxEntryBytes).toBe(128 * 1024 * 1024);
    expect(XLSX_LIMITS.maxTotalBytes).toBeGreaterThanOrEqual(XLSX_LIMITS.maxEntryBytes);
    // Verzeichnis behauptet für zwei Blätter je 200 MB → Abbruch vor dem Entpacken.
    const xlsx = Buffer.from(testOriginal());
    for (let i = 0; i + 4 <= xlsx.length; i += 1) {
      if (xlsx.readUInt32LE(i) === 0x02014b50) {
        const nameLength = xlsx.readUInt16LE(i + 28);
        const name = xlsx.toString('utf8', i + 46, i + 46 + nameLength);
        if (name.startsWith('xl/')) {
          xlsx.writeUInt32LE(200 * 1024 * 1024, i + 24);
        }
      }
    }
    expect(() => readXlsxRows(xlsx)).toThrow(/zu groß/);
  });
});
