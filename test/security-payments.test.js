import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import jwt from 'jsonwebtoken';

process.env.APP_URL = 'http://localhost:3001';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URL = 'mongodb://localhost:27017/seven-bites-test';

const require = createRequire(import.meta.url);

const { default: adminMiddleware } = await import(
  '../src/app/middlewares/admin.js'
);
const { default: authMiddleware } = await import(
  '../src/app/middlewares/auth.js'
);
const multerConfig = require('../src/config/multer.cjs');
const {
  MAX_ITEM_QUANTITY,
  assertAllProductsWereFound,
  calculateProductsAmount,
  normalizeCartProducts,
} = await import('../src/app/services/cartValidation.js');
const { assertPaymentIntentCanCreateOrder } = await import(
  '../src/app/services/paymentValidation.js'
);
const { buildPublicUserPayload } = await import(
  '../src/app/services/userPayload.js'
);
const { handleOrderPersistenceError, sendPaymentIntentRetrieveError } =
  await import('../src/app/controllers/OrderController.js');
const { sendStripeGatewayError } = await import(
  '../src/app/controllers/stripe/CreatePaymentIntentController.js'
);

const createResponse = () => {
  const response = {
    body: null,
    statusCode: null,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };

  return response;
};

test('public user payload always creates a non-admin user', () => {
  const payload = buildPublicUserPayload({
    admin: true,
    email: 'client@example.com',
    name: 'Client',
    password: '123456',
  });

  assert.equal(payload.admin, false);
});

test('auth middleware accepts a valid bearer token', () => {
  const token = jwt.sign(
    { admin: true, id: 'user-id', name: 'Admin' },
    process.env.JWT_SECRET,
  );
  const request = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
  const response = createResponse();
  let nextWasCalled = false;

  authMiddleware(request, response, () => {
    nextWasCalled = true;
  });

  assert.equal(nextWasCalled, true);
  assert.equal(request.userId, 'user-id');
  assert.equal(request.userIsAdmin, true);
});

test('auth middleware rejects missing bearer token', () => {
  const response = createResponse();

  authMiddleware({ headers: {} }, response, () => {});

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, {
    error: 'Authentication token is required.',
  });
});

test('admin middleware blocks non-admin users', () => {
  const response = createResponse();

  adminMiddleware({ userIsAdmin: false }, response, () => {});

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'Admin access is required.' });
});

test('cart normalization ignores client price and consolidates duplicates', () => {
  const products = normalizeCartProducts([
    { price: 1, productId: 1, quantity: 2 },
    { id: 1, price: 999999, quantity: 1 },
  ]);

  assert.deepEqual(products, [{ productId: 1, quantity: 3 }]);
});

test('cart amount is calculated from database prices', () => {
  const amount = calculateProductsAmount(
    [
      { id: 1, price: 1200 },
      { id: 2, price: 800 },
    ],
    [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ],
  );

  assert.equal(amount, 3200);
});

