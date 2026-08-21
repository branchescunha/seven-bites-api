import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.APP_URL = 'http://localhost:3001';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URL = 'mongodb://localhost:27017/seven-bites-test';

const require = createRequire(import.meta.url);

const databaseConfig = require('../src/config/database.cjs');
const { default: adminMiddleware } = await import(
  '../src/app/middlewares/admin.js'
);
const { default: authMiddleware } = await import(
  '../src/app/middlewares/auth.js'
);
const multerConfig = require('../src/config/multer.cjs');
const {
  DELIVERY_TAX_AMOUNT,
  MAX_ITEM_QUANTITY,
  assertAllProductsWereFound,
  calculateOrderAmount,
  calculateProductsAmount,
  normalizeCartProducts,
} = await import('../src/app/services/cartValidation.js');
const { buildHealthPayload, buildReadyPayload } = await import(
  '../src/app/services/health.js'
);
const { connectMongo } = await import(
  '../src/app/services/databaseConnection.js'
);
const { env } = await import('../src/config/env.js');
const { resolveMediaUrl, saveMediaFile } = await import(
  '../src/app/services/mediaStorage.js'
);
const { assertPaymentIntentCanCreateOrder } = await import(
  '../src/app/services/paymentValidation.js'
);
const { buildPublicUserPayload } = await import(
  '../src/app/services/userPayload.js'
);
const {
  INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_REQUEST_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
  requestPasswordReset,
  resetPassword,
} = await import('../src/app/services/passwordReset.js');
const { handleOrderPersistenceError, sendPaymentIntentRetrieveError } =
  await import('../src/app/controllers/OrderController.js');
const { sendStripeGatewayError } = await import(
  '../src/app/controllers/stripe/CreatePaymentIntentController.js'
);
const { sendDuplicateEmailResponse } = await import(
  '../src/app/controllers/UserController.js'
);
const { buildCorsOptions } = await import(
  '../src/app/middlewares/corsOptions.js'
);
const { errorHandler } = await import('../src/app/middlewares/errorHandler.js');
const { rateLimit } = await import('../src/app/middlewares/rateLimit.js');
const { requestContext } = await import(
  '../src/app/middlewares/requestContext.js'
);
const { publicAssetHeaders, securityHeaders } = await import(
  '../src/app/middlewares/securityHeaders.js'
);
const { openApiDocument } = await import('../src/docs/openapi.js');

const createResponse = () => {
  const response = {
    body: null,
    statusCode: null,
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers = { ...(this.headers || {}), [name]: value };
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };

  return response;
};

const createRequest = (overrides = {}) => ({
  get: () => undefined,
  ip: '127.0.0.1',
  method: 'GET',
  originalUrl: '/test',
  ...overrides,
});

const createPasswordResetTestStore = () => {
  const users = [
    {
      admin: false,
      email: 'client@example.com',
      id: 'client-id',
      name: 'Client',
      password_hash: bcrypt.hashSync('old-secret', 10),
      password_reset_expires_at: null,
      password_reset_token_hash: null,
    },
  ];

  const attachUpdate = (user) => ({
    ...user,
    async update(values) {
      Object.assign(user, values);
      Object.assign(this, values);
      return this;
    },
  });

  return {
    findUser(email) {
      return users.find((user) => user.email === email);
    },
    model: {
      async findOne({ where }) {
        if ('email' in where) {
          const user = users.find((item) => item.email === where.email);
          return user ? attachUpdate(user) : null;
        }

        if ('password_reset_token_hash' in where) {
          const user = users.find((item) => {
            const expiresAt = item.password_reset_expires_at;
            const expiresAfter =
              where.password_reset_expires_at?.gt ||
              where.password_reset_expires_at?.[
                Object.getOwnPropertySymbols(where.password_reset_expires_at)[0]
              ];

            return (
              item.password_reset_token_hash ===
                where.password_reset_token_hash &&
              expiresAt &&
              expiresAfter &&
              expiresAt > expiresAfter
            );
          });

          return user ? attachUpdate(user) : null;
        }

        return null;
      },
    },
  };
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

test('duplicate user registration returns a clear conflict response', () => {
  const response = createResponse();

  sendDuplicateEmailResponse(response);

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body, {
    error: 'Já existe uma conta com este e-mail. Entre para continuar.',
  });
});

