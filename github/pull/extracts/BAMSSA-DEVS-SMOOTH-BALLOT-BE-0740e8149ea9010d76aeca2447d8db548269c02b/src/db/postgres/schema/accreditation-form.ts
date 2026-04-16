import schema_type from "../../../utils/schema";

export const AccreditationFormSchema = {
    
    id: schema_type.primary_key(),

    ElectionId: schema_type.int(),

    form_title: schema_type.optional_string(),

    form_description: schema_type.optional_long_text(),

    is_accepting_response : schema_type.boolean(),

    UserId: schema_type.int(),

    labels: schema_type.optional( schema_type.array( schema_type.string() as any ) ),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const AccreditationFormQuestionSchema = {

    id: schema_type.primary_key(),

    label: schema_type.optional_string(),

    is_required: schema_type.optional_boolean(),

    type: schema_type.optional_enum("short-answer", "multiple-choice"),

    answer: schema_type.optional_long_text(),

    options: schema_type.optional( schema_type.array( schema_type.string() as any ) ),

    UserId: schema_type.int(),

    AccreditationFormId: schema_type.int(),

    ElectionId: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}


export const ACCREDITATION_FORM_TABLE_NAME = "AccreditationForms";

export const ACCREDITATION_FORM_QUESTIONS = "AccreditationFormQuestions";
