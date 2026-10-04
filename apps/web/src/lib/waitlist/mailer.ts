/**
 * Bestätigungs-Mail über Resend (REST-API, kein SDK). Inhalt bewusst schlicht: Bestätigen-Link, Abmelde-Link,
 * Hinweis „nicht angefordert → ignorieren“. Keine Tracking-Pixel, keine Werbung.
 */
import { APP_NAME } from '@fitnessapp/ui';

import type { WaitlistConfig } from './config';

export interface ConfirmationMail {
  readonly to: string;
  readonly confirmUrl: string;
  readonly unsubscribeUrl: string;
}

export interface Mailer {
  sendConfirmation(mail: ConfirmationMail): Promise<void>;
}

export class MailerError extends Error {
  constructor(status: number) {
    super(`Resend-Aufruf fehlgeschlagen (HTTP ${status}).`);
    this.name = 'MailerError';
  }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderConfirmationMail(mail: ConfirmationMail): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Bitte bestätige deine Anmeldung zur ${APP_NAME}-Warteliste`;
  const text = [
    'Hallo,',
    '',
    `du hast dich für die Warteliste von ${APP_NAME} eingetragen. Bitte bestätige deine E-Mail-Adresse:`,
    mail.confirmUrl,
    '',
    'Der Link ist 48 Stunden gültig. Wenn du dich nicht eingetragen hast, ignoriere diese E-Mail einfach –',
    'ohne Bestätigung löschen wir deine Adresse automatisch.',
    '',
    `Abmelden: ${mail.unsubscribeUrl}`,
    '',
    `Dein ${APP_NAME}-Team`,
  ].join('\n');
  const confirm = escapeHtml(mail.confirmUrl);
  const unsubscribe = escapeHtml(mail.unsubscribeUrl);
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0a0c10">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="font-size:24px;font-weight:800;color:#1f5bff;margin:0 0 16px">${APP_NAME}</p>
<p style="margin:0 0 16px;line-height:1.5">Hallo,<br>du hast dich für die Warteliste von ${APP_NAME} eingetragen. Bitte bestätige deine E-Mail-Adresse:</p>
<p style="margin:0 0 24px"><a href="${confirm}" style="display:inline-block;background:#1f5bff;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">Anmeldung bestätigen</a></p>
<p style="margin:0 0 16px;line-height:1.5;font-size:14px;color:#586173">Der Link ist 48 Stunden gültig. Wenn du dich nicht eingetragen hast, ignoriere diese E-Mail einfach – ohne Bestätigung löschen wir deine Adresse automatisch.</p>
<p style="margin:0;font-size:14px;color:#586173"><a href="${unsubscribe}" style="color:#1747cc">Von der Warteliste abmelden</a></p>
</div></body></html>`;
  return { subject, text, html };
}

export function createResendMailer(
  config: Pick<WaitlistConfig, 'resendApiKey' | 'fromEmail'>,
  fetchFn: typeof fetch = fetch,
): Mailer {
  return {
    async sendConfirmation(mail) {
      const { subject, text, html } = renderConfirmationMail(mail);
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: [mail.to],
          subject,
          text,
          html,
          headers: { 'List-Unsubscribe': `<${mail.unsubscribeUrl}>` },
        }),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new MailerError(response.status);
      }
    },
  };
}
