import Sequelize, { Model } from "sequelize";

class Product extends Model {
  static init(sequelize) {
    Model.init(
      {
        name: Sequelize.STRING,
        price: Sequelize.INTEGER,
        category: Sequelize.STRING,
        path: Sequelize.STRING,
        url: {
          type: Sequelize.VIRTUAL,
          get() {
            return `http://localhost:3001/product-file/${this.path}`;
          },
        },
      },
      {
        sequelize,
        tableName: "products",
      },
    );
  }
}

export default Product;
