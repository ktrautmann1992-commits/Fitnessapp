import { describe, expect, it } from 'vitest';

import { readSupabasePublicConfig } from './env';

const validKey = 'sb_publishable_abcdefghijklmnopqrstuvwxyz';

describe('readSupabasePublicConfig', () => {
  it('meldet „missing“, wenn nichts eingetragen ist', () => {
    expect(readSupabasePublicConfig({ url: undefined, publishableKey: undefined })).toEqual({
      status: 'missing',
    });
    expect(readSupabasePublicConfig({ url: '  ', publishableKey: '' })).toEqual({
      status: 'missing',
    });
  });

  it('akzeptiert eine gültige Konfiguration', () => {
    const result = readSupabasePublicConfig({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: validKey,
    });
    expect(result).toEqual({
      status: 'ok',
      config: { url: 'https://abcdefgh.supabase.co', publishableKey: validKey },
    });
  });

  it('meldet „invalid“, wenn nur ein Wert eingetragen ist', () => {
    const result = readSupabasePublicConfig({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: undefined,
    });
    expect(result.status).toBe('invalid');
  });

  it('lehnt unverschlüsselte URLs ab', () => {
    const result = readSupabasePublicConfig({
      url: 'http://abcdefgh.supabase.co',
      publishableKey: validKey,
    });
    expect(result.status).toBe('invalid');
  });
});
