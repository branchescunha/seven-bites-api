import Stripe from 'stripe';
import { env } from './env.js';

export const getStripeClient = () => {
  if (!env.stripeSecretKey) {
    return null;
  }

  return new Stripe(env.stripeSecretKey);
};
