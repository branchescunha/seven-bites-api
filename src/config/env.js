import 'dotenv/config';

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
};

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const env = {
  appOrigin: process.env.APP_ORIGIN,
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  mongoUrl: getRequiredEnv('MONGO_URL'),
  port: process.env.PORT || 3001,
  rateLimitAuthMax: getNumberEnv('RATE_LIMIT_AUTH_MAX', 20),
  rateLimitPaymentMax: getNumberEnv('RATE_LIMIT_PAYMENT_MAX', 60),
  rateLimitWindowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
};

export const getAllowedOrigins = () => {
  if (!env.appOrigin) {
    return [];
  }

  return env.appOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};