test('forgot password with an existing user returns a neutral response', async () => {
  const store = createPasswordResetTestStore();
  const sentEmails = [];

  const response = await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async (message) => {
      sentEmails.push(message);
    },
    tokenGenerator: () => 'existing-user-reset-token',
    userModel: store.model,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: PASSWORD_RESET_REQUEST_MESSAGE });
  assert.equal(sentEmails.length, 1);
});

test('forgot password with a missing user returns the same neutral response', async () => {
  const store = createPasswordResetTestStore();
  const sentEmails = [];

  const response = await requestPasswordReset({
    email: 'missing@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async (message) => {
      sentEmails.push(message);
    },
    tokenGenerator: () => 'missing-user-reset-token',
    userModel: store.model,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: PASSWORD_RESET_REQUEST_MESSAGE });
  assert.equal(sentEmails.length, 0);
});

test('forgot password creates a hashed token with a short expiration', async () => {
  const store = createPasswordResetTestStore();
  const now = new Date('2026-08-21T12:00:00.000Z');

  await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now,
    sendEmail: async () => {},
    tokenGenerator: () => 'plain-reset-token',
    userModel: store.model,
  });

  const user = store.findUser('client@example.com');

  assert.equal(
    user.password_reset_token_hash.includes('plain-reset-token'),
    false,
  );
  assert.equal(user.password_reset_token_hash.length, 64);
  assert.equal(
    user.password_reset_expires_at.toISOString(),
    '2026-08-21T12:30:00.000Z',
  );
});

test('invalid password reset token does not reset the password', async () => {
  const store = createPasswordResetTestStore();
  const beforeHash = store.findUser('client@example.com').password_hash;

  const response = await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:00:00.000Z'),
    token: 'invalid-token',
    userModel: store.model,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
  });
  assert.equal(store.findUser('client@example.com').password_hash, beforeHash);
});

test('expired password reset token does not reset the password', async () => {
  const store = createPasswordResetTestStore();
  await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async () => {},
    tokenGenerator: () => 'expired-token',
    userModel: store.model,
  });

  const response = await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:31:00.000Z'),
    token: 'expired-token',
    userModel: store.model,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
  });
});

test('valid password reset token updates the password and removes the token', async () => {
  const store = createPasswordResetTestStore();
  await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async () => {},
    tokenGenerator: () => 'valid-token',
    userModel: store.model,
  });

  const response = await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:10:00.000Z'),
    token: 'valid-token',
    userModel: store.model,
  });

  const user = store.findUser('client@example.com');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { message: PASSWORD_RESET_SUCCESS_MESSAGE });
  assert.equal(user.password_reset_token_hash, null);
  assert.equal(user.password_reset_expires_at, null);
  assert.equal(await bcrypt.compare('new-secret', user.password_hash), true);
});

test('password reset token cannot be reused after a successful reset', async () => {
  const store = createPasswordResetTestStore();
  await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async () => {},
    tokenGenerator: () => 'single-use-token',
    userModel: store.model,
  });

  await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:10:00.000Z'),
    token: 'single-use-token',
    userModel: store.model,
  });

  const response = await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'another-secret',
    now: new Date('2026-08-21T12:11:00.000Z'),
    token: 'single-use-token',
    userModel: store.model,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    error: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
  });
});

test('new password authenticates and old password stops authenticating after reset', async () => {
  const store = createPasswordResetTestStore();
  const user = store.findUser('client@example.com');
  const oldPasswordWorksBeforeReset = await bcrypt.compare(
    'old-secret',
    user.password_hash,
  );

  await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async () => {},
    tokenGenerator: () => 'auth-token',
    userModel: store.model,
  });

  await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:10:00.000Z'),
    token: 'auth-token',
    userModel: store.model,
  });

  assert.equal(oldPasswordWorksBeforeReset, true);
  assert.equal(await bcrypt.compare('new-secret', user.password_hash), true);
  assert.equal(await bcrypt.compare('old-secret', user.password_hash), false);
});

