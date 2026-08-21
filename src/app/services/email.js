import { env } from '../../config/env.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export const isEmailConfigured = () =>
  Boolean(env.resendApiKey && env.emailFrom);

export const sendPasswordResetEmail = async ({ email, resetLink }) => {
  if (!isEmailConfigured()) {
    return { skipped: true };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    body: JSON.stringify({
      from: env.emailFrom,
      to: email,
      subject: 'Redefinição de senha — Seven Bites',
      html: `
        <main style="font-family: Arial, sans-serif; color: #202124; line-height: 1.6;">
          <h1 style="color: #8f1d2c;">Redefinição de senha</h1>
          <p>Recebemos uma solicitação para redefinir sua senha no Seven Bites.</p>
          <p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 18px; background: #c88a2d; color: #202124; font-weight: 700; text-decoration: none; border-radius: 8px;">
              Redefinir senha
            </a>
          </p>
          <p>Este link expira em 30 minutos.</p>
          <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
        </main>
      `,
    }),
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    return { failed: true, statusCode: response.status };
  }

  return { sent: true };
};
