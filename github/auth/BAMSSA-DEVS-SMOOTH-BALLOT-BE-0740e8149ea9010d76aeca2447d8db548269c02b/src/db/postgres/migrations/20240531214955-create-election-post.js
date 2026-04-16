'use strict';

const {ELECTION_POST_TABLE_NAME, ElectionPostSchema} = require("../../../../dist/db/postgres/schema/election-post"); 
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");
/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up (queryInterface, Sequelize) {
    queryInterface.createTable(ELECTION_POST_TABLE_NAME, ElectionPostSchema)
  },

  async down (queryInterface, Sequelize) {
    queryInterface.dropTable(ELECTION_POST_TABLE_NAME)
  }
};

