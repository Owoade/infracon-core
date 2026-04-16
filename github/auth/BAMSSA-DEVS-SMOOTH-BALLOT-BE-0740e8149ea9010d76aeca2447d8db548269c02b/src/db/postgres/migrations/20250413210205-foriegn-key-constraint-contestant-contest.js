'use strict';
const { CONTEST_TABLE_NAME, CONTESTANT_TABLE_NAME } = require('../../../../dist/db/postgres/schema/contest');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addConstraint(
      CONTESTANT_TABLE_NAME,
      {
        fields: ['ContestId'],
        type: 'foreign key',
        name: 'fk_contest_contestant',
         references: {
            table: CONTEST_TABLE_NAME,
            field: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      }
    )
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeConstraint(CONTESTANT_TABLE_NAME, 'fk_contest_contestant');
  }
};
