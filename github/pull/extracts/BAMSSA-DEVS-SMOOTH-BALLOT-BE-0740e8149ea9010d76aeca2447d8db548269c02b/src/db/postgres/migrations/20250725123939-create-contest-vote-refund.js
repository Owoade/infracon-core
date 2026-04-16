'use strict';
const { CONTEST_VOTE_REFUND_TABLE_NAME, ContestVoteRefundSchema  } = require('../../../../dist/db/postgres/schema/contest');
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable(CONTEST_VOTE_REFUND_TABLE_NAME, ContestVoteRefundSchema);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable(CONTEST_VOTE_REFUND_TABLE_NAME)
  }
};
