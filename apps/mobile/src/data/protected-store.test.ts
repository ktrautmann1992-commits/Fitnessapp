import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './kv';
import {
  base64ToUtf8,
  createEncryptedProtectedStore,
  createSessionProtectedStore,
  type AeadCipher,
  utf8ToBase64,
} from './protected-store';

/** AES-256-GCM wie expo-crypto (IV 12 + Geheimtext + Tag 16, base64) – mit node:crypto für den Test. */
const nodeCipher: AeadCipher = {
  generateKey: async () => randomBytes(32).toString('base64'),
  seal: async (key, plain) => {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
    const body = Buffer.concat([c.update(Buffer.from(plain, 'base64')), c.final()]);
    return Buffer.concat([iv, body, c.getAuthTag()]).toString('base64');
  },
  open: async (key, sealed) => {
    const all = Buffer.from(sealed, 'base64');
    const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), all.subarray(0, 12));
    d.setAuthTag(all.subarray(all.length - 16));
    return Buffer.concat([d.update(all.subarray(12, all.length - 16)), d.final()]).toString(
      'base64',
    );
  },
};

function secrets() {
  const map = new Map<string, string>();
  return {
    map,
    get: async (n: string) => map.get(n) ?? null,
    set: async (n: string, v: string) => {
      map.set(n, v);
    },
    remove: async (n: string) => {
      map.delete(n);
    },
  };
}

describe('Base64 ⇄ UTF-8', () => {
  it('Umlaute, Emojis und leere Texte bleiben erhalten (wie Buffer)', () => {
    for (const text of ['', 'a', 'ab', 'Übung – Größe 3×', '💪 Plan']) {
      expect(utf8ToBase64(text)).toBe(Buffer.from(text, 'utf8').toString('base64'));
      expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
    }
  });
});

describe('geschützter Zwischenspeicher (Frage 14)', () => {
  it('App: Schlüssel im Schlüsselspeicher, Daten verschlüsselt (kein Klartext im Gerätespeicher)', async () => {
    const data = createMemoryStore();
    const keys = secrets();
    const store = createEncryptedProtectedStore({
      secrets: keys,
      data,
      cipher: nodeCipher,
      keyName: 'k',
      dataKey: 'd',
    });
    await store.write('{"medical_notice":true,"Übung":"Gehen"}');
    expect(keys.map.get('k')).toBeTruthy();
    expect(data.dump().d).toBeTruthy();
    expect(data.dump().d).not.toContain('medical_notice');
    expect(Buffer.from(data.dump().d ?? '', 'base64').toString()).not.toContain('medical');
    expect(await store.read()).toBe('{"medical_notice":true,"Übung":"Gehen"}');
    await store.clear();
    expect(data.dump()).toEqual({});
    expect(keys.map.size).toBe(0);
    expect(await store.read()).toBeNull();
  });

  it('gleichzeitige erste Schreibvorgänge erzeugen nur einen Schlüssel (Sperre)', async () => {
    const data = createMemoryStore();
    const keys = secrets();
    let generated = 0;
    const slowCipher: AeadCipher = {
      ...nodeCipher,
      generateKey: async () => {
        generated += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return nodeCipher.generateKey();
      },
    };
    const store = createEncryptedProtectedStore({
      secrets: keys,
      data,
      cipher: slowCipher,
      keyName: 'k',
      dataKey: 'd',
    });
    await Promise.all([store.write('a'), store.write('b'), store.write('c')]);
    expect(generated).toBe(1);
    expect(['a', 'b', 'c']).toContain(await store.read());
  });

  it('fremder/verlorener Schlüssel → leer und aufgeräumt', async () => {
    const data = createMemoryStore();
    const keys = secrets();
    const options = { secrets: keys, data, cipher: nodeCipher, keyName: 'k', dataKey: 'd' };
    await createEncryptedProtectedStore(options).write('geheim');
    keys.map.set('k', (await nodeCipher.generateKey()) as string);
    expect(await createEncryptedProtectedStore(options).read()).toBeNull();
    expect(data.dump()).toEqual({});
  });

  it('Browser: nur sessionStorage; ohne Zugriff kein Zwischenspeicher', async () => {
    const map = new Map<string, string>();
    const session = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    };
    const store = createSessionProtectedStore(session, 'x');
    await store.write('plan');
    expect(await store.read()).toBe('plan');
    await store.clear();
    expect(map.size).toBe(0);
    const none = createSessionProtectedStore(null, 'x');
    await none.write('plan');
    expect(await none.read()).toBeNull();
  });
});
