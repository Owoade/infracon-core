'use strict';

const { AccreditationFormSchema, AccreditationFormQuestionSchema, ACCREDITATION_FORM_TABLE_NAME, ACCREDITATION_FORM_QUESTIONS } = require("../../../../dist/db/postgres/schema/accreditation-form");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create AccreditationForms table
    await queryInterface.createTable(ACCREDITATION_FORM_TABLE_NAME, AccreditationFormSchema);

    // Create AccreditationFormQuestions table
    await queryInterface.createTable(ACCREDITATION_FORM_QUESTIONS, AccreditationFormQuestionSchema);
  },

  async down(queryInterface, Sequelize) {
    // Drop AccreditationFormQuestions table
    await queryInterface.dropTable(ACCREDITATION_FORM_QUESTIONS);
    // Drop AccreditationForms table
    await queryInterface.dropTable(ACCREDITATION_FORM_TABLE_NAME);
  }
};
