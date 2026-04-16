'use strict';

/** @type {import('sequelize-cli').Migration} */
const {ELECTION_TABLE_NAME, ElectionSchema} = require("../../../../dist/db/postgres/schema/election")

module.exports = {
  async up (queryInterface, Sequelize) {
    queryInterface.createTable(ELECTION_TABLE_NAME, ElectionSchema);
  },

  async down (queryInterface, Sequelize) {
    queryInterface.dropTable(ELECTION_TABLE_NAME)
  }
};
