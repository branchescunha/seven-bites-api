import * as Yup from 'yup';
import { getStripeClient } from '../../config/stripe.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../schemas/Order.js';
import {
  assertAllProductsWereFound,
  calculateOrderAmount,
  normalizeCartProducts,
} from '../services/cartValidation.js';
import { assertPaymentIntentCanCreateOrder } from '../services/paymentValidation.js';

const ORDER_STATUS = {
  pending: 'Pedido Realizado',
  legacyPending: 'Pedido realizado',
};

const PAYMENT_GATEWAY_ERROR = 'Payment gateway is temporarily unavailable.';
const PAYMENT_ALREADY_USED_ERROR = 'Order already exists for this payment.';

const normalizeOrderStatus = (status) =>
  status === ORDER_STATUS.legacyPending ? ORDER_STATUS.pending : status;

const isDuplicatePaymentIntentError = (err) =>
  err?.code === 11000 &&
  (err?.keyPattern?.paymentIntentId === 1 ||
    Object.hasOwn(err?.keyValue ?? {}, 'paymentIntentId'));

export const handleOrderPersistenceError = (err, response) => {
  if (isDuplicatePaymentIntentError(err)) {
    return response.status(409).json({ error: PAYMENT_ALREADY_USED_ERROR });
  }

  throw err;
};

const isMissingPaymentIntentError = (err) =>
  err?.code === 'resource_missing' || err?.raw?.code === 'resource_missing';

const sendPaymentGatewayError = (response) =>
  response.status(502).json({ error: PAYMENT_GATEWAY_ERROR });

export const sendPaymentIntentRetrieveError = (err, response) => {
  if (isMissingPaymentIntentError(err)) {
    return response
      .status(404)
      .json({ error: 'Payment intent was not found.' });
  }

  return sendPaymentGatewayError(response);
};

class OrderController {
  async store(request, response) {
    const schema = Yup.object({
      paymentIntentId: Yup.string().required(),
      products: Yup.array()
        .required()
        .of(
          Yup.object({
            productId: Yup.number().integer().positive(),
            id: Yup.number().integer().positive(),
            quantity: Yup.number().integer().positive().required(),
          }),
        ),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false, strict: true });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { userId, userName } = request;
    const { paymentIntentId } = request.body;

    let products;

    try {
      products = normalizeCartProducts(request.body.products);
    } catch (err) {
      return response.status(err.statusCode).json({ error: err.message });
    }

    const existingOrder = await Order.findOne({ paymentIntentId });

    if (existingOrder) {
      return response
        .status(409)
        .json({ error: 'Order already exists for this payment.' });
    }

    const productIds = products.map((product) => product.productId);

    const foundProducts = await Product.findAll({
      where: {
        id: productIds,
      },
      include: {
        model: Category,
        as: 'category',
        attributes: ['name'],
      },
    });

    try {
      assertAllProductsWereFound(foundProducts, products);
    } catch (err) {
      return response.status(err.statusCode).json({ error: err.message });
    }

    const amount = calculateOrderAmount(foundProducts, products);
    const stripe = getStripeClient();

    if (!stripe) {
      return response
        .status(503)
        .json({ error: 'Payment service is not configured.' });
    }

    let paymentIntent;

    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
      return sendPaymentIntentRetrieveError(err, response);
    }

    try {
      assertPaymentIntentCanCreateOrder({
        amount,
        paymentIntent,
        userId: String(userId),
      });
    } catch (err) {
      return response.status(err.statusCode).json({ error: err.message });
    }

    const mappedProducts = foundProducts.map((product) => {
      const quantity = products.find(
        (p) => p.productId === product.id,
      ).quantity;

      const newProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        url: product.url,
        category: product.category.name,
        quantity,
      };

      return newProduct;
    });

    const order = {
      user: {
        id: userId,
        name: userName,
      },
      paymentIntentId,
      products: mappedProducts,
      status: ORDER_STATUS.pending,
      totalAmount: amount,
      currency: 'brl',
    };

    try {
      const newOrder = await Order.create(order);

      return response.status(201).json(newOrder);
    } catch (err) {
      return handleOrderPersistenceError(err, response);
    }
  }

  async update(request, response) {
    const schema = Yup.object({
      status: Yup.string().required(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false, strict: true });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { status } = request.body;
    const { id } = request.params;

    try {
      await Order.updateOne(
        { _id: id },
        { status: normalizeOrderStatus(status) },
      );
    } catch (err) {
      return response.status(400).json({ error: err.message });
    }

    return response.status(200).json('Status update sucessfully');
  }

  async index(_request, response) {
    const orders = await Order.find();

    return response.status(200).json(orders);
  }
}

export default new OrderController();
