'use strict';
const { ContestFinancialRecordSchema, CONTEST_FINANCIAL_RECORD_TABLE_NAME } = require('../../../../dist/db/postgres/schema/contest-financial-record');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable(CONTEST_FINANCIAL_RECORD_TABLE_NAME, ContestFinancialRecordSchema)
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable(CONTEST_FINANCIAL_RECORD_TABLE_NAME)
  }
};
