'use strict';

const { ACCREDITATION_FORM_TABLE_NAME, ACCREDITATION_FORM_QUESTIONS } = require("../../../../dist/db/postgres/schema/accreditation-form");
const { USER_TABLE_NAME } = require("../../../../dist/db/postgres/schema/user");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for UserId in AccreditationForms table
    await queryInterface.addConstraint(ACCREDITATION_FORM_TABLE_NAME, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_accreditation_forms_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for UserId in AccreditationFormQuestions table
    await queryInterface.addConstraint(ACCREDITATION_FORM_QUESTIONS, {
      fields: ['UserId'],
      type: 'foreign key',
      name: 'fk_accreditation_form_questions_user_id',
      references: {
        table: USER_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // Add foreign key constraint for AccreditationFormId in AccreditationFormQuestions table
    await queryInterface.addConstraint(ACCREDITATION_FORM_QUESTIONS, {
      fields: ['AccreditationFormId'],
      type: 'foreign key',
      name: 'fk_accreditation_form_questions_accreditation_form_id',
      references: {
        table: ACCREDITATION_FORM_TABLE_NAME,
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints
    await queryInterface.removeConstraint(ACCREDITATION_FORM_TABLE_NAME, 'fk_accreditation_forms_user_id');
    await queryInterface.removeConstraint(ACCREDITATION_FORM_QUESTIONS, 'fk_accreditation_form_questions_user_id');
    await queryInterface.removeConstraint(ACCREDITATION_FORM_QUESTIONS, 'fk_accreditation_form_questions_accreditation_form_id');
  }
};
