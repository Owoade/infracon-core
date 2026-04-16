'use strict';

const { VOTERS_TABLE_NAME } = require("../../../../dist/db/postgres/schema/voter");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");
const { ELECTION_TABLE_NAME } = require("../../../../dist/db/postgres/schema/election");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for UserId in Voters table
    await queryInterface.addConstraint(VOTERS_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_voters_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for ElectionId in Voters table
    await queryInterface.addConstraint(VOTERS_TABLE_NAME, {
      fields: ['ElectionId'],
      type: 'foreign key',
      name: 'fk_voters_election_id',
      references: {
        table: ELECTION_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints
    await queryInterface.removeConstraint(VOTERS_TABLE_NAME, 'fk_voters_user_id');
    await queryInterface.removeConstraint(VOTERS_TABLE_NAME, 'fk_voters_election_id');
  }
};
