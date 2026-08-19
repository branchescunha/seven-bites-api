export class CartValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const MAX_ITEM_QUANTITY = 99;
export const DELIVERY_TAX_AMOUNT = 500;

const toPositiveInteger = (value) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new CartValidationError(
      'Each product must include a positive integer quantity.',
    );
  }

  if (value > MAX_ITEM_QUANTITY) {
    throw new CartValidationError(
      `Each product quantity cannot exceed ${MAX_ITEM_QUANTITY}.`,
    );
  }

  return value;
};

const getProductId = (item) => {
  const productId = item.productId ?? item.id;

  if (
    typeof productId !== 'number' ||
    !Number.isInteger(productId) ||
    productId < 1
  ) {
    throw new CartValidationError(
      'Each product must include a valid productId.',
    );
  }

  return productId;
};

export const normalizeCartProducts = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CartValidationError('At least one product is required.');
  }

  const productsById = new Map();

  for (const item of items) {
    const productId = getProductId(item);
    const quantity = toPositiveInteger(item.quantity);
    const previousQuantity = productsById.get(productId) ?? 0;
    const nextQuantity = previousQuantity + quantity;

    if (nextQuantity > MAX_ITEM_QUANTITY) {
      throw new CartValidationError(
        `Each product quantity cannot exceed ${MAX_ITEM_QUANTITY}.`,
      );
    }

    productsById.set(productId, nextQuantity);
  }

  return Array.from(productsById, ([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

export const calculateProductsAmount = (dbProducts, cartProducts) => {
  const quantitiesById = new Map(
    cartProducts.map((product) => [product.productId, product.quantity]),
  );

  return dbProducts.reduce((amount, product) => {
    return amount + product.price * quantitiesById.get(product.id);
  }, 0);
};

export const calculateOrderAmount = (dbProducts, cartProducts) =>
  calculateProductsAmount(dbProducts, cartProducts) + DELIVERY_TAX_AMOUNT;

export const assertAllProductsWereFound = (dbProducts, cartProducts) => {
  if (dbProducts.length !== cartProducts.length) {
    throw new CartValidationError('One or more products are unavailable.', 404);
  }
};
