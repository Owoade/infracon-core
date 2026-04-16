'use strict';

const { CANDIDATE_TABLE_NAME } = require("../../../../dist/db/postgres/schema/candidate");
const { ELECTION_POST_TABLE_NAME } = require("../../../../dist/db/postgres/schema/election-post");
const { ELECTION_TABLE_NAME } = require("../../../../dist/db/postgres/schema/election");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for ElectionPostId in Candidates table
    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['ElectionPostId'],
      type: 'foreign key',
      name: 'fk_candidates_election_post_id',
      references: {
        table: ELECTION_POST_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for ElectionId in Candidates table
    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['ElectionId'],
      type: 'foreign key',
      name: 'fk_candidates_election_id',
      references: {
        table: ELECTION_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for UserId in Candidates table
    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_candidates_user_id',
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
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidates_election_post_id');
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidates_election_id');
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidates_user_id');
  }
};
