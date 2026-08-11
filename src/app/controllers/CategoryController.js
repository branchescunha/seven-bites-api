import * as Yup from 'yup';
import Category from '../models/Category.js';
import { saveMediaFile } from '../services/mediaStorage.js';

class CategoryController {
  async store(request, response) {
    const schema = Yup.object({
      name: Yup.string().required(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { name } = request.body;

    if (!request.file) {
      return response
        .status(400)
        .json({ error: 'Category image is required.' });
    }

    const existingCategory = await Category.findOne({
      where: { name },
    });

    if (existingCategory) {
      return response.status(400).json({ error: 'Category already exists!' });
    }

    const path = await saveMediaFile(request.file, 'categories');

    const newCategory = await Category.create({
      name,
      path,
    });

    return response.status(201).json(newCategory);
  }

  async update(request, response) {
    const schema = Yup.object({
      name: Yup.string(),
    });

    try {
      schema.validateSync(request.body, { abortEarly: false });
    } catch (err) {
      return response.status(400).json({ error: err.errors });
    }

    const { name } = request.body;
    const { id } = request.params;

    let path;
    if (request.file) {
      path = await saveMediaFile(request.file, 'categories');
    }

    const existingCategory = await Category.findOne({
      where: { name },
    });

    if (existingCategory) {
      return response.status(400).json({ error: 'Category already exists!' });
    }

    await Category.update(
      {
        name,
        path,
      },
      {
        where: {
          id,
        },
      },
    );

    return response.status(201).json();
  }

  async index(_request, response) {
    const categories = await Category.findAll();

    return response.status(200).json(categories);
  }
}

export default new CategoryController();
