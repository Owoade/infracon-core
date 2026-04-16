import schema_type from "@utils/schema";

export const VotersSchema = {

    id: schema_type.primary_key(),

    ElectionId: schema_type.int(),

    UserId: schema_type.int(),

    email: schema_type.string(),

    password: schema_type.long_text(),

    data: schema_type.jsonb(),

    is_suspended: schema_type.boolean(),

    _job_id: schema_type.optional_int(),

    has_voted: schema_type.optional_boolean(),

    email_sent: schema_type.optional_int(),

    has_sent_voters_auth_credential: schema_type.optional_boolean(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const VOTERS_TABLE_NAME = "Voters";