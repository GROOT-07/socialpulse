/**
 * mailer.ts — Nodemailer transporter for SocialPulse
 *
 * Reads SMTP config from environment variables.
 * If any required SMTP var is missing, sending is silently skipped
 * and a warning is logged so the server never crashes on missing config.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Optional:
 *   APP_URL (used to build the reset-password link; falls back to API_BASE_URL)
 */

import nodemailer, { type Transporter } from 'nodemailer'

// ── Transporter (lazy singleton) ──────────────────────────────

let _transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  return _transporter
}

// ── From address helper ────────────────────────────────────────

function fromAddress(): string {
  return process.env.SMTP_FROM ?? `SocialPulse <no-reply@socialpulse.app>`
}

// ── App URL helper ─────────────────────────────────────────────

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.API_BASE_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '')
}

// ── sendPasswordResetEmail ─────────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const transport = getTransporter()

  if (!transport) {
    console.warn(
      `[mailer] SMTP not configured — password reset email NOT sent to ${email}. ` +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in your environment.',
    )
    return
  }

  const resetUrl = `${appUrl()}/reset-password?token=${token}`
  const expiryNote = '1 hour'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your SocialPulse password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:28px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                SocialPulse
              </h1>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Social Media Strategy Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                We received a request to reset the password for your account associated with
                <strong>${email}</strong>. Click the button below to choose a new password.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#6366f1;">
                    <a
                      href="${resetUrl}"
                      style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;"
                    >
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                This link expires in <strong>${expiryNote}</strong>. If you did not request a password reset,
                you can safely ignore this email — your password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                If the button above doesn't work, copy and paste this URL into your browser:<br>
                <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = [
    'Reset your SocialPulse password',
    '',
    `We received a request to reset the password for ${email}.`,
    '',
    `Reset link (expires in ${expiryNote}):`,
    resetUrl,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n')

  await transport.sendMail({
    from: fromAddress(),
    to: email,
    subject: 'Reset your SocialPulse password',
    text,
    html,
  })

  console.info(`[mailer] Password reset email sent to ${email}`)
}
