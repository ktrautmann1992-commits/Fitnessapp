/**
 * Sperre für „Code erneut senden“ (docs/PLAN-DASHBOARD.md 2.2): erst 60 Sekunden nach dem letzten Senden wieder
 * möglich – Supabase lässt pro Adresse ohnehin nur etwa eine Mail pro Minute zu (sonst 429). Reine Anzeige-Logik.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Verbleibende ganze Sekunden bis zum erneuten Senden (0 = jetzt möglich). Uhr zurückgestellt → höchstens 60. */
export function resendSecondsLeft(
  sentAtMs: number | null,
  nowMs: number,
  cooldownSeconds: number = OTP_RESEND_COOLDOWN_SECONDS,
): number {
  if (sentAtMs === null || !Number.isFinite(sentAtMs) || !Number.isFinite(nowMs)) return 0;
  const left = Math.ceil((sentAtMs + cooldownSeconds * 1000 - nowMs) / 1000);
  return Math.min(Math.max(left, 0), cooldownSeconds);
}

/**
 * Ansage für den Bildschirmleser nur in groben Schritten (30, 10 und 0 s), damit er nicht jede Sekunde spricht.
 */
export function announceCountdown(secondsLeft: number): boolean {
  return secondsLeft === 30 || secondsLeft === 10 || secondsLeft === 0;
}
