import { env } from './env.js';

export default {
  secret: env.jwtSecret,
  expiresIn: env.jwtExpiresIn,
};
