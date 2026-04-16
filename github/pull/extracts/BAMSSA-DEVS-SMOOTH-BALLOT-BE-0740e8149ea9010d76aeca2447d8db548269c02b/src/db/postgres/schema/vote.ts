import schema_type from "@utils/schema";

export const VoteSchema = {

    id: schema_type.primary_key(),
    
    UserId: schema_type.int(),

    VoteProfileId: schema_type.int(),

    VoterId: schema_type.int(),

    voter_email: schema_type.string(),

    voter_data: schema_type.jsonb(),

    ElectionId: schema_type.int(),

    CandidateId: schema_type.optional_int(),

    candidate_name: schema_type.optional_string(),

    candidate_photo: schema_type.optional_string(),

    ElectionPostId: schema_type.int(),

    election_post_title: schema_type.string(),

    weight: schema_type.optional_int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const VOTE_TABLE_NAME = "Votes";