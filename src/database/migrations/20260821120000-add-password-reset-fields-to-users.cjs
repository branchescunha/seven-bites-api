'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'password_reset_token_hash', {
      allowNull: true,
      type: Sequelize.STRING,
    });

    await queryInterface.addColumn('users', 'password_reset_expires_at', {
      allowNull: true,
      type: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'password_reset_expires_at');
    await queryInterface.removeColumn('users', 'password_reset_token_hash');
  },
};
