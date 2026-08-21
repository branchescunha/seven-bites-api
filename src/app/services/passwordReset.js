import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import * as Yup from 'yup';
import { env } from '../../config/env.js';
import User from '../models/User.js';
import { sendPasswordResetEmail } from './email.js';

export const PASSWORD_RESET_REQUEST_MESSAGE =
  'Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.';
export const PASSWORD_RESET_SUCCESS_MESSAGE =
  'Senha redefinida com sucesso. Entre com sua nova senha.';
export const INVALID_PASSWORD_RESET_TOKEN_MESSAGE =
  'Este link não é mais válido. Solicite uma nova redefinição de senha.';

const PASSWORD_RESET_EXPIRATION_MINUTES = 30;
const PASSWORD_MIN_LENGTH = 6;

const requestSchema = Yup.object({
  email: Yup.string().email().required(),
});

const resetSchema = Yup.object({
  newPassword: Yup.string().min(PASSWORD_MIN_LENGTH).required(),
  token: Yup.string().required(),
});

export const createPasswordResetPublicResponse = () => ({
  body: { message: PASSWORD_RESET_REQUEST_MESSAGE },
  statusCode: 200,
});

export const hashPasswordResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createPasswordResetToken = ({
  now = new Date(),
  tokenGenerator = () => crypto.randomBytes(32).toString('hex'),
  user,
}) => {
  const token = tokenGenerator();
  const expiresAt = new Date(
    now.getTime() + PASSWORD_RESET_EXPIRATION_MINUTES * 60 * 1000,
  );

  return {
    expiresAt,
    token,
    tokenHash: hashPasswordResetToken(token),
    user,
  };
};

export const buildPasswordResetLink = ({ frontendUrl, token }) => {
  const url = new URL('/redefinir-senha', frontendUrl);
  url.searchParams.set('token', token);

  return url.toString();
};

export const requestPasswordReset = async ({
  email,
  frontendUrl = env.frontendUrl,
  now = new Date(),
  sendEmail = sendPasswordResetEmail,
  tokenGenerator,
  userModel = User,
}) => {
  const publicResponse = createPasswordResetPublicResponse();

  const isValid = await requestSchema.isValid(
    { email },
    { abortEarly: false, strict: true },
  );

  if (!isValid) {
    return publicResponse;
  }

  const user = await userModel.findOne({ where: { email } });

  if (!user) {
    return publicResponse;
  }

  const { expiresAt, token, tokenHash } = createPasswordResetToken({
    now,
    tokenGenerator,
    user,
  });

  await user.update({
    password_reset_expires_at: expiresAt,
    password_reset_token_hash: tokenHash,
  });

  if (frontendUrl) {
    try {
      await sendEmail({
        email: user.email,
        resetLink: buildPasswordResetLink({ frontendUrl, token }),
      });
    } catch (_error) {
      return publicResponse;
    }
  }

  return publicResponse;
};

export const resetPassword = async ({
  bcryptLib = bcrypt,
  newPassword,
  now = new Date(),
  token,
  userModel = User,
}) => {
  const isValid = await resetSchema.isValid(
    { newPassword, token },
    { abortEarly: false, strict: true },
  );

  if (!isValid) {
    return {
      body: { error: INVALID_PASSWORD_RESET_TOKEN_MESSAGE },
      statusCode: 400,
    };
  }

  const tokenHash = hashPasswordResetToken(token);
  const user = await userModel.findOne({
    where: {
      password_reset_expires_at: { [Op.gt]: now },
      password_reset_token_hash: tokenHash,
    },
  });

  if (!user) {
    return {
      body: { error: INVALID_PASSWORD_RESET_TOKEN_MESSAGE },
      statusCode: 400,
    };
  }

  const passwordHash = await bcryptLib.hash(newPassword, 10);

  await user.update({
    password_hash: passwordHash,
    password_reset_expires_at: null,
    password_reset_token_hash: null,
  });

  return {
    body: { message: PASSWORD_RESET_SUCCESS_MESSAGE },
    statusCode: 200,
  };
};
