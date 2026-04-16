'use strict';
const { CONTEST_TABLE_NAME, ContestSchema } = require('../../../../dist/db/postgres/schema/contest');
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable(CONTEST_TABLE_NAME, ContestSchema);
    await queryInterface.addConstraint(CONTEST_TABLE_NAME, {
          fields: ['UserId'],
          type: 'foreign key',
          name: 'fk_user_contests', // Optional: provide a name for the constraint
          references: {
            table: USER_TABLE_NAME,
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
      });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable(CONTEST_TABLE_NAME)
    await queryInterface.removeConstraint(CONTEST_TABLE_NAME, 'fk_user_contests')
  }
};
