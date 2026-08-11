import Sequelize, { Model } from 'sequelize';
import { resolveMediaUrl } from '../services/mediaStorage.js';

class Category extends Model {
  static init(sequelize) {
    super.init(
      {
        name: Sequelize.STRING,
        path: Sequelize.STRING,
        url: {
          type: Sequelize.VIRTUAL,
          get() {
            return resolveMediaUrl(this.path, 'category');
          },
        },
      },
      {
        sequelize,
        tableName: 'categories',
      },
    );

    return this;
  }
}

export default Category;
