/** Form eines Tokens im Mail-Link: 32 Zufallsbytes, base64url (43 Zeichen). Ohne Node-Abhängigkeit (auch im Browser). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** Token aus dem #Fragment eines Mail-Links (`#token=…`), sonst null. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return isWellFormedToken(token) ? token : null;
}
