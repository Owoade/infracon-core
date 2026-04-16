'use strict';

const { VotersSchema, VOTERS_TABLE_NAME } = require("../../../../dist/db/postgres/schema/voter");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Voters table
    await queryInterface.createTable(VOTERS_TABLE_NAME, VotersSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the Voters table
    await queryInterface.dropTable(VOTERS_TABLE_NAME);
  }
  
};
