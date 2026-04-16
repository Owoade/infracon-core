import db from "@db/postgres/index";
import { ACCREDITATION_FORM_QUESTIONS, ACCREDITATION_FORM_TABLE_NAME, AccreditationFormQuestionSchema, AccreditationFormSchema } from "@db/postgres/schema/accreditation-form";

export const AccreditationFormModel = db.define( ACCREDITATION_FORM_TABLE_NAME, AccreditationFormSchema, { timestamps: true } );

export const AccreditationFormQuestionModel = db.define( ACCREDITATION_FORM_QUESTIONS, AccreditationFormQuestionSchema, { timestamps: true } );

AccreditationFormModel.hasMany(AccreditationFormQuestionModel);

AccreditationFormQuestionModel.belongsTo(AccreditationFormModel);

export const ACCREDITATION_FORM_MODEL_PROVIDER = "ACCREDITATION_FORM_MODEL";

export const ACCREDITATION_FORM_QUESTION_MODEL_PROVIDER = "ACCREDITATION_FORM_QUESTION_MODEL";

export const AccreditationFormModelProvider = {
    provide: ACCREDITATION_FORM_MODEL_PROVIDER,
    useValue: AccreditationFormModel
}

export const AccreditationFormQuestionProvider = {
    provide: ACCREDITATION_FORM_QUESTION_MODEL_PROVIDER,
    useValue: AccreditationFormQuestionModel
}