const { CONTEST_PAYOUT_TABLE_NAME, ContestPayoutSchema  } = require('../../../../dist/db/postgres/schema/contest');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create the Votes table
        await queryInterface.createTable(CONTEST_PAYOUT_TABLE_NAME, ContestPayoutSchema);
    },
    
    async down(queryInterface, Sequelize) {
    // Drop the Votes table
    await queryInterface.dropTable(CONTEST_PAYOUT_TABLE_NAME);
    }
}
