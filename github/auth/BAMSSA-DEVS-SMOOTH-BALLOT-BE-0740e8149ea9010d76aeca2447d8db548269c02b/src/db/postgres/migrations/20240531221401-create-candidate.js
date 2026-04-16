'use strict';
const { CANDIDATE_TABLE_NAME, CandidateSchema } = require("../../../../dist/db/postgres/schema/candidate");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(CANDIDATE_TABLE_NAME, CandidateSchema);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable(CANDIDATE_TABLE_NAME);
  }
};