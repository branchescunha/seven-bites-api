import { getAllowedOrigins } from '../../config/env.js';

export const buildCorsOptions = (getOrigins = getAllowedOrigins) => ({
  origin(origin, callback) {
    const allowedOrigins = getOrigins();

    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS policy.'));
  },
});
