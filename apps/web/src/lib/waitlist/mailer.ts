/**
 * E-Mails über Resend (REST-API, kein SDK): Bestätigungs-Mails (Warteliste, Gratis-Rezepte) und die Mail mit dem
 * Download-Link. Inhalt bewusst schlicht, keine Tracking-Pixel, keine Werbung. Die Texte stehen in mail-texte.ts
 * (dort ändern, Anleitung docs/SETUP.md Teil I8).
 */
import type { WaitlistConfig } from './config';
import { MAIL_TEXTE } from './mail-texte';

/** Welche Liste (Spalte waitlist.source). */
export type WaitlistSource = 'warteliste' | 'lead-magnet';

export interface ConfirmationMail {
  readonly to: string;
  readonly confirmUrl: string;
  readonly unsubscribeUrl: string;
  /** Standard: Warteliste. */
  readonly source?: WaitlistSource;
  /**
   * Nur Gratis-Rezepte: Newsletter-Häkchen dieser Anfrage. Die Mail nennt den Status ausdrücklich – der Klick
   * bestätigt den Newsletter nur, wenn die Mail ihn nennt.
   */
  readonly newsletterOptIn?: boolean;
}

/** Newsletter nachträglich bestellt (Adresse schon bestätigt): eigenes Double-Opt-in, plus Download-Link. */
export interface NewsletterConfirmationMail {
  readonly to: string;
  readonly confirmUrl: string;
  readonly downloadUrl: string;
  readonly unsubscribeUrl: string;
}

export interface DownloadMail {
  readonly to: string;
  readonly downloadUrl: string;
  readonly unsubscribeUrl: string;
  /** Newsletter-Häkchen gesetzt? Steuert nur den Hinweistext (ohne Häkchen: keine weiteren Mails). */
  readonly newsletterOptIn: boolean;
}

export interface Mailer {
  sendConfirmation(mail: ConfirmationMail): Promise<void>;
  sendDownload(mail: DownloadMail): Promise<void>;
  sendNewsletterConfirmation(mail: NewsletterConfirmationMail): Promise<void>;
}

export class MailerError extends Error {
  constructor(status: number) {
    super(`Resend-Aufruf fehlgeschlagen (HTTP ${status}).`);
    this.name = 'MailerError';
  }
}

export interface RenderedMail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface MailLink {
  readonly text: string;
  readonly url: string;
}

interface MailLayout {
  readonly betreff: string;
  readonly text: string;
  /** Hervorgehobener Satz direkt vor dem Knopf (z. B. Newsletter-Status). */
  readonly zusatz?: string;
  readonly knopf: MailLink;
  /** Weiterer Link unter dem Knopf (z. B. Download in der Newsletter-Bestätigung). */
  readonly zweiterLink?: MailLink;
  readonly hinweis: string;
  readonly fussLink: MailLink;
}

/** Ein Layout für alle Mails: Anrede, Text, ggf. Zusatz, Knopf mit Link, Hinweis, Link im Fuß, Gruß. */
function renderLayout(m: MailLayout): RenderedMail {
  const text = [
    MAIL_TEXTE.anrede,
    '',
    m.text,
    ...(m.zusatz ? ['', m.zusatz] : []),
    `${m.knopf.text}: ${m.knopf.url}`,
    ...(m.zweiterLink ? ['', `${m.zweiterLink.text}: ${m.zweiterLink.url}`] : []),
    '',
    m.hinweis,
    '',
    `${m.fussLink.text}: ${m.fussLink.url}`,
    '',
    MAIL_TEXTE.gruss,
  ].join('\n');
  const html = `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#0a0c10">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="font-size:24px;font-weight:800;color:#1f5bff;margin:0 0 16px">Alpha5</p>
<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(MAIL_TEXTE.anrede)}<br>${escapeHtml(m.text)}</p>
${m.zusatz ? `<p style="margin:0 0 16px;line-height:1.5;font-weight:700">${escapeHtml(m.zusatz)}</p>\n` : ''}<p style="margin:0 0 24px"><a href="${escapeHtml(m.knopf.url)}" style="display:inline-block;background:#1f5bff;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">${escapeHtml(m.knopf.text)}</a></p>
${m.zweiterLink ? `<p style="margin:0 0 24px"><a href="${escapeHtml(m.zweiterLink.url)}" style="color:#1747cc;font-weight:700">${escapeHtml(m.zweiterLink.text)}</a></p>\n` : ''}
<p style="margin:0 0 16px;line-height:1.5;font-size:14px;color:#586173">${escapeHtml(m.hinweis)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#586173"><a href="${escapeHtml(m.fussLink.url)}" style="color:#1747cc">${escapeHtml(m.fussLink.text)}</a></p>
<p style="margin:0;font-size:14px;color:#586173">${escapeHtml(MAIL_TEXTE.gruss)}</p>
</div></body></html>`;
  return { subject: m.betreff, text, html };
}

