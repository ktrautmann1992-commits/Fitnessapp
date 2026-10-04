import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildTokens,
  extractThemeVariables,
  parseColor,
  parseFontWeight,
  parsePixels,
  REQUIRED_VARS,
  renderTokensModule,
  stripComments,
  ThemeError,
} from './theme-parser.mjs';

const themeCss = readFileSync(fileURLToPath(new URL('../theme.css', import.meta.url)), 'utf8');
/**
 * Führt `fn` aus und liefert den geworfenen ThemeError (Test schlägt fehl, wenn keiner geworfen wird).
 * @param {() => unknown} fn
 * @returns {ThemeError}
 */
function catchThemeError(fn) {
  try {
    fn();
  } catch (error) {
    if (error instanceof ThemeError) return error;
    throw error;
  }
  throw new Error('Es wurde kein ThemeError geworfen.');
}

const generated = readFileSync(
  fileURLToPath(new URL('../src/tokens.generated.ts', import.meta.url)),
  'utf8',
);

/**
 * Vollständiges, minimales Farbschema; einzelne Zeilen lassen sich per `omit` weglassen.
 * @param {{ omit?: string[], extraRoot?: string, dark?: string | null }} [options]
 */
function makeCss({ omit = [], extraRoot = '', dark = null } = {}) {
  const root = {
    '--color-background': '#fff',
    '--color-surface': '#ffffff',
    '--color-text': '#111827',
    '--color-text-muted': 'rgb(75, 85, 99)',
    '--color-primary': '#0f9d58',
    '--color-primary-text': '#FFFFFF',
    '--color-link': '#1747cc',
    '--color-border': 'hsl(220, 13%, 91%)',
    '--color-success': '#15803d',
    '--color-warning': '#b45309',
    '--color-danger': '#b91c1c',
    '--space-xs': '4px',
    '--space-sm': '8px',
    '--space-md': '1rem',
    '--space-lg': '24px',
    '--space-xl': '32px',
    '--space-xxl': '48px',
    '--radius-sm': '6px',
    '--radius-md': '12px',
    '--radius-lg': '20px',
    '--radius-pill': '999px',
    '--font-size-sm': '14px',
    '--font-size-md': '16px',
    '--font-size-lg': '20px',
    '--font-size-xl': '28px',
    '--font-size-xxl': '36px',
    '--font-weight-regular': 'normal',
    '--font-weight-semibold': '600',
    '--font-weight-bold': 'bold',
    '--max-content-width': '560px',
  };
  const lines = Object.entries(root)
    .filter(([name]) => !omit.includes(name))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  const darkBlock =
    dark ??
    `@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-background: #0b0f14;
    --color-text: #f3f4f6;
  }
}`;
  return `:root {\n${lines}\n${extraRoot}\n}\n${darkBlock}\n`;
}

describe('theme.css im Repository', () => {
  it('ist gültig und erzeugt genau die eingecheckte tokens.generated.ts', () => {
    const { tokens, warnings } = buildTokens(themeCss);
    expect(warnings).toEqual([]);
    expect(renderTokensModule(tokens)).toBe(generated.replace(/\r\n/g, '\n'));
  });

  it('enthält alle Pflicht-Variablen', () => {
    for (const name of REQUIRED_VARS) {
      expect(themeCss).toContain(`${name}:`);
    }
  });
});

