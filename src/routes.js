import { Router } from 'express';
import multer from 'multer';
import CategoryController from './app/controllers/CategoryController.js';
import HealthController from './app/controllers/HealthController.js';
import OrderController from './app/controllers/OrderController.js';
import PasswordResetController from './app/controllers/PasswordResetController.js';
import ProductController from './app/controllers/ProductController.js';
import SessionController from './app/controllers/SessionController.js';
import CreatePaymentIntentController from './app/controllers/stripe/CreatePaymentIntentController.js';
import UserController from './app/controllers/UserController.js';
import adminMiddleware from './app/middlewares/admin.js';
import authMiddleware from './app/middlewares/auth.js';
import { rateLimit } from './app/middlewares/rateLimit.js';
import { env } from './config/env.js';
import multerConfig from './config/multer.cjs';
import { openApiDocument } from './docs/openapi.js';

const routes = new Router();

const upload = multer(multerConfig);
const authRateLimit = rateLimit({
  keyPrefix: 'auth',
  limit: env.rateLimitAuthMax,
  windowMs: env.rateLimitWindowMs,
});
const paymentRateLimit = rateLimit({
  keyPrefix: 'payment-intent',
  limit: env.rateLimitPaymentMax,
  windowMs: env.rateLimitWindowMs,
});

routes.get('/health', HealthController.show);
routes.get('/ready', HealthController.ready);
routes.get('/openapi.json', (_request, response) =>
  response.status(200).json(openApiDocument),
);
routes.get('/docs', (_request, response) =>
  response.type('html').send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Seven Bites API Docs</title>
  </head>
  <body>
    <main>
      <h1>Seven Bites API Docs</h1>
      <p>OpenAPI 3 document: <a href="/openapi.json">/openapi.json</a></p>
    </main>
  </body>
</html>`),
);

routes.post('/users', authRateLimit, UserController.store);
routes.post('/sessions', authRateLimit, SessionController.store);
routes.post('/password/forgot', authRateLimit, PasswordResetController.forgot);
routes.post('/password/reset', authRateLimit, PasswordResetController.reset);

routes.get('/products', ProductController.index);
routes.get('/categories', CategoryController.index);

routes.use(authMiddleware);

routes.post(
  '/products',
  adminMiddleware,
  upload.single('file'),
  ProductController.store,
);

routes.put(
  '/products/:id',
  adminMiddleware,
  upload.single('file'),
  ProductController.update,
);

routes.post(
  '/categories',
  adminMiddleware,
  upload.single('file'),
  CategoryController.store,
);

routes.put(
  '/categories/:id',
  adminMiddleware,
  upload.single('file'),
  CategoryController.update,
);

routes.post('/orders', OrderController.store);
routes.get('/orders', adminMiddleware, OrderController.index);
routes.put('/orders/:id', adminMiddleware, OrderController.update);

routes.post(
  '/create-payment-intent',
  paymentRateLimit,
  CreatePaymentIntentController.store,
);

export default routes;
