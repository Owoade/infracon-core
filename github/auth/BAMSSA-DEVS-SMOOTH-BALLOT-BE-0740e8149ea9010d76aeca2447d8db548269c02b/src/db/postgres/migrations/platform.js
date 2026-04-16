const { PLATFORM_TABLE_NAME, PlatformSchema } = require("../../../../dist/db/postgres/schema/platform");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Votes table
    await queryInterface.createTable(PLATFORM_TABLE_NAME, PlatformSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the Votes table
    await queryInterface.dropTable(PLATFORM_TABLE_NAME);
  }
};