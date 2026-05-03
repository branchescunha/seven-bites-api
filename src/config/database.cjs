module.exports = {
  dialect: "postgres",
  host: "localhost",
  port: 5432,
  username: "admin",
  password: "12345",
  database: "seven-bites-db",
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
};
