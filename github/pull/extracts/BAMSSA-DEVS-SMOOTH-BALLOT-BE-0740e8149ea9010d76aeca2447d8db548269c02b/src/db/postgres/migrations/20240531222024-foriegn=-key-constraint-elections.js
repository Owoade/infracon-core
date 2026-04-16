'use strict';

/** @type {import('sequelize-cli').Migration} */
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");
const { ELECTION_TABLE_NAME} = require("../../../../dist/db/postgres/schema/election");
module.exports = {
  async up (queryInterface, Sequelize) {

    await queryInterface.addConstraint(ELECTION_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_user_elections', // Optional: provide a name for the constraint
      references: {
        table: USER_TABLE_NAME,
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });


  },

  async down (queryInterface, Sequelize) {
   await queryInterface.removeConstraint(ELECTION_TABLE_NAME, 'fk_user_elections');
  }
};
