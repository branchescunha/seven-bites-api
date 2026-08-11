import * as Yup from 'yup';
import Category from './../models/Category.js';
import Product from './../models/Product.js';
import { saveMediaFile } from './../services/mediaStorage.js';

class ProductController {
  async store(request, response) {
    const schema = Yup.object({
      name: Yup.string().required(),
      price: Yup.number().required(),
      category_id: Yup.number().required(),
      offer: Yup.boolean(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { name, price, category_id, offer } = request.body;

    if (!request.file) {
      return response.status(400).json({ error: 'Product image is required.' });
    }

    const path = await saveMediaFile(request.file, 'products');

    const newProduct = await Product.create({
      name,
      price,
      category_id,
      path,
      offer,
    });

    return response.status(201).json(newProduct);
  }

  async update(request, response) {
    const schema = Yup.object({
      name: Yup.string(),
      price: Yup.number(),
      category_id: Yup.number(),
      offer: Yup.boolean(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { name, price, category_id, offer } = request.body;
    const { id } = request.params;

    let path;
    if (request.file) {
      path = await saveMediaFile(request.file, 'products');
    }

    await Product.update(
      {
        name,
        price,
        category_id,
        path,
        offer,
      },
      {
        where: {
          id,
        },
      },
    );

    return response.status(200).json();
  }

  async index(_request, response) {
    const products = await Product.findAll({
      include: {
        model: Category,
        as: 'category',
        attributes: ['id', 'name'],
      },
    });

    return response.status(200).json(products);
  }
}

export default new ProductController();
