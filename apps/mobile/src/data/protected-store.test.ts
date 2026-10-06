import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from './kv';
import {
  base64ToUtf8,
  createEncryptedProtectedStore,
  createSessionProtectedStore,
  PROTECTED_STORE_KEYS,
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

describe('Vier eigene geschützte Speicher (PLAN-PHASE-4 4.1)', () => {
  it('eigene Daten- und Schlüssel-Namen; Löschen eines Speichers lässt die anderen (und ihre Schlüssel) stehen', async () => {
    const names = Object.values(PROTECTED_STORE_KEYS).flatMap((k) => [k.dataKey, k.keyName]);
    expect(new Set(names).size).toBe(names.length);
    expect(PROTECTED_STORE_KEYS.workoutDraft).toEqual({
      dataKey: STORAGE_KEYS.workoutDraft,
      keyName: STORAGE_KEYS.workoutDraftKey,
    });
    const data = createMemoryStore();
    const keys = secrets();
    const stores = Object.fromEntries(
      Object.entries(PROTECTED_STORE_KEYS).map(([name, k]) => [
        name,
        createEncryptedProtectedStore({
          secrets: keys,
          data,
          cipher: nodeCipher,
          keyName: k.keyName,
          dataKey: k.dataKey,
        }),
      ]),
    );
    for (const [name, store] of Object.entries(stores)) await store.write(`Inhalt ${name}`);
    expect(keys.map.size).toBe(4);
    // Geheimtext – kein Klartext im AsyncStorage.
    expect(JSON.stringify(data.dump())).not.toContain('Inhalt');
    // Widerruf/Planwechsel leeren nur den Plan-Cache – das Tagebuch bleibt lesbar.
    await stores.healthPlan?.clear();
    expect(await stores.healthPlan?.read()).toBeNull();
    expect(await stores.workoutDraft?.read()).toBe('Inhalt workoutDraft');
    expect(await stores.logQueue?.read()).toBe('Inhalt logQueue');
    expect(await stores.logCache?.read()).toBe('Inhalt logCache');
    expect(keys.map.has(STORAGE_KEYS.healthPlanKey)).toBe(false);
    expect(keys.map.has(STORAGE_KEYS.logQueueKey)).toBe(true);
  });

  it('Browser: sessionStorage je Speicher, nie localStorage', async () => {
    const session = new Map<string, string>();
    const storage = {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
      removeItem: (k: string) => void session.delete(k),
    };
    const draft = createSessionProtectedStore(storage, PROTECTED_STORE_KEYS.workoutDraft.dataKey);
    await draft.write('x');
    expect([...session.keys()]).toEqual([STORAGE_KEYS.workoutDraft]);
  });
});

describe('Wettlauf clear() ⇄ write() (Wächter C1 B1)', () => {
  const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Verzögerte Fakes wie im Wächter-Skript race2.ts: Schlüssel-Speicher langsam, Versiegeln noch langsamer. */
  function slowSetup() {
    const secretsMap = new Map<string, string>();
    const dataMap = new Map<string, string>();
    let n = 0;
    const options = {
      secrets: {
        get: async (k: string) => {
          await tick(5);
          return secretsMap.get(k) ?? null;
        },
        set: async (k: string, v: string) => {
          await tick(5);
          secretsMap.set(k, v);
        },
        remove: async (k: string) => {
          await tick(5);
          secretsMap.delete(k);
        },
      },
      data: {
        getItem: async (k: string) => dataMap.get(k) ?? null,
        setItem: async (k: string, v: string) => {
          await tick(1);
          dataMap.set(k, v);
        },
        removeItem: async (k: string) => {
          await tick(1);
          dataMap.delete(k);
        },
      },
      cipher: {
        generateKey: async () => `K${++n}`,
        seal: async (key: string, plain: string) => {
          await tick(20);
          return `${key}|${plain}`;
        },
        open: async (key: string, sealed: string) => {
          const [k, plain] = sealed.split('|');
          if (k !== key) throw new Error('falscher Schlüssel');
          return plain ?? '';
        },
      } satisfies AeadCipher,
      keyName: 'key',
      dataKey: 'data',
    };
    return { options, secretsMap };
  }

  it('gleichzeitig clear() und write(), danach weiter schreiben: neue Instanz liest die Daten', async () => {
    const { options, secretsMap } = slowSetup();
    const store = createEncryptedProtectedStore(options);
    await store.write('[A]');
    await Promise.all([store.clear(), store.write('[B]')]);
    expect(await createEncryptedProtectedStore(options).read()).toBe('[B]');
    await store.write('[C]');
    expect(secretsMap.size).toBe(1);
    // App-Neustart.
    expect(await createEncryptedProtectedStore(options).read()).toBe('[C]');
  });

  it('write() vor clear() veranlasst: danach ist der Speicher leer (Reihenfolge bleibt)', async () => {
    const { options } = slowSetup();
    const store = createEncryptedProtectedStore(options);
    await Promise.all([store.write('[A]'), store.clear()]);
    expect(await createEncryptedProtectedStore(options).read()).toBeNull();
    await store.write('[B]');
    expect(await createEncryptedProtectedStore(options).read()).toBe('[B]');
  });
});
