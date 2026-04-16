'use strict';
const { CONTEST_ORGANIZER_PROFILE_TABLE_NAME, ContestOrganizerProfileSchema } = require('../../../../dist/db/postgres/schema/contest-organizer-profile');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable(CONTEST_ORGANIZER_PROFILE_TABLE_NAME, ContestOrganizerProfileSchema)
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable(CONTEST_ORGANIZER_PROFILE_TABLE_NAME)
  }
};
