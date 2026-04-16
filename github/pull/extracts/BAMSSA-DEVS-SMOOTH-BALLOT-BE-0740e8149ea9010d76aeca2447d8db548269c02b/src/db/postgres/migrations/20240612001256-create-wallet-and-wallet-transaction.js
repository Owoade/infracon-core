'use strict';

const { WalletSchema, WalletTransactionSchema, WALLET_TABLE_NAME, WALLET_TRANSACTION_TABLE_NAME } = require("../../../../dist/db/postgres/schema/wallet");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create the Wallets table
    await queryInterface.createTable(WALLET_TABLE_NAME, WalletSchema);
    
    // Create the WalletTransactions table
    await queryInterface.createTable(WALLET_TRANSACTION_TABLE_NAME, WalletTransactionSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop the WalletTransactions table
    await queryInterface.dropTable(WALLET_TRANSACTION_TABLE_NAME);

    // Drop the Wallets table
    await queryInterface.dropTable(WALLET_TABLE_NAME);
  }
};
