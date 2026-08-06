import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';
import Category from '../app/models/Category.js';
import Product from '../app/models/Product.js';
import User from '../app/models/User.js';
import databaseConfig from '../config/database.cjs';
import { env } from '../config/env.js';

const models = [User, Product, Category];

class Database {
  constructor() {
    this.init();
    this.mongo();
  }

  init() {
    this.connection = new Sequelize(databaseConfig);
    models
      .map((model) => model.init(this.connection))
      .map(
        (model) => model.associate && model.associate(this.connection.models),
      );
  }

  mongo() {
    this.mongooseConnection = mongoose.connect(env.mongoUrl);
  }

  async checkConnections() {
    const checks = {
      mongo: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable',
      postgres: 'unavailable',
    };

    try {
      await this.connection.authenticate();
      checks.postgres = 'ok';
    } catch (_error) {
      checks.postgres = 'unavailable';
    }

    return checks;
  }
}

export default new Database();
