import 'dotenv/config';

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
};

export const env = {
  appOrigin: process.env.APP_ORIGIN,
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  mongoUrl: getRequiredEnv('MONGO_URL'),
  port: process.env.PORT || 3001,
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
