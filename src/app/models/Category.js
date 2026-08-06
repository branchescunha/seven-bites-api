import Sequelize, { Model } from 'sequelize';
import { env } from '../../config/env.js';

class Category extends Model {
  static init(sequelize) {
    super.init(
      {
        name: Sequelize.STRING,
        path: Sequelize.STRING,
        url: {
          type: Sequelize.VIRTUAL,
          get() {
            return `${env.appUrl}/category-file/${this.path}`;
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
