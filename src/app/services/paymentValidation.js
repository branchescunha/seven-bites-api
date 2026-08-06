export class PaymentValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const assertPaymentIntentCanCreateOrder = ({
  amount,
  paymentIntent,
  userId,
}) => {
  if (!paymentIntent) {
    throw new PaymentValidationError('Payment intent was not found.', 404);
  }

  if (paymentIntent.status !== 'succeeded') {
    throw new PaymentValidationError('Payment was not completed.', 409);
  }

  if (paymentIntent.currency !== 'brl') {
    throw new PaymentValidationError('Payment currency is invalid.');
  }

  if (!paymentIntent.metadata?.userId) {
    throw new PaymentValidationError(
      'Payment is not linked to this user.',
      422,
    );
  }

  if (paymentIntent.metadata.userId !== userId) {
    throw new PaymentValidationError(
      'Payment does not belong to this user.',
      403,
    );
  }

  const paidAmount = paymentIntent.amount_received ?? paymentIntent.amount;

  if (paidAmount !== amount) {
    throw new PaymentValidationError('Payment amount does not match order.');
  }
};
