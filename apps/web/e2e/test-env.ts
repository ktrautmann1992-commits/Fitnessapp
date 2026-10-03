/** Testzugang NUR für die Klick-Tests (keine echten Secrets – die stehen ausschließlich in Vercel). */
export const E2E_ADMIN_PASSWORD = 'e2e-nur-test-passwort-1234567890';
export const E2E_SESSION_SECRET = 'e2e-nur-test-sitzungs-schluessel-0123456789';
/** Server mit Testzugang. */
export const PORT_CONFIGURED = 3100;
/** Server ohne Zugangsdaten („nicht eingerichtet“). */
export const PORT_LOCKED = 3101;
export const LOCKED_URL = `http://localhost:${PORT_LOCKED}`;
export const CONFIGURED_URL = `http://localhost:${PORT_CONFIGURED}`;
