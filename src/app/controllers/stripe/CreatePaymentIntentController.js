import * as Yup from 'yup';
import { getStripeClient } from '../../../config/stripe.js';
import Product from '../../models/Product.js';
import {
  assertAllProductsWereFound,
  calculateOrderAmount,
  normalizeCartProducts,
} from '../../services/cartValidation.js';

const PAYMENT_GATEWAY_ERROR = 'Payment gateway is temporarily unavailable.';

export const sendStripeGatewayError = (response) =>
  response.status(502).json({ error: PAYMENT_GATEWAY_ERROR });

class CreatePaymentIntentController {
  async store(request, response) {
    const schema = Yup.object({
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

    let products;

    try {
      products = normalizeCartProducts(request.body.products);
    } catch (err) {
      return response.status(err.statusCode).json({ error: err.message });
    }

    const productIds = products.map((product) => product.productId);

    const foundProducts = await Product.findAll({
      where: {
        id: productIds,
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
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'brl',
        metadata: {
          productCount: String(products.length),
          userId: String(request.userId),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
    } catch (_err) {
      return sendStripeGatewayError(response);
    }

    return response.json({
      clientSecret: paymentIntent.client_secret,
      dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
    });
  }
}

export default new CreatePaymentIntentController();
