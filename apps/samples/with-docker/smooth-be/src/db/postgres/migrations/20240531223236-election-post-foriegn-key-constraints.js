'use strict';
const { ELECTION_POST_TABLE_NAME } = require("../../../../dist/db/postgres/schema/election-post");
const { ELECTION_TABLE_NAME } = require("../../../../dist/db/postgres/schema/election");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
  // Add foreign key constraints
  await queryInterface.addConstraint(ELECTION_POST_TABLE_NAME, {
    fields: ['ElectionId'],
    type: 'foreign key',
    name: 'fk_election_posts_election_id',
    references: {
      table: ELECTION_TABLE_NAME,
      field: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });

  await queryInterface.addConstraint(ELECTION_POST_TABLE_NAME, {
    fields: ['UserId'],
    type: 'foreign key',
    name: 'fk_election_posts_user_id',
    references: {
      table: USER_TABLE_NAME,
      field: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
},

async down(queryInterface, Sequelize) {
  // Remove foreign key constraints
  await queryInterface.removeConstraint(ELECTION_POST_TABLE_NAME, 'fk_election_posts_election_id');
  await queryInterface.removeConstraint(ELECTION_POST_TABLE_NAME, 'fk_election_posts_user_id');

  // Drop the ElectionPosts table
  await queryInterface.dropTable(ELECTION_POST_TABLE_NAME);
}

};
