import schema_type from "@utils/schema";

export const CandidateSchema = {

    id: schema_type.primary_key(),

    ElectionPostId: schema_type.int(),

    name: schema_type.string(),

    image: schema_type.optional(schema_type.jsonb() as any),

    bio: schema_type.optional_long_text(),

    ElectionId: schema_type.int(),

    UserId: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CANDIDATE_TABLE_NAME = "Candidates";