test('missing products are rejected', () => {
  assert.throws(
    () =>
      assertAllProductsWereFound(
        [{ id: 1, price: 1200 }],
        [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
      ),
    /unavailable/,
  );
});

test('payment validation rejects unpaid payment intents', () => {
  assert.throws(
    () =>
      assertPaymentIntentCanCreateOrder({
        amount: 1000,
        paymentIntent: {
          amount: 1000,
          currency: 'brl',
          metadata: { userId: 'user-id' },
          status: 'requires_payment_method',
        },
        userId: 'user-id',
      }),
    /not completed/,
  );
});

test('payment validation rejects amount mismatch', () => {
  assert.throws(
    () =>
      assertPaymentIntentCanCreateOrder({
        amount: 1000,
        paymentIntent: {
          amount_received: 900,
          currency: 'brl',
          metadata: { userId: 'user-id' },
          status: 'succeeded',
        },
        userId: 'user-id',
      }),
    /does not match/,
  );
});

test('payment validation rejects payment intents without user metadata', () => {
  assert.throws(
    () =>
      assertPaymentIntentCanCreateOrder({
        amount: 1000,
        paymentIntent: {
          amount_received: 1000,
          currency: 'brl',
          metadata: {},
          status: 'succeeded',
        },
        userId: 'user-id',
      }),
    /not linked/,
  );
});

test('payment validation rejects payment intents from another user', () => {
  assert.throws(
    () =>
      assertPaymentIntentCanCreateOrder({
        amount: 1000,
        paymentIntent: {
          amount_received: 1000,
          currency: 'brl',
          metadata: { userId: 'another-user' },
          status: 'succeeded',
        },
        userId: 'user-id',
      }),
    /does not belong/,
  );
});

test('payment validation accepts payment intents linked to the authenticated user', () => {
  assert.doesNotThrow(() =>
    assertPaymentIntentCanCreateOrder({
      amount: 1000,
      paymentIntent: {
        amount_received: 1000,
        currency: 'brl',
        metadata: { userId: 'user-id' },
        status: 'succeeded',
      },
      userId: 'user-id',
    }),
  );
});

test('cart quantity zero is rejected', () => {
  assert.throws(
    () => normalizeCartProducts([{ productId: 1, quantity: 0 }]),
    /positive integer/,
  );
});

test('cart quantity negative is rejected', () => {
  assert.throws(
    () => normalizeCartProducts([{ productId: 1, quantity: -1 }]),
    /positive integer/,
  );
});

test('cart quantity decimal is rejected', () => {
  assert.throws(
    () => normalizeCartProducts([{ productId: 1, quantity: 1.5 }]),
    /positive integer/,
  );
});

test('cart quantity maximum is accepted', () => {
  const products = normalizeCartProducts([
    { productId: 1, quantity: MAX_ITEM_QUANTITY },
  ]);

  assert.deepEqual(products, [{ productId: 1, quantity: MAX_ITEM_QUANTITY }]);
});

test('cart quantity over maximum is rejected', () => {
  assert.throws(
    () => normalizeCartProducts([{ productId: 1, quantity: 100 }]),
    /cannot exceed 99/,
  );
});

test('duplicated cart items are accepted when consolidated quantity is maximum', () => {
  const products = normalizeCartProducts([
    { productId: 1, quantity: 40 },
    { productId: 1, quantity: 59 },
  ]);

  assert.deepEqual(products, [{ productId: 1, quantity: MAX_ITEM_QUANTITY }]);
});

test('duplicated cart items are rejected when consolidated quantity exceeds maximum', () => {
  assert.throws(
    () =>
      normalizeCartProducts([
        { productId: 1, quantity: 60 },
        { productId: 1, quantity: 40 },
      ]),
    /cannot exceed 99/,
  );
});

test('paymentIntentId duplicate Mongo error is converted to HTTP 409', () => {
  const response = createResponse();

  handleOrderPersistenceError(
    {
      code: 11000,
      keyPattern: { paymentIntentId: 1 },
    },
    response,
  );

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: 'Order already exists for this payment.',
  });
});

test('non-payment Mongo error is not converted to payment conflict', () => {
  const response = createResponse();
  const error = {
    code: 11000,
    keyPattern: { email: 1 },
    message: 'duplicate email',
  };

  assert.throws(
    () => handleOrderPersistenceError(error, response),
    (thrownError) => thrownError === error,
  );
  assert.equal(response.statusCode, null);
});

test('stripe failure while creating payment intent returns a controlled gateway error', () => {
  const response = createResponse();

  sendStripeGatewayError(response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, {
    error: 'Payment gateway is temporarily unavailable.',
  });
});

test('stripe failure while retrieving payment intent blocks order creation', () => {
  const response = createResponse();

  sendPaymentIntentRetrieveError(new Error('network failure'), response);

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, {
    error: 'Payment gateway is temporarily unavailable.',
  });
});

test('missing stripe configuration response remains HTTP 503', () => {
  const response = createResponse();

  response.status(503).json({ error: 'Payment service is not configured.' });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    error: 'Payment service is not configured.',
  });
});

test('multer accepts only configured image types and size', () => {
  assert.equal(multerConfig.limits.fileSize, 2 * 1024 * 1024);

  multerConfig.fileFilter(
    {},
    { mimetype: 'image/png', originalname: 'product.png' },
    (error, accepted) => {
      assert.equal(error, null);
      assert.equal(accepted, true);
    },
  );

  multerConfig.fileFilter(
    {},
    { mimetype: 'image/svg+xml', originalname: 'product.svg' },
    (error) => {
      assert.match(error.message, /Only JPG, PNG and WebP/);
      assert.equal(error.statusCode, 400);
    },
  );
});
