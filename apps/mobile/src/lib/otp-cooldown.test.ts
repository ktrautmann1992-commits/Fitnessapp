import { describe, expect, it } from 'vitest';

import { announceCountdown, OTP_RESEND_COOLDOWN_SECONDS, resendSecondsLeft } from './otp-cooldown';

describe('resendSecondsLeft', () => {
  const sent = 1_000_000;

  it('ohne gesendeten Code sofort möglich', () => {
    expect(resendSecondsLeft(null, sent)).toBe(0);
  });

  it('direkt nach dem Senden volle 60 Sekunden', () => {
    expect(resendSecondsLeft(sent, sent)).toBe(OTP_RESEND_COOLDOWN_SECONDS);
  });

  it('rundet angefangene Sekunden auf', () => {
    expect(resendSecondsLeft(sent, sent + 18_200)).toBe(42);
    expect(resendSecondsLeft(sent, sent + 59_001)).toBe(1);
  });

  it('nach 60 Sekunden wieder möglich, danach nie negativ', () => {
    expect(resendSecondsLeft(sent, sent + 60_000)).toBe(0);
    expect(resendSecondsLeft(sent, sent + 3_600_000)).toBe(0);
  });

  it('zurückgestellte Uhr ergibt höchstens die volle Sperre', () => {
    expect(resendSecondsLeft(sent, sent - 120_000)).toBe(60);
  });

  it('eigene Sperrdauer und ungültige Zeiten', () => {
    expect(resendSecondsLeft(sent, sent + 1_000, 5)).toBe(4);
    expect(resendSecondsLeft(Number.NaN, sent)).toBe(0);
  });
});

describe('announceCountdown', () => {
  it('nur bei 30, 10 und 0 Sekunden', () => {
    expect([60, 45, 30, 11, 10, 1, 0].filter(announceCountdown)).toEqual([30, 10, 0]);
  });
});
