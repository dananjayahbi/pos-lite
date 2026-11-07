/**
 * Shared broadcast content helpers.
 *
 * Pure functions only (no Prisma / no provider imports) so the same template
 * definitions can be imported by the client composer, the send route and unit
 * tests without pulling server code into the browser bundle.
 */

export type BroadcastChannelValue = 'EMAIL' | 'SMS';

export interface BroadcastTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  html: string;
}

const BASE_STYLES = `
  body{margin:0;background:#f6f1ea;font-family:Arial,Helvetica,sans-serif;color:#3a2d28;}
  .wrap{max-width:600px;margin:0 auto;background:#ffffff;}
  .header{padding:24px 32px;background:#3a2d28;color:#f1ede6;}
  .header h1{margin:0;font-size:22px;}
  .content{padding:32px;font-size:15px;line-height:1.6;}
  .content h2{font-size:20px;margin-top:0;}
  .button{display:inline-block;padding:12px 22px;background:#c8956c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;}
  .gallery{padding:0 32px 32px;}
  .gallery img{width:100%;max-width:536px;border-radius:10px;display:block;margin:12px 0;}
  .footer{padding:20px 32px;background:#f6f1ea;color:#8a7a72;font-size:12px;text-align:center;}
`;

function document(body: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${BASE_STYLES}</style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

/** Ready-made email templates exposed in the composer. */
export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start from scratch with a bare HTML body.',
    subject: 'A message from {{storeName}}',
    html: document(`
      <div class="wrap">
        <div class="header"><h1>{{storeName}}</h1></div>
        <div class="content">
          <p>Hi {{name}},</p>
          <p>Write your message here.</p>
        </div>
        <div class="footer">You are receiving this email from {{storeName}}.</div>
      </div>
    `),
  },
  {
    id: 'promotion',
    name: 'Promotion',
    description: 'A bold offer announcement with a call-to-action button.',
    subject: '{{name}}, a special offer from {{storeName}}',
    html: document(`
      <div class="wrap">
        <div class="header"><h1>{{storeName}}</h1></div>
        <div class="content">
          <h2>A special offer, just for you</h2>
          <p>Hi {{name}},</p>
          <p>Enjoy a limited-time discount on your favourite products. Offer ends soon — don&apos;t miss it.</p>
          <p style="margin:28px 0;">
            <a class="button" href="https://example.com">Shop the offer</a>
          </p>
          <p>Warm regards,<br />{{storeName}}</p>
        </div>
        <div class="footer">You are receiving this email from {{storeName}}.</div>
      </div>
    `),
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    description: 'A friendly update with room for a headline and story.',
    subject: 'News from {{storeName}}',
    html: document(`
      <div class="wrap">
        <div class="header"><h1>{{storeName}} Newsletter</h1></div>
        <div class="content">
          <p>Hi {{name}},</p>
          <h2>What&apos;s new this month</h2>
          <p>Share your latest arrivals, clinic news or seasonal tips here.</p>
          <p>Thank you for being part of the {{storeName}} community.</p>
        </div>
        <div class="footer">You are receiving this email from {{storeName}}.</div>
      </div>
    `),
  },
  {
    id: 'birthday',
    name: 'Birthday greeting',
    description: 'A warm birthday wish with a celebration tone.',
    subject: 'Happy birthday, {{name}}!',
    html: document(`
      <div class="wrap">
        <div class="header"><h1>Happy Birthday, {{name}}!</h1></div>
        <div class="content">
          <p>Hi {{name}},</p>
          <p>Everyone at {{storeName}} wishes you a wonderful birthday and a healthy year ahead.</p>
          <p>Drop by and celebrate with us — we would love to see you.</p>
        </div>
        <div class="footer">You are receiving this email from {{storeName}}.</div>
      </div>
    `),
  },
];

export function getBroadcastTemplate(id: string | undefined): BroadcastTemplate | null {
  if (!id) return null;
  return BROADCAST_TEMPLATES.find((template) => template.id === id) ?? null;
}

/** Replace the supported placeholders in text/HTML/subject. */
export function personalizeBroadcastContent(
  content: string,
  customerName: string,
  storeName: string,
): string {
  const firstName = customerName.trim().split(/\s+/)[0] ?? '';
  return content
    .replaceAll('{{name}}', firstName)
    .replaceAll('{{storeName}}', storeName);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert a plain-text message into simple, escaped HTML paragraphs. */
export function textToHtml(text: string): string {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br />')}</p>`)
    .join('\n');
}

export interface BuildEmailHtmlParams {
  /** Author-supplied HTML. When empty, `text` is converted to paragraphs. */
  html?: string | null | undefined;
  text?: string | null | undefined;
  customerName: string;
  storeName: string;
  /** Public image URLs appended as a gallery and attached to the email. */
  images?: string[] | undefined;
}

/**
 * Personalise an email body and append uploaded images. Images are escaped into
 * `<img>` tags pointing at their public URL so the message renders in every
 * client; the same URLs are passed to Resend as attachments.
 */
export function buildEmailHtml(params: BuildEmailHtmlParams): string {
  const source = params.html?.trim()
    ? params.html
    : textToHtml(params.text ?? '');
  const personalised = personalizeBroadcastContent(source, params.customerName, params.storeName);

  const images = (params.images ?? []).filter(Boolean);
  if (images.length === 0) return personalised;

  const alreadyEmbedded = images.every((url) => personalised.includes(url));
  if (alreadyEmbedded) return personalised;

  const gallery = images
    .map(
      (url, index) =>
        `<img src="${escapeHtml(url)}" alt="Broadcast image ${index + 1}" />`,
    )
    .join('\n');

  const section = `<div class="gallery">${gallery}</div>`;
  if (/<\/body>/i.test(personalised)) {
    return personalised.replace(/<\/body>/i, `${section}</body>`);
  }
  return `${personalised}${section}`;
}

/** Render SMS text with the same placeholder rules. */
export function buildSmsText(params: {
  message: string;
  customerName: string;
  storeName: string;
}): string {
  return personalizeBroadcastContent(params.message, params.customerName, params.storeName);
}
