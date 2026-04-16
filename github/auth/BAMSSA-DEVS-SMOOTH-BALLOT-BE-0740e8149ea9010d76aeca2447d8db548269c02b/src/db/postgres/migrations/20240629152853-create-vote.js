const { VOTE_TABLE_NAME, VoteSchema } = require("../../../../dist/db/postgres/schema/vote");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Votes table
    await queryInterface.createTable(VOTE_TABLE_NAME, VoteSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the Votes table
    await queryInterface.dropTable(VOTE_TABLE_NAME);
  }
};