import { describe, expect, it } from 'vitest';

import { singleFlight } from './single-flight';

describe('singleFlight (Doppel-Tipp beim Export, Wächter D K2)', () => {
  it('zweiter Tipp während des Exports startet keinen zweiten', async () => {
    let calls = 0;
    let finish: (value: string) => void = () => undefined;
    const run = singleFlight(() => {
      calls += 1;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const first = run();
    const second = run();
    expect(second).toBe(first);
    finish('ok');
    await expect(first).resolves.toBe('ok');
    expect(calls).toBe(1);
    // Danach wieder frei – auch nach einem Fehler.
    const failing = singleFlight(() => {
      calls += 1;
      return Promise.reject(new Error('x'));
    });
    await expect(failing()).rejects.toThrow('x');
    await expect(failing()).rejects.toThrow('x');
    expect(calls).toBe(3);
  });
});