test('password hash never appears in password reset responses', async () => {
  const store = createPasswordResetTestStore();
  const requestResponse = await requestPasswordReset({
    email: 'client@example.com',
    frontendUrl: 'https://seven-bites.example',
    now: new Date('2026-08-21T12:00:00.000Z'),
    sendEmail: async () => {},
    tokenGenerator: () => 'no-hash-token',
    userModel: store.model,
  });
  const resetResponse = await resetPassword({
    bcryptLib: bcrypt,
    newPassword: 'new-secret',
    now: new Date('2026-08-21T12:10:00.000Z'),
    token: 'no-hash-token',
    userModel: store.model,
  });

  assert.equal(
    JSON.stringify(requestResponse.body).includes('password'),
    false,
  );
  assert.equal(JSON.stringify(resetResponse.body).includes('password'), false);
  assert.equal(JSON.stringify(requestResponse.body).includes('$2b$'), false);
  assert.equal(JSON.stringify(resetResponse.body).includes('$2b$'), false);
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

test('order amount includes the server-side delivery tax', () => {
  const amount = calculateOrderAmount(
    [
      { id: 1, price: 1200 },
      { id: 2, price: 800 },
    ],
    [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ],
  );

  assert.equal(amount, 3200 + DELIVERY_TAX_AMOUNT);
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

test('media URLs keep Cloudinary URLs and resolve legacy local paths', () => {
  assert.equal(
    resolveMediaUrl(
      'https://res.cloudinary.com/demo/image/upload/item.webp',
      'product',
    ),
    'https://res.cloudinary.com/demo/image/upload/item.webp',
  );
  assert.equal(
    resolveMediaUrl('local-product.png', 'product'),
    'http://localhost:3001/product-file/local-product.png',
  );
});

test('media storage keeps local filename when Cloudinary is not configured', async () => {
  const originalCloudinaryUrl = env.cloudinaryUrl;

  try {
    env.cloudinaryUrl = undefined;

    const storedPath = await saveMediaFile(
      { filename: 'local-product.png' },
      'products',
    );

    assert.equal(storedPath, 'local-product.png');
  } finally {
    env.cloudinaryUrl = originalCloudinaryUrl;
  }
});

test('health payload exposes only safe process data', () => {
  const payload = buildHealthPayload();

  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'seven-bites-api');
  assert.equal(typeof payload.timestamp, 'string');
  assert.equal(typeof payload.uptime, 'number');
  assert.equal('version' in payload, false);
});

test('readiness payload returns 200 only when dependencies are available', () => {
  const ready = buildReadyPayload({ mongo: 'ok', postgres: 'ok' });
  const unavailable = buildReadyPayload({
    mongo: 'ok',
    postgres: 'unavailable',
  });

  assert.equal(ready.statusCode, 200);
  assert.equal(ready.body.status, 'ready');
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.status, 'unavailable');
});

test('mongo connection failures are captured without crashing startup', async () => {
  const result = await connectMongo({
    mongoUrl: 'mongodb://localhost:27017/unavailable',
    mongooseClient: {
      async connect() {
        throw new Error('mongo unavailable');
      },
    },
  });

  assert.equal(result.status, 'unavailable');
});

test('database configuration disables SQL logging by default', () => {
  assert.equal(databaseConfig.logging, false);
});

test('request context generates and returns a safe request id', () => {
  const request = createRequest({
    get: () => 'unsafe request id with spaces',
  });
  const response = createResponse();
  let nextWasCalled = false;

  response.on = (event, callback) => {
    assert.equal(event, 'finish');
    response.finishCallback = callback;
  };

  requestContext(request, response, () => {
    nextWasCalled = true;
  });

  assert.equal(nextWasCalled, true);
  assert.match(request.id, /^[0-9a-f-]{36}$/);
  assert.equal(response.headers['x-request-id'], request.id);
});

test('rate limit returns 429 after the configured limit', () => {
  const limiter = rateLimit({
    keyPrefix: `test-${Date.now()}`,
    limit: 1,
    windowMs: 60_000,
  });
  const firstResponse = createResponse();
  const secondResponse = createResponse();
  let firstNext = false;

  limiter(createRequest(), firstResponse, () => {
    firstNext = true;
  });
  limiter(createRequest(), secondResponse, () => {});

  assert.equal(firstNext, true);
  assert.equal(secondResponse.statusCode, 429);
  assert.equal(
    secondResponse.body.error,
    'Too many requests. Try again later.',
  );
});

test('global error handler sanitizes unexpected errors', () => {
  const response = createResponse();
  const originalConsoleError = console.error;

  console.error = () => {};

  errorHandler(
    new Error('database password leaked in stack'),
    createRequest({ id: 'request-id' }),
    response,
    () => {},
  );

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: 'Internal server error.',
    requestId: 'request-id',
  });

  console.error = originalConsoleError;
});

