'use strict';

const { BILLING_TABLE_NAME } = require("../../../../dist/db/postgres/schema/billing");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for UserId in Billings table
    await queryInterface.addConstraint(BILLING_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_billings_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints
    await queryInterface.removeConstraint(BILLING_TABLE_NAME, 'fk_billings_user_id');
    
  }
};
