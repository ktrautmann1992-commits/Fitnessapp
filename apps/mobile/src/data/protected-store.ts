import type { KeyValueStore } from './kv';

/**
 * Geschützter Zwischenspeicher für Pläne mit Gesundheitsbezug (Gründer-Entscheidung Frage 14, PLAN-PHASE-3
 * Abschnitt 9) – damit Training im Studio auch ohne Netz möglich bleibt:
 * - iPhone/Android: verschlüsselt mit AES-256-GCM; der Schlüssel liegt im sicheren Schlüsselspeicher des Geräts
 *   (expo-secure-store, Keychain/Keystore), die verschlüsselten Daten in AsyncStorage (SecureStore ist für große
 *   Werte nicht gedacht, ca. 2 KB je Eintrag).
 * - Browser: nur sessionStorage (endet mit dem Tab), nie localStorage.
 * Gelöscht bei Widerruf, Abmelden, Konto löschen und wenn der Server „Plan ersetzt/fehlt“ meldet.
 * Nur ein Eintrag (Text); was hineinkommt, bestimmt cacheableRows() (write-ops.ts).
 */
export interface ProtectedStore {
  /** „encrypted“ (App), „session“ (Browser-Tab) oder „memory“ (Tests). */
  readonly kind: 'encrypted' | 'session' | 'memory';
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryProtectedStore(): ProtectedStore & { peek(): string | null } {
  let value: string | null = null;
  return {
    kind: 'memory',
    read: async () => value,
    write: async (text) => {
      value = text;
    },
    clear: async () => {
      value = null;
    },
    peek: () => value,
  };
}

/** Minimaler Ausschnitt der Web-Storage-Schnittstelle (sessionStorage). */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Browser: sessionStorage – endet mit dem Tab. Ohne sessionStorage (z. B. gesperrt) kein Zwischenspeicher. */
export function createSessionProtectedStore(
  storage: SessionStorageLike | null,
  key: string,
): ProtectedStore {
  return {
    kind: 'session',
    read: async () => {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write: async (text) => {
      try {
        storage?.setItem(key, text);
      } catch {
        // Speicher voll oder gesperrt: dann eben ohne Offline-Plan (nie Fallback auf localStorage).
      }
    },
    clear: async () => {
      try {
        storage?.removeItem(key);
      } catch {
        // nichts zu tun
      }
    },
  };
}

/** Sicherer Schlüsselspeicher des Geräts (expo-secure-store). */
export interface SecretStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

/** AES-GCM (expo-crypto); alle Werte base64. `seal` liefert IV + Geheimtext + Tag in einem Wert. */
export interface AeadCipher {
  generateKey(): Promise<string>;
  seal(keyBase64: string, plaintextBase64: string): Promise<string>;
  open(keyBase64: string, sealedBase64: string): Promise<string>;
}

/**
 * App: Schlüssel im SecretStore (je Installation zufällig, 256 Bit), Daten verschlüsselt im KeyValueStore.
 * `clear()` löscht Daten UND Schlüssel – ein liegengebliebener Geheimtext ist damit nicht mehr lesbar.
 * Unlesbare Daten (falscher Schlüssel, beschädigt) gelten als leer und werden gelöscht.
 */
export function createEncryptedProtectedStore(options: {
  secrets: SecretStore;
  data: KeyValueStore;
  cipher: AeadCipher;
  keyName: string;
  dataKey: string;
}): ProtectedStore {
  const { secrets, data, cipher, keyName, dataKey } = options;
  /** Sperre: gleichzeitige erste Schreibvorgänge erzeugen nur EINEN Schlüssel (sonst wären Daten unlesbar). */
  let keyPromise: Promise<string> | null = null;

  function ensureKey(): Promise<string> {
    keyPromise ??= (async () => {
      const existing = await secrets.get(keyName);
      if (existing !== null) return existing;
      const created = await cipher.generateKey();
      await secrets.set(keyName, created);
      return created;
    })().catch((error: unknown) => {
      keyPromise = null;
      throw error;
    });
    return keyPromise;
  }

  async function clear(): Promise<void> {
    keyPromise = null;
    await data.removeItem(dataKey);
    await secrets.remove(keyName);
  }

  return {
    kind: 'encrypted',
    read: async () => {
      const sealed = await data.getItem(dataKey);
      if (sealed === null) return null;
      const key = await secrets.get(keyName);
      if (key === null) {
        await data.removeItem(dataKey);
        return null;
      }
      try {
        return base64ToUtf8(await cipher.open(key, sealed));
      } catch {
        await clear();
        return null;
      }
    },
    write: async (text) => {
      const key = await ensureKey();
      await data.setItem(dataKey, await cipher.seal(key, utf8ToBase64(text)));
    },
    clear,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Base64 ⇄ UTF-8 ohne Abhängigkeiten (Hermes hat kein Buffer)
// ---------------------------------------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

export function bytesToBase64(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    out += b === undefined ? '=' : ALPHABET[(n >> 6) & 63];
    out += c === undefined ? '=' : ALPHABET[n & 63];
  }
  return out;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((j) => {
      const char = clean[i + j];
      return char === undefined ? -1 : ALPHABET.indexOf(char);
    });
    const [a = 0, b = 0, c = -1, d = -1] = chunk;
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    bytes.push((n >> 16) & 255);
    if (c >= 0) bytes.push((n >> 8) & 255);
    if (d >= 0) bytes.push(n & 255);
  }
  return Uint8Array.from(bytes);
}

export function utf8ToBase64(text: string): string {
  return bytesToBase64(utf8Bytes(text));
}

export function base64ToUtf8(base64: string): string {
  const bytes = base64ToBytes(base64);
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const a = bytes[i] ?? 0;
    let code: number;
    if (a < 0x80) {
      code = a;
      i += 1;
    } else if (a < 0xe0) {
      code = ((a & 0x1f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f);
      i += 2;
    } else if (a < 0xf0) {
      code =
        ((a & 0x0f) << 12) | (((bytes[i + 1] ?? 0) & 0x3f) << 6) | ((bytes[i + 2] ?? 0) & 0x3f);
      i += 3;
    } else {
      code =
        ((a & 0x07) << 18) |
        (((bytes[i + 1] ?? 0) & 0x3f) << 12) |
        (((bytes[i + 2] ?? 0) & 0x3f) << 6) |
        ((bytes[i + 3] ?? 0) & 0x3f);
      i += 4;
    }
    out += String.fromCodePoint(code);
  }
  return out;
}
