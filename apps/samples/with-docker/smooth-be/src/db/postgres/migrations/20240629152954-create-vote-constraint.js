'use strict';

const { VOTE_TABLE_NAME } = require("../../../../dist/db/postgres/schema/vote");
const { VOTE_PROFILE_TABLE_NAME } = require("../../../../dist/db/postgres/schema/vote-profile");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for VoteProfileId in Votes table
    await queryInterface.addConstraint(VOTE_TABLE_NAME, {
      fields: ['VoteProfileId'],
      type: 'foreign key',
      name: 'fk_votes_vote_profile_id',
      references: {
        table: VOTE_PROFILE_TABLE_NAME,
        field: 'id'
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraint for VoteProfileId in Votes table
    await queryInterface.removeConstraint(VOTE_TABLE_NAME, 'fk_votes_vote_profile_id');
  }
};