describe('buildTokens', () => {
  it('liest ein gültiges Schema mit hellen und dunklen Farben', () => {
    const { tokens } = buildTokens(makeCss());
    expect(tokens.colors.light.background).toBe('#FFFFFF');
    expect(tokens.colors.light.textMuted).toBe('rgb(75, 85, 99)');
    expect(tokens.colors.light.border).toBe('hsl(220, 13%, 91%)');
    expect(tokens.colors.dark.background).toBe('#0B0F14');
    expect(tokens.spacing).toEqual({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
    expect(tokens.radius.pill).toBe(999);
    expect(tokens.fontWeight).toEqual({ regular: '400', semibold: '600', bold: '700' });
    expect(tokens.maxContentWidth).toBe(560);
  });

  it('übernimmt fehlende Dunkel-Farben aus dem hellen Modus und warnt', () => {
    const { tokens, warnings } = buildTokens(makeCss());
    expect(tokens.colors.dark.primary).toBe(tokens.colors.light.primary);
    expect(warnings.some((w) => w.includes('--color-primary fehlt im Dunkelmodus'))).toBe(true);
  });

  it('meldet fehlende Pflicht-Variablen alle auf einmal', () => {
    const error = catchThemeError(() =>
      buildTokens(makeCss({ omit: ['--color-primary', '--space-md'] })),
    );
    expect(error.problems).toEqual([
      'Pflicht-Variable --color-primary fehlt im :root-Block.',
      'Pflicht-Variable --space-md fehlt im :root-Block.',
    ]);
  });

  it('verlangt einen Dunkelmodus', () => {
    expect(() => buildTokens(makeCss({ dark: '' }))).toThrow(/Kein Dunkelmodus/);
  });

  it('akzeptiert [data-theme="dark"] statt @media als Dunkel-Block', () => {
    const css = makeCss({ dark: '[data-theme="dark"] { --color-primary: #34D399; }' });
    expect(buildTokens(css).tokens.colors.dark.primary).toBe('#34D399');
  });

  it('meldet, wenn sich @media-dark und [data-theme=dark] widersprechen', () => {
    const css = makeCss({
      dark: `@media (prefers-color-scheme: dark) { :root { --color-primary: #111111; } }
             :root[data-theme='dark'] { --color-primary: #222222; }`,
    });
    expect(() => buildTokens(css)).toThrow(
      /--color-primary hat im Dunkel-Modus zwei verschiedene Werte/,
    );
  });

  it('ignoriert Kommentare, auch mit Klammern und Variablen darin', () => {
    const css = `/* Kopf { --color-primary: red; } */\n${makeCss({ extraRoot: '/* --space-md: 99px; */' })}`;
    const { tokens } = buildTokens(css);
    expect(tokens.colors.light.primary).toBe('#0F9D58');
    expect(tokens.spacing.md).toBe(16);
  });

  it('löst var()-Verweise auf eigene Variablen auf', () => {
    const css = makeCss({
      omit: ['--color-primary'],
      extraRoot: '  --brand-green: #00AA55;\n  --color-primary: var(--brand-green);',
    });
    expect(buildTokens(css).tokens.colors.light.primary).toBe('#00AA55');
  });

  it('liest Markenfarben (--brand-…) als brandColors mit camelCase-Schlüsseln', () => {
    const css = makeCss({
      extraRoot: '  --brand-blau: #1f5bff;\n  --brand-graphit-hell: rgb(38, 44, 58);',
    });
    const { tokens, warnings } = buildTokens(css);
    expect(tokens.brandColors).toEqual({ blau: '#1F5BFF', graphitHell: 'rgb(38, 44, 58)' });
    expect(warnings).not.toContainEqual(expect.stringContaining('--brand-'));
  });

  it('liefert leere brandColors ohne Markenfarben', () => {
    expect(buildTokens(makeCss()).tokens.brandColors).toEqual({});
  });

  it('meldet ungültige Namen und Werte von Markenfarben', () => {
    const error = catchThemeError(() =>
      buildTokens(makeCss({ extraRoot: '  --brand-Blau: #1f5bff;\n  --brand-rot: red;' })),
    );
    expect(error.problems).toEqual([
      expect.stringContaining('--brand-Blau'),
      expect.stringContaining('--brand-rot'),
    ]);
  });

  it('ignoriert Markenfarben im Dunkelmodus mit Hinweis', () => {
    const css = makeCss({
      extraRoot: '  --brand-blau: #1f5bff;',
      dark: `:root[data-theme='dark'] { --color-text: #fff; --brand-blau: #000000; }`,
    });
    const { tokens, warnings } = buildTokens(css);
    expect(tokens.brandColors.blau).toBe('#1F5BFF');
    expect(warnings).toContainEqual(expect.stringContaining('--brand-blau im Dunkelmodus'));
  });

  it('ignoriert andere Selektoren und Media-Queries', () => {
    const css = `${makeCss()}
      body { --color-primary: #123456; color: var(--color-text); }
      @media (min-width: 800px) { :root { --space-md: 20px; } }`;
    const { tokens } = buildTokens(css);
    expect(tokens.colors.light.primary).toBe('#0F9D58');
    expect(tokens.spacing.md).toBe(16);
  });

  it('meldet ungültige Werte mit Variablennamen', () => {
    const css = makeCss({
      omit: ['--color-danger', '--space-lg', '--font-weight-bold'],
      extraRoot: '  --color-danger: red;\n  --space-lg: 24;\n  --font-weight-bold: 750;',
    });
    const error = catchThemeError(() => buildTokens(css));
    expect(error.problems).toHaveLength(3);
    expect(error.message).toContain('--color-danger: „red“ – Farbnamen');
    expect(error.message).toContain('--space-lg: „24“ – Einheit fehlt');
    expect(error.message).toContain('--font-weight-bold: „750“');
  });

  it('meldet nicht geschlossene Klammern verständlich', () => {
    expect(() => buildTokens(':root { --color-primary: #fff;')).toThrow(/nicht geschlossen/);
  });
});

describe('parseColor', () => {
  it('normalisiert Hex-Farben auf #RRGGBB bzw. #RRGGBBAA (groß)', () => {
    expect(parseColor('#abc', 'x')).toBe('#AABBCC');
    expect(parseColor(' #0f9d58 ', 'x')).toBe('#0F9D58');
    expect(parseColor('#0f9d5880', 'x')).toBe('#0F9D5880');
    expect(parseColor('#abcd', 'x')).toBe('#AABBCCDD');
  });

  it('reicht rgb()/rgba()/hsl() bereinigt durch', () => {
    expect(parseColor('RGBA( 0 ,0,0 , 0.5 )', 'x')).toBe('rgba(0, 0, 0, 0.5)');
    expect(parseColor('hsl(150deg 80% 40%)', 'x')).toBe('hsl(150deg 80% 40%)');
    expect(parseColor('rgb(15 157 88 / 50%)', 'x')).toBe('rgb(15 157 88 / 50%)');
    expect(parseColor('hsla(150, 80%, 40%, .5)', 'x')).toBe('hsla(150, 80%, 40%, .5)');
  });

  it('lehnt ungültige Farben ab', () => {
    expect(() => parseColor('#12', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(foo)', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(1, 2)', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(1-2-3)', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(1, 2, 3, 4, 5)', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(1 2 3 / )', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb(10deg 2 3)', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('rgb()', 'x')).toThrow(/keine gültige Farbe/);
    expect(() => parseColor('blue', 'x')).toThrow(/Farbnamen/);
    expect(() => parseColor('var(--x)', 'x')).toThrow(/keine gültige Farbe/);
  });
});

describe('parsePixels', () => {
  it('wandelt px und rem in Zahlen um', () => {
    expect(parsePixels('16px', 'x')).toBe(16);
    expect(parsePixels('1.5rem', 'x')).toBe(24);
    expect(parsePixels('0', 'x')).toBe(0);
    expect(parsePixels('0.5px', 'x')).toBe(0.5);
  });

  it('lehnt fehlende Einheit, negative Werte und Unsinn ab', () => {
    expect(() => parsePixels('16', 'x')).toThrow(/Einheit fehlt/);
    expect(() => parsePixels('-4px', 'x')).toThrow(/negativ/);
    expect(() => parsePixels('10%', 'x')).toThrow(/keine gültige Größe/);
    expect(() => parsePixels('', 'x')).toThrow(/keine gültige Größe/);
  });
});

describe('parseFontWeight', () => {
  it('akzeptiert 100–900 sowie normal/bold', () => {
    expect(parseFontWeight('100', 'x')).toBe('100');
    expect(parseFontWeight('900', 'x')).toBe('900');
    expect(parseFontWeight('normal', 'x')).toBe('400');
    expect(parseFontWeight('BOLD', 'x')).toBe('700');
  });

  it('lehnt andere Werte ab', () => {
    expect(() => parseFontWeight('1000', 'x')).toThrow();
    expect(() => parseFontWeight('450', 'x')).toThrow();
    expect(() => parseFontWeight('heavy', 'x')).toThrow();
  });
});

describe('stripComments / extractThemeVariables', () => {
  it('lässt Kommentarzeichen in Strings stehen', () => {
    expect(stripComments("a { content: '/* kein Kommentar */'; } /* weg */")).toBe(
      "a { content: '/* kein Kommentar */'; }  ",
    );
  });

  it('ordnet Blöcke hell/dunkel zu', () => {
    const vars = extractThemeVariables(`
      :root { --a: 1px; }
      html[data-theme="light"] { --a: 1px; }
      @media screen and (prefers-color-scheme: dark) { :root, html { --b: #000; } }
      @media only screen and (prefers-color-scheme: dark) { :root { --d: #222; } }
      @media not all and (prefers-color-scheme: dark) { :root { --e: #333; } }
      .dark { --c: #111; }
    `);
    expect([...vars.light.keys()]).toEqual(['--a']);
    expect(vars.light.get('--a')).toHaveLength(2);
    expect([...vars.dark.keys()].sort()).toEqual(['--b', '--c', '--d']);
  });
});
