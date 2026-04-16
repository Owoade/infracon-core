'use strict';

/** @type {import('sequelize-cli').Migration} */
const {ELECTION_POST_TABLE_NAME} = require("../../../../dist/db/postgres/schema/election-post")
const {DataTypes} = require('sequelize');
const COLUMN_NAME = "maximum_vote_per_voter";
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    queryInterface.addColumn(ELECTION_POST_TABLE_NAME, COLUMN_NAME, {
          type: DataTypes.INTEGER,
          allowNull: true
    })
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    queryInterface.removeColumn(ELECTION_POST_TABLE_NAME, COLUMN_NAME)
  }
};
