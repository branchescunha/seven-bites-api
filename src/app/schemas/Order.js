import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    user: {
      id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
    },
    paymentIntentId: {
      type: String,
      required: false,
    },
    products: [
      {
        id: {
          type: Number,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        category: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: false,
    },
    currency: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

OrderSchema.index(
  { paymentIntentId: 1 },
  {
    partialFilterExpression: { paymentIntentId: { $type: 'string' } },
    unique: true,
  },
);

export default mongoose.model('Order', OrderSchema);