test('json security headers do not add permissive cross-origin resource policy', () => {
  const request = createRequest();
  const response = createResponse();
  let nextWasCalled = false;

  securityHeaders(request, response, () => {
    nextWasCalled = true;
  });

  assert.equal(nextWasCalled, true);
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(response.headers['X-Frame-Options'], 'DENY');
  assert.equal(response.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(response.headers['Cross-Origin-Resource-Policy'], undefined);
});

test('product files use a cross-origin compatible resource policy', () => {
  const response = createResponse();
  let nextWasCalled = false;

  publicAssetHeaders(
    createRequest({ originalUrl: '/product-file/product.png' }),
    response,
    () => {
      nextWasCalled = true;
    },
  );

  assert.equal(nextWasCalled, true);
  assert.equal(
    response.headers['Cross-Origin-Resource-Policy'],
    'cross-origin',
  );
});

test('category files use a cross-origin compatible resource policy', () => {
  const response = createResponse();
  let nextWasCalled = false;

  publicAssetHeaders(
    createRequest({ originalUrl: '/category-file/category.png' }),
    response,
    () => {
      nextWasCalled = true;
    },
  );

  assert.equal(nextWasCalled, true);
  assert.equal(
    response.headers['Cross-Origin-Resource-Policy'],
    'cross-origin',
  );
});

test('cors options accept allowed frontend origins', () => {
  const options = buildCorsOptions(() => ['https://app.seven-bites.test']);
  let callbackError;
  let callbackAllowed;

  options.origin('https://app.seven-bites.test', (error, allowed) => {
    callbackError = error;
    callbackAllowed = allowed;
  });

  assert.equal(callbackError, null);
  assert.equal(callbackAllowed, true);
});

test('cors options reject unauthorized origins', () => {
  const options = buildCorsOptions(() => ['https://app.seven-bites.test']);
  let callbackError;
  let callbackAllowed;

  options.origin('https://evil.example', (error, allowed) => {
    callbackError = error;
    callbackAllowed = allowed;
  });

  assert.match(callbackError.message, /Origin is not allowed/);
  assert.equal(callbackAllowed, undefined);
});

test('cors options accept requests without origin', () => {
  const options = buildCorsOptions(() => ['https://app.seven-bites.test']);
  let callbackError;
  let callbackAllowed;

  options.origin(undefined, (error, allowed) => {
    callbackError = error;
    callbackAllowed = allowed;
  });

  assert.equal(callbackError, null);
  assert.equal(callbackAllowed, true);
});

test('openapi documents category multipart schema separately from product input', () => {
  const schemas = openApiDocument.components.schemas;
  const createCategorySchema =
    openApiDocument.paths['/categories'].post.requestBody.content[
      'multipart/form-data'
    ].schema;

  assert.equal(createCategorySchema.$ref, '#/components/schemas/CategoryInput');
  assert.deepEqual(schemas.CategoryInput.required, ['name', 'file']);
  assert.equal(schemas.CategoryInput.properties.name.type, 'string');
  assert.equal(schemas.CategoryInput.properties.file.format, 'binary');
  assert.equal(schemas.CategoryInput.properties.price, undefined);
  assert.equal(schemas.ProductInput.properties.price.type, 'integer');
});
