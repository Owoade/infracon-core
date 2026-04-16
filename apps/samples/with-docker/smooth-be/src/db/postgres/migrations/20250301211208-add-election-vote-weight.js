'use strict';
const {VOTE_TABLE_NAME} = require("../../../../dist/db/postgres/schema/vote");
const {DataTypes} = require('sequelize');
const COLUMN_NAME = "weight";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    queryInterface.addColumn(VOTE_TABLE_NAME, COLUMN_NAME, {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    queryInterface.removeColumn(VOTE_TABLE_NAME, COLUMN_NAME)
  }
};
