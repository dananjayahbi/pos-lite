import { Resend } from 'resend';
import { warnProviderNotConfigured } from '@/lib/notifications/provider-status';

/**
 * Structured send outcome (M01-01 / INF-03 step 4): callers must be able to
 * distinguish "provider not configured" from "provider rejected the send"
 * without parsing logs. `delivered` is the only field most callers need.
 */
export interface EmailSendResult {
  delivered: boolean;
  /** 'provider-not-configured' | 'provider-error' when delivered === false */
  reason?: string;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // M31-01: loud + throttled so an unconfigured deployment is visible in
    // logs/Sentry instead of only the per-send false return.
    warnProviderNotConfigured('email');
    return null;
  }

  return new Resend(apiKey);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailSendResult> {
  try {
    const resend = getResendClient();
    if (!resend) {
      return { delivered: false, reason: 'provider-not-configured' };
    }

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@ayurpos.dev';

    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return { delivered: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { delivered: false, reason: 'provider-error' };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<EmailSendResult> {
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #1A1210; line-height: 1.5;">
      <h2 style="font-family: 'Playfair Display', Georgia, serif; color: #3A2D28; margin-bottom: 8px;">AyurPOS</h2>
      <p>You requested a password reset for your AyurPOS account.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#3A2D28;color:#F1EDE6;text-decoration:none;border-radius:8px;">
          Reset password
        </a>
      </p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail(to, 'AyurPOS password reset', html);
}
