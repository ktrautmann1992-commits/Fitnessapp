/**
 * Lauf 3 (N2b): Token-Link liefert HTML statt Datei → strukturierte Diagnose der Seite. Nur beschreiben, nichts
 * befolgen (kein POST, kein meta-refresh, keine Skripte), Codes gekürzt. Alle Seiten sind ATTRAPPEN.
 */
import { describe, expect, it } from 'vitest';

import { fetchSourceOriginal } from './download';
import { SourceDownloadError } from './download-page';
import { runFoodsImport } from './foods-import';
import { describeHtmlPage, HTML_DIAGNOSIS_LIMITS, maskTokens, mdCode } from './html-diagnosis';
import { diagnoseOriginal, headerLine } from './original-format';
import { downloadPageHtml, fakeSite, TEST_PAGE_SOURCE, testOriginal } from './test-helpers';

const PAGE = TEST_PAGE_SOURCE.url;
const TOKEN = '6NHL-47N5-K4S1-57KY-NVSC-5W10-0LK8-JBAG';
const TOKEN_URL = `https://daten.example.org/download?token=${TOKEN}`;

/** Zweite Seite: Bestätigung der Nutzungsbedingungen per Formular, meta-refresh, Skript mit Download-Adresse. */
const SECOND_PAGE = `<!DOCTYPE html><html><head><title>BLS – Download bestätigen</title>
<meta http-equiv="refresh" content="5; url=/files/BLS_4_0.zip?token=${TOKEN}">
<style>.x { color: red }</style>
<script src="/js/app.js?v=12345678"></script>
<script>var t = 1;</script>
<script>window.location.href = '/files/BLS_4_0_Daten_2025_DE.xlsx?token=${TOKEN}';</script>
</head><body>
<!-- Kommentar mit geheimem Text -->
<h1>Download BLS-Daten</h1><h2>Nutzungsbedingungen</h2>
<p>Bitte bestätigen Sie die Nutzungsbedingungen (CC BY 4.0).</p>
<form action="/download/confirm" method="post">
  <input type="hidden" name="token" value="${TOKEN}">
  <input type="hidden" name="csrf" value="abcdefghijklmnop">
  <input type="checkbox" name="accept" value="1" required>
  <select name="format"><option>xlsx</option></select>
  <button type="submit" name="go">Daten herunterladen</button>
</form>
<a href="/impressum">Impressum</a>
<a href="/files/x.zip?token=${TOKEN}" download>Direkt</a>
<button data-download-url="/files/y.xlsx?token=${TOKEN}" onclick="start()">Start</button>
</body></html>`;

