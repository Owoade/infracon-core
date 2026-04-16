'use strict';

/** @type {import('sequelize-cli').Migration} */
const {ELECTION_TABLE_NAME} = require("../../../../dist/db/postgres/schema/election")
const {DataTypes} = require('sequelize');
const COLUMN_NAME = "result_is_visible";
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    queryInterface.addColumn(ELECTION_TABLE_NAME, COLUMN_NAME, {
      type: DataTypes.BOOLEAN,
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
    queryInterface.removeColumn(ELECTION_TABLE_NAME, COLUMN_NAME)
    
  }
};
