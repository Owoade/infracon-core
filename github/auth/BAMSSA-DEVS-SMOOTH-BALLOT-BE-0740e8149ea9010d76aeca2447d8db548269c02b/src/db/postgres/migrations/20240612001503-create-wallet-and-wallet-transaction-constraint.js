'use strict';

const { WALLET_TABLE_NAME, WALLET_TRANSACTION_TABLE_NAME } = require("../../../../dist/db/postgres/schema/wallet");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for UserId in Wallets table
    await queryInterface.addConstraint(WALLET_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_wallets_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for WalletId in WalletTransactions table
    await queryInterface.addConstraint(WALLET_TRANSACTION_TABLE_NAME, {
      fields: ['WalletId'],
      type: 'foreign key',
      name: 'fk_wallet_transactions_wallet_id',
      references: {
        table: WALLET_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for UserId in WalletTransactions table
    await queryInterface.addConstraint(WALLET_TRANSACTION_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_wallet_transactions_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints
    await queryInterface.removeConstraint(WALLET_TRANSACTION_TABLE_NAME, 'fk_wallet_transactions_wallet_id');
    await queryInterface.removeConstraint(WALLET_TRANSACTION_TABLE_NAME, 'fk_wallet_transactions_user_id');
    await queryInterface.removeConstraint(WALLET_TABLE_NAME, 'fk_wallets_user_id');
  }
};