describe('describeHtmlPage – Diagnose der HTML-Antwort', () => {
  const lines = describeHtmlPage(SECOND_PAGE, TOKEN_URL, ['PHPSESSID', 'consent']);
  const text = lines.join('\n');

  it('Titel, Überschriften, sichtbarer Text ohne Skripte/Styles/Kommentare', () => {
    expect(text).toContain('Titel: `BLS – Download bestätigen`');
    expect(text).toMatch(/h1 `Download BLS-Daten` · h2 `Nutzungsbedingungen`/);
    expect(text).toMatch(/Sichtbarer Text .*Bitte bestätigen Sie die Nutzungsbedingungen/);
    const visible = lines.find((l) => l.startsWith('Sichtbarer Text')) ?? '';
    expect(visible).not.toMatch(/color: red|window\.location|geheimem/);
  });

  it('Formular: action, method, Felder mit Typ, hidden-Werte gekürzt, Knopf', () => {
    const form = lines.find((l) => l.startsWith('Formular 1')) ?? '';
    expect(form).toContain('action `https://daten.example.org/download/confirm`');
    expect(form).toContain('method `POST`');
    expect(form).toContain('input `token`, Typ `hidden`, Wert `6NHL…`');
    expect(form).toContain('input `csrf`, Typ `hidden`, Wert `abcd…`');
    expect(form).toContain('input `accept`, Typ `checkbox`, Wert `1`, Pflicht');
    expect(form).toContain('select `format`');
    expect(form).toMatch(/button `go`, Typ `submit`, Text `Daten herunterladen`/);
    expect(text).toMatch(/Formulare: 1 \(werden NICHT abgeschickt\)/);
  });

  it('meta refresh, Links, Skripte (src und Ausschnitt), data-Attribute, Cookie-Namen', () => {
    expect(text).toMatch(
      /meta refresh \(wird NICHT befolgt\): `5; url=\/files\/BLS_4_0\.zip\?token=6NHL…`/,
    );
    expect(text).toMatch(/`https:\/\/daten\.example\.org\/impressum` „`Impressum`“/);
    expect(text).toMatch(/x\.zip\?token=6NHL…` „`Direkt`“ \[download\]/);
    expect(text).toMatch(/Skripte mit src .*app\.js\?v=1234…/);
    expect(text).toMatch(
      /Inline-Skripte .*window\.location\.href = '\/files\/BLS_4_0_Daten_2025_DE\.xlsx\?token=6NHL…/,
    );
    expect(text).not.toContain('var t = 1');
    expect(text).toMatch(/data-download-url=`\/files\/y\.xlsx\?token=6NHL…`/);
    expect(text).toMatch(/Knöpfe außerhalb von Formularen \(1\): `Start` \(.*onclick=`start\(\)`/);
    expect(text).toContain('Gesetzte Cookies (nur Namen): `PHPSESSID` · `consent`');
  });

  it('Token nirgends vollständig', () => {
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain('47N5');
    expect(text).not.toContain('abcdefghijklmnop');
    expect(maskTokens(`a ${TOKEN} b`)).toBe('a 6NHL… b');
  });
});

describe('Token-Link liefert HTML – Diagnose ohne weitere Anfragen', () => {
  const site = () =>
    fakeSite({
      [PAGE]: {
        body: downloadPageHtml([`/download?token=${TOKEN}`]),
        headers: { 'set-cookie': 'sitzung=geheimerwert123; Path=/' },
      },
      'https://daten.example.org/download?token=*': {
        body: SECOND_PAGE,
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'set-cookie': 'PHPSESSID=wert456; Path=/',
        },
      },
    });

  it('Fehler mit Beschreibung beider Seiten; genau 2 Anfragen (kein POST, kein refresh, kein Skript)', async () => {
    const s = site();
    let error: SourceDownloadError | undefined;
    try {
      await fetchSourceOriginal(TEST_PAGE_SOURCE, s.fetch, { retryDelaysMs: [] });
    } catch (e) {
      error = e as SourceDownloadError;
    }
    expect(error).toBeInstanceOf(SourceDownloadError);
    expect(error?.message).toMatch(/Webseite statt der Datei/);
    const diag = error?.diagnostics.join('\n') ?? '';
    expect(diag).toMatch(/Formular 1: action .*confirm/);
    expect(diag).toContain('`PHPSESSID`');
    expect(diag).not.toContain('wert456');
    expect(error?.firstPage.join('\n')).toMatch(/Titel: `BLS Download`/);
    expect(error?.firstPage.join('\n')).toContain('`sitzung`');
    expect(error?.firstPage.join('\n')).not.toContain('geheimerwert123');
    expect(s.requests.map((r) => r.url)).toEqual([
      PAGE,
      `https://daten.example.org/download?token=${TOKEN}`,
    ]);
  });

  it('foods-import kandidaten: Summary enthält beide Beschreibungen, Token gekürzt', async () => {
    const s = site();
    const result = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'kandidaten' },
      {
        repoRoot: '/nicht-benutzt',
        runId: '1',
        refName: 'main',
        now: () => new Date('2026-10-12T00:00:00Z'),
        sources: [TEST_PAGE_SOURCE],
        download: (def) => fetchSourceOriginal(def, s.fetch, { retryDelaysMs: [] }),
      },
    );
    expect(result.exitCode).toBe(1);
    expect(result.markdown).toMatch(/Inhalt dieser Seite \(nur beschrieben/);
    expect(result.markdown).toContain(
      '<details><summary>Diagnose: erste Seite (Download-Seite)</summary>',
    );
    expect(result.markdown).toMatch(/method `POST`/);
    expect(result.markdown).not.toContain(TOKEN);
    expect(s.requests).toHaveLength(2);
  });
});

