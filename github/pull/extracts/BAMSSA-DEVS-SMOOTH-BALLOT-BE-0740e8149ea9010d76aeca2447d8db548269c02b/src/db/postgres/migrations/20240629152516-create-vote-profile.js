'use strict';

const { VOTE_PROFILE_TABLE_NAME, VoteProfileSchema } = require("../../../../dist/db/postgres/schema/vote-profile");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the VoteProfiles table
    await queryInterface.createTable(VOTE_PROFILE_TABLE_NAME, VoteProfileSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the VoteProfiles table
    await queryInterface.dropTable(VOTE_PROFILE_TABLE_NAME);
  }
};
