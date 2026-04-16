'use strict';

const { BillingSchema, BILLING_TABLE_NAME } = require("../../../../dist/db/postgres/schema/billing");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Billings table
    await queryInterface.createTable(BILLING_TABLE_NAME, BillingSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the Billings table
    await queryInterface.dropTable(BILLING_TABLE_NAME);
  }
};