describe('Wächter „Diagnose“: bösartige Eingaben (B1, S1, S2, K1–K4)', () => {
  it('B1: 1 MB kaputtes HTML („<a “ ohne Abschluss) → schnell, Eingabe auf 128 KB gekappt mit Vermerk', () => {
    for (const evil of [
      '<a '.repeat(350_000),
      '<a x>'.repeat(210_000),
      '<!--'.repeat(260_000),
      '< '.repeat(500_000) + '>',
    ]) {
      const start = performance.now();
      const lines = describeHtmlPage(evil, PAGE);
      expect(performance.now() - start).toBeLessThan(2000);
      expect(lines[0]).toMatch(/Eingabe gekürzt auf 128 KB von \d+ Zeichen/);
    }
  });

  it('S1: jede Liste begrenzt, Gesamtausgabe ≤ 16 KB mit Kürzungshinweis', () => {
    const many = [
      ...Array.from({ length: 500 }, (_, i) => `<script src="/s${i}.js"></script>`),
      ...Array.from(
        { length: 500 },
        (_, i) => `<button data-x-url="/u${i}" onclick="f(${i})">K${i}</button>`,
      ),
      ...Array.from(
        { length: 500 },
        (_, i) => `<meta http-equiv="refresh" content="${i}; url=/r${i}">`,
      ),
      ...Array.from({ length: 500 }, (_, i) => `<a href="/l${i}">Link ${i} ${'x'.repeat(60)}</a>`),
      ...Array.from(
        { length: 50 },
        (_, i) =>
          `<form action="/f${i}">${`<input name="${'n'.repeat(70)}" value="${'v'.repeat(50)}">`.repeat(50)}</form>`,
      ),
    ].join('');
    const cookies = Array.from({ length: 500 }, (_, i) => `c${i}`);
    const lines = describeHtmlPage(`<html><body>${many}</body></html>`, PAGE, cookies);
    const total = lines.join('\n').length;
    expect(total).toBeLessThanOrEqual(HTML_DIAGNOSIS_LIMITS.outputChars + lines.length + 200);
    expect(lines.join('\n')).toMatch(/… \(\d+ weitere\)/);
    expect(lines.at(-1)).toMatch(/Diagnose gekürzt \(Gesamtgrenze 16 KB/);
  });

  it('S2: UUID, JSON, JS-Variable, Pfad, Fragment, Textfeld mit token-Namen werden gekürzt', () => {
    expect(maskTokens('id 550e8400-e29b-41d4-a716-446655440000 x')).toBe('id 550e… x');
    expect(maskTokens('{"token":"abcdef0123456789abcdef0123"}')).not.toContain('0123456789');
    expect(maskTokens('var downloadToken="abcdefghijklmnopqrst";')).toBe(
      'var downloadToken="abcd…";',
    );
    expect(maskTokens('/dl/abcdef0123456789abcdef0123/x')).toBe('/dl/abcd…/x');
    expect(maskTokens('siehe #tok=abcdefgh12345')).toBe('siehe #tok=abcd…');
    // Dateinamen und normale Wörter bleiben lesbar.
    expect(maskTokens('/files/BLS_4_0_Daten_2025_DE.xlsx')).toBe(
      '/files/BLS_4_0_Daten_2025_DE.xlsx',
    );
    expect(maskTokens('Bundeslebensmittelschlüssel Nutzungsbedingungen')).toBe(
      'Bundeslebensmittelschlüssel Nutzungsbedingungen',
    );
    const page = describeHtmlPage(
      `<form><input type="text" readonly name="download_token" value="geheimgeheim"><input type="text" name="api-key" value="schluessel99"></form>
       <script>var cfg = {"token":"abcdef0123456789abcdef0123", "url": "/download/550e8400-e29b-41d4-a716-446655440000"};</script>
       <a href="/dl/abcdef0123456789abcdef0123#tok=abcdefgh12345">x</a>`,
      PAGE,
    ).join('\n');
    for (const secret of [
      'geheimgeheim',
      'schluessel99',
      '0123456789',
      '446655440000',
      'efgh12345',
    ]) {
      expect(page).not.toContain(secret);
    }
    expect(page).toContain('input `download_token`, Typ `text`, Wert `gehe…`');
  });

  it('K4: eingeschleustes Markdown/HTML in Titel und Linktext steht nur in Inline-Code', () => {
    const lines = describeHtmlPage(
      '<title>`x` ![x](https://evil.example/a.png) <b>fett</b></title><body><a href="javascript:alert(1)">![y](https://evil.example/b.png)<img src=https://evil.example/c.png> `</a></body>',
      PAGE,
    );
    const title = lines.find((l) => l.startsWith('Titel:')) ?? '';
    expect(title).toBe("Titel: `'x' ![x](https://evil.example/a.png) fett`");
    const linkLine = lines.find((l) => l.startsWith('Links')) ?? '';
    // Jede Fundstelle von „evil“ liegt zwischen Backticks.
    for (const line of [title, linkLine]) {
      const outside = line
        .split('`')
        .filter((_, i) => i % 2 === 0)
        .join('');
      expect(outside).not.toMatch(/evil|!\[|<img/);
    }
  });

  it('K2: Typ und Dateiname vom Server in Inline-Code', async () => {
    const s = fakeSite({
      [PAGE]: { body: downloadPageHtml(['/download?token=A1B2-C3D4']) },
      'https://daten.example.org/download?token=*': {
        body: '%PDF',
        headers: {
          'content-type': 'application/pdf ![x](https://evil.example)',
          'content-disposition': 'attachment; filename="a.pdf"',
        },
      },
    });
    const error = await fetchSourceOriginal(TEST_PAGE_SOURCE, s.fetch, { retryDelaysMs: [] }).catch(
      (e: SourceDownloadError) => e,
    );
    expect((error as SourceDownloadError).message).toContain(
      'Typ `application/pdf ![x](https://evil.example)`',
    );
    expect((error as SourceDownloadError).message).toContain('Dateiname laut Server `a.pdf`');
  });

  it('K3: Beschreibung der ersten Seite bei Erfolg nur mit describePages (Modus „kandidaten“)', async () => {
    const s = fakeSite({
      [PAGE]: { body: downloadPageHtml(['/download?token=A1B2-C3D4']) },
      'https://daten.example.org/download?token=*': { body: testOriginal() },
    });
    const plain = await fetchSourceOriginal(TEST_PAGE_SOURCE, s.fetch, { retryDelaysMs: [] });
    expect(plain.firstPage).toBeUndefined();
    const described = await fetchSourceOriginal(TEST_PAGE_SOURCE, s.fetch, {
      retryDelaysMs: [],
      describePages: true,
    });
    expect(described.firstPage?.join('\n')).toMatch(/Titel: `BLS Download`/);
  });

  it('K1: Unterpunkte der HTML-Beschreibung werden in der Summary nicht doppelt aufgezählt', async () => {
    const s = fakeSite({
      [PAGE]: { body: downloadPageHtml(['/download?token=A1B2-C3D4']) },
      'https://daten.example.org/download?token=*': {
        body: '<html><title>Zwischenseite</title></html>',
        headers: { 'content-type': 'text/html' },
      },
    });
    const result = await runFoodsImport(
      { source: 'bls', version: '4.0', mode: 'kandidaten' },
      {
        repoRoot: '/nicht-benutzt',
        runId: '1',
        refName: 'main',
        now: () => new Date('2026-10-12T00:00:00Z'),
        sources: [TEST_PAGE_SOURCE],
        download: (def) => fetchSourceOriginal(def, s.fetch, { retryDelaysMs: [] }),
      },
    );
    expect(result.markdown).toContain('\n  - Titel: `Zwischenseite`');
    expect(result.markdown).not.toMatch(/^- {2,}- /m);
  });
});

describe('Wächter „Diagnose“, Nachprüfung (NS1, NK1, NK2)', () => {
  it('NS1: maskTokens und mdCode bleiben bei 1 MB „token…“ schnell', () => {
    const evil = 'token'.repeat(210_000);
    let start = performance.now();
    maskTokens(evil);
    expect(performance.now() - start).toBeLessThan(2000);
    start = performance.now();
    expect(mdCode(evil, 2000).length).toBeLessThan(2100);
    expect(performance.now() - start).toBeLessThan(200);
    start = performance.now();
    describeHtmlPage(`<html><body>${'token'.repeat(30_000)}</body></html>`, PAGE);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('NK1: Schlüsselwörter nur an Wortgrenzen, Bezeichner mit „_“ bleiben lesbar', () => {
    expect(maskTokens('Monkey=Banana123')).toBe('Monkey=Banana123');
    expect(maskTokens('keyword: Proteinbedarf2025')).toBe('keyword: Proteinbedarf2025');
    expect(maskTokens('Signatur: Unterschrift2025')).toBe('Signatur: Unterschrift2025');
    expect(maskTokens('E200_Sorbinsaeure_in_mg_100g')).toBe('E200_Sorbinsaeure_in_mg_100g');
    expect(maskTokens('id 1234567890123456789 x')).toBe('id 1234… x');
    expect(maskTokens('Naehrstoffe_pro_100g_essbarer_Anteil')).toBe(
      'Naehrstoffe_pro_100g_essbarer_Anteil',
    );
    // Echte Schlüssel weiterhin gekürzt.
    expect(maskTokens('session_id=abcdefgh')).toBe('session_id=abcd…');
    expect(maskTokens('API_KEY: geheimgeheim')).toBe('API_KEY: gehe…');
    expect(maskTokens('var downloadToken="abcdefghijklmnopqrst";')).toBe(
      'var downloadToken="abcd…";',
    );
  });

  it('NK1: CSV-Kopfzeile wird nicht maskiert, aber als Inline-Code; nur der Anfang wird gelesen', () => {
    const header =
      'SBLS;E200_Sorbinsaeure_in_mg_100g;token=abcdefgh1234;`![x](https://evil.example)`';
    const csv = Buffer.from(`${header}\nA;1;2;3\n${'x'.repeat(1_000_000)}`);
    const lines = diagnoseOriginal(csv, { format: 'csv', sheet: null, csvDelimiter: ';' }).join(
      '\n',
    );
    expect(lines).toContain(
      "Erste Zeile (Kopfzeile, gekürzt): `SBLS;E200_Sorbinsaeure_in_mg_100g;token=abcdefgh1234;'![x](https://evil.example)'`",
    );
  });

  it('NK2: xlsx-Kopfzeile je Spalte als Inline-Code (eingeschleustes Markdown wirkungslos)', () => {
    expect(headerLine(['SBLS', '`![x](https://evil.example)`', 'F18:2CN6'])).toBe(
      "Kopfzeile (erste 3 von 3 Spalten): 0: `SBLS` | 1: `'![x](https://evil.example)'` | 2: `F18:2CN6`",
    );
  });
});
