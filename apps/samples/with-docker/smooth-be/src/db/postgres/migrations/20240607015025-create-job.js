'use strict';

const { JobSchema, JOB_TABLE_NAME } = require("../../../../dist/db/postgres/schema/job");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Voters table
    await queryInterface.createTable(JOB_TABLE_NAME, JobSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the Voters table
    await queryInterface.dropTable(JOB_TABLE_NAME);
  }
  
};