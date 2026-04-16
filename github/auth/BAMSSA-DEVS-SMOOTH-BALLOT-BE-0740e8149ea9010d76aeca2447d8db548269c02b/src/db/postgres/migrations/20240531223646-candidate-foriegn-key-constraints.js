'use strict';

const { CANDIDATE_TABLE_NAME } = require("../../../../dist/db/postgres/schema/candidate");
const { ELECTION_TABLE_NAME, ElectionSchema } = require("../../../../dist/db/postgres/schema/election");
const { ELECTION_POST_TABLE_NAME, ElectionPostSchema } = require("../../../../dist/db/postgres/schema/election-post");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['ElectionPostId'],
      type: 'foreign key',
      name: 'fk_candidate_election_post_id',
      references: {
        table: ELECTION_POST_TABLE_NAME,
        field: 'id'
      },
      // onDelete: 'CASCADE',
      // onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['ElectionId'],
      type: 'foreign key',
      name: 'fk_candidate_election_id',
      references: {
        table: ELECTION_TABLE_NAME,
        field: 'id'
      },
      // onDelete: 'CASCADE',
      // onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint(CANDIDATE_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_candidate_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      // onDelete: 'CASCADE',
      // onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidate_election_post_id');
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidate_election_id');
    await queryInterface.removeConstraint(CANDIDATE_TABLE_NAME, 'fk_candidate_user_id');
  }
};
