import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';

import './database/index.js';
import { buildCorsOptions } from './app/middlewares/corsOptions.js';
import { errorHandler } from './app/middlewares/errorHandler.js';
import { requestContext } from './app/middlewares/requestContext.js';
import {
  publicAssetHeaders,
  securityHeaders,
} from './app/middlewares/securityHeaders.js';
import { env } from './config/env.js';
import routes from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

class App {
  constructor() {
    this.app = express();

    if (env.trustProxy) {
      this.app.set('trust proxy', env.trustProxy);
    }

    this.app.use(requestContext);
    this.app.use(securityHeaders);
    this.app.use(cors(buildCorsOptions()));

    this.middlewares();
    this.routes();
    this.errorHandler();
  }

  middlewares() {
    this.app.use(express.json());

    this.app.use(
      '/product-file',
      publicAssetHeaders,
      express.static(resolve(__dirname, '..', 'uploads')),
    );

    this.app.use(
      '/category-file',
      publicAssetHeaders,
      express.static(resolve(__dirname, '..', 'uploads')),
    );
  }

  routes() {
    this.app.use(routes);
  }

  errorHandler() {
    this.app.use(errorHandler);
  }
}

export default new App().app;