export function renderConfirmationMail(mail: ConfirmationMail): RenderedMail {
  if (mail.source === 'lead-magnet') {
    const t = MAIL_TEXTE.gratisRezepteBestaetigen;
    return renderLayout({
      betreff: t.betreff,
      text: t.text,
      zusatz: mail.newsletterOptIn ? t.mitNewsletter : t.ohneNewsletter,
      knopf: {
        text: mail.newsletterOptIn ? t.knopfMitNewsletter : t.knopfOhneNewsletter,
        url: mail.confirmUrl,
      },
      hinweis: t.hinweis,
      fussLink: { text: t.abmelden, url: mail.unsubscribeUrl },
    });
  }
  const t = MAIL_TEXTE.warteliste;
  return renderLayout({
    betreff: t.betreff,
    text: t.text,
    knopf: { text: t.knopf, url: mail.confirmUrl },
    hinweis: t.hinweis,
    fussLink: { text: t.abmelden, url: mail.unsubscribeUrl },
  });
}

export function renderNewsletterConfirmationMail(mail: NewsletterConfirmationMail): RenderedMail {
  const t = MAIL_TEXTE.gratisRezepteNewsletter;
  return renderLayout({
    betreff: t.betreff,
    text: t.text,
    knopf: { text: t.knopf, url: mail.confirmUrl },
    zweiterLink: { text: t.download, url: mail.downloadUrl },
    hinweis: t.hinweis,
    fussLink: { text: t.abmelden, url: mail.unsubscribeUrl },
  });
}

export function renderDownloadMail(mail: DownloadMail): RenderedMail {
  const t = MAIL_TEXTE.gratisRezepteDownload;
  return renderLayout({
    betreff: t.betreff,
    text: t.text,
    knopf: { text: t.knopf, url: mail.downloadUrl },
    hinweis: mail.newsletterOptIn ? t.mitNewsletter : t.ohneNewsletter,
    fussLink: {
      text: mail.newsletterOptIn ? t.abmeldenMitNewsletter : t.abmeldenOhneNewsletter,
      url: mail.unsubscribeUrl,
    },
  });
}

export function createResendMailer(
  config: Pick<WaitlistConfig, 'resendApiKey' | 'fromEmail'>,
  fetchFn: typeof fetch = fetch,
): Mailer {
  async function send(to: string, unsubscribeUrl: string, rendered: RenderedMail) {
    const response = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [to],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
      }),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new MailerError(response.status);
    }
  }
  return {
    sendConfirmation: (mail) => send(mail.to, mail.unsubscribeUrl, renderConfirmationMail(mail)),
    sendDownload: (mail) => send(mail.to, mail.unsubscribeUrl, renderDownloadMail(mail)),
    sendNewsletterConfirmation: (mail) =>
      send(mail.to, mail.unsubscribeUrl, renderNewsletterConfirmationMail(mail)),
  };
}
