export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Seven Bites API',
    version: '1.0.0',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          requestId: { type: 'string' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['name', 'price', 'category_id', 'file'],
        properties: {
          name: { type: 'string' },
          price: { type: 'integer', example: 3190 },
          category_id: { type: 'integer' },
          offer: { type: 'boolean' },
          file: { type: 'string', format: 'binary' },
        },
      },
      CategoryInput: {
        type: 'object',
        required: ['name', 'file'],
        properties: {
          name: { type: 'string' },
          file: {
            type: 'string',
            description: 'Category image file.',
            format: 'binary',
          },
        },
      },
      CartItem: {
        type: 'object',
        properties: {
          productId: { type: 'integer' },
          quantity: { type: 'integer', minimum: 1, maximum: 99 },
        },
      },
      Message: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Process health check',
        responses: { 200: { description: 'Service is healthy' } },
      },
    },
    '/ready': {
      get: {
        summary: 'Dependency readiness check',
        responses: {
          200: { description: 'Dependencies are available' },
          503: { description: 'A dependency is unavailable' },
        },
      },
    },
    '/users': {
      post: {
        summary: 'Create a public user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Invalid data' },
        },
      },
    },
    '/sessions': {
      post: {
        summary: 'Authenticate a user',
        responses: {
          200: { description: 'Authenticated' },
          400: { description: 'Invalid credentials' },
        },
      },
    },
    '/password/forgot': {
      post: {
        summary: 'Request a password reset link',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Neutral reset instructions response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Message' },
              },
            },
          },
          429: { description: 'Too many requests' },
        },
      },
    },
    '/password/reset': {
      post: {
        summary: 'Reset password with a single-use token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  newPassword: { type: 'string', format: 'password' },
                  token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Password reset',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Message' },
              },
            },
          },
          400: { description: 'Invalid or expired token' },
          429: { description: 'Too many requests' },
        },
      },
    },
    '/products': {
      get: {
        summary: 'List products',
        responses: { 200: { description: 'Products' } },
      },
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Create product',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: { $ref: '#/components/schemas/ProductInput' },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Invalid data or missing image' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/products/{id}': {
      put: {
        security: [{ bearerAuth: [] }],
        summary: 'Update product',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Updated' },
          400: { description: 'Invalid data' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' },
        },
      },
    },
    '/categories': {
      get: {
        summary: 'List categories',
        responses: { 200: { description: 'Categories' } },
      },
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Create category',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: { $ref: '#/components/schemas/CategoryInput' },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/categories/{id}': {
      put: {
        security: [{ bearerAuth: [] }],
        summary: 'Update category',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: { description: 'Updated' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found' },
        },
      },
    },
    '/create-payment-intent': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Create Stripe Payment Intent from server-side prices',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CartItem' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Payment Intent created' },
          400: { description: 'Invalid cart' },
          503: { description: 'Stripe unavailable' },
        },
      },
    },
    '/orders': {
      post: {
        security: [{ bearerAuth: [] }],
        summary: 'Create order after a succeeded Payment Intent',
        responses: {
          201: { description: 'Created' },
          409: { description: 'Duplicate or unpaid payment' },
        },
      },
      get: {
        security: [{ bearerAuth: [] }],
        summary: 'List orders for admin',
        responses: {
          200: { description: 'Orders' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/orders/{id}': {
      put: {
        security: [{ bearerAuth: [] }],
        summary: 'Update order status',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Updated' },
          403: { description: 'Forbidden' },
        },
      },
    },
  },
};
