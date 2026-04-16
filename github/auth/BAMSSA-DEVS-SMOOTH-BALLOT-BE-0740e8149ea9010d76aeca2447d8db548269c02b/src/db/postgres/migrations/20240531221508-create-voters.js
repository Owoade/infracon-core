'use strict';
const { VOTERS_TABLE_NAME, VotersSchema } = require("../../../../dist/db/postgres/schema/voter");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(VOTERS_TABLE_NAME, VotersSchema);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable(VOTERS_TABLE_NAME);
  }
};
