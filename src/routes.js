import { Router } from 'express';
import multer from 'multer';
import CategoryController from './app/controllers/CategoryController.js';
import OrderController from './app/controllers/OrderController.js';
import ProductController from './app/controllers/ProductController.js';
import SessionController from './app/controllers/SessionController.js';
import CreatePaymentIntentController from './app/controllers/stripe/CreatePaymentIntentController.js';
import UserController from './app/controllers/UserController.js';
import adminMiddleware from './app/middlewares/admin.js';
import authMiddleware from './app/middlewares/auth.js';
import multerConfig from './config/multer.cjs';

const routes = new Router();

const upload = multer(multerConfig);

routes.post('/users', UserController.store);
routes.post('/sessions', SessionController.store);

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

routes.post('/create-payment-intent', CreatePaymentIntentController.store);

export default routes;
