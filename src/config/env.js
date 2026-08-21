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

const getTrustProxyEnv = () => {
  if (!process.env.TRUST_PROXY) {
    return undefined;
  }

  const value = Number(process.env.TRUST_PROXY);

  return Number.isInteger(value) && value >= 0
    ? value
    : process.env.TRUST_PROXY;
};

export const env = {
  appOrigin: process.env.APP_ORIGIN,
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
  cloudinaryUrl: process.env.CLOUDINARY_URL,
  databaseUrl: process.env.DATABASE_URL,
  emailFrom: process.env.EMAIL_FROM,
  frontendUrl: process.env.FRONTEND_URL || process.env.APP_ORIGIN,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  mongoUrl: getRequiredEnv('MONGO_URL'),
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  rateLimitAuthMax: getNumberEnv('RATE_LIMIT_AUTH_MAX', 20),
  rateLimitPaymentMax: getNumberEnv('RATE_LIMIT_PAYMENT_MAX', 60),
  rateLimitWindowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  resendApiKey: process.env.RESEND_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  trustProxy: getTrustProxyEnv(),
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
