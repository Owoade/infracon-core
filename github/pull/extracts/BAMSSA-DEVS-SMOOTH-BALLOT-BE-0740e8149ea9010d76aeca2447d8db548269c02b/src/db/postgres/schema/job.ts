import schema_type from "@utils/schema";

export const JobSchema = {

    id: schema_type.primary_key(),

    payload: schema_type.jsonb(),

    cancellation_reason: schema_type.optional_long_text(),

    status: schema_type.enum("pending", "done", "failed"),

    type: schema_type.optional_string(),

    _election_id: schema_type.optional_int(),

    Userid: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const JOB_TABLE_NAME = "Jobs";