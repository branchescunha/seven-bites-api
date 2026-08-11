require('dotenv').config();

const define = {
  timestamps: true,
  underscored: true,
  underscoredAll: true,
};

const shouldUseSsl =
  process.env.PG_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL));

const dialectOptions = shouldUseSsl
  ? {
      ssl: {
        require: true,
      },
    }
  : undefined;

if (process.env.DATABASE_URL) {
  module.exports = {
    dialect: 'postgres',
    dialectOptions,
    define,
    use_env_variable: 'DATABASE_URL',
  };
} else {
  module.exports = {
    dialect: 'postgres',
    database: process.env.PG_DATABASE,
    define,
    dialectOptions,
    host: process.env.PG_HOST,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    username: process.env.PG_USERNAME,
  };
}
