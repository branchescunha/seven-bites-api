import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import multer from 'multer';

import './database/index.js';
import { getAllowedOrigins } from './config/env.js';
import routes from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class App {
  constructor() {
    this.app = express();

    this.app.use(
      cors({
        origin(origin, callback) {
          const allowedOrigins = getAllowedOrigins();

          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }

          return callback(new Error('Origin is not allowed by CORS policy.'));
        },
      }),
    );

    this.middlewares();
    this.routes();
    this.errorHandler();
  }

  middlewares() {
    this.app.use(express.json());

    this.app.use(
      '/product-file',
      express.static(resolve(__dirname, '..', 'uploads')),
    );

    this.app.use(
      '/category-file',
      express.static(resolve(__dirname, '..', 'uploads')),
    );
  }

  routes() {
    this.app.use(routes);
  }

  errorHandler() {
    this.app.use((error, _request, response, _next) => {
      if (error instanceof multer.MulterError) {
        const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

        return response.status(statusCode).json({ error: error.message });
      }

      if (error.message === 'Origin is not allowed by CORS policy.') {
        return response.status(403).json({ error: error.message });
      }

      if (error.statusCode) {
        return response.status(error.statusCode).json({ error: error.message });
      }

      return response.status(500).json({ error: 'Internal server error.' });
    });
  }
}

export default new App().app;
