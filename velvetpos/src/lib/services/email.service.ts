import { Resend } from 'resend';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY is missing. Email sending is disabled.');
    return null;
  }

  return new Resend(apiKey);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resend = getResendClient();
    if (!resend) {
      return false;
    }

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@velvetpos.dev';

    await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #1A1210; line-height: 1.5;">
      <h2 style="font-family: 'Playfair Display', Georgia, serif; color: #3A2D28; margin-bottom: 8px;">VelvetPOS</h2>
      <p>You requested a password reset for your VelvetPOS account.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#3A2D28;color:#F1EDE6;text-decoration:none;border-radius:8px;">
          Reset password
        </a>
      </p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail(to, 'VelvetPOS password reset', html);
}
