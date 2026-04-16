import schema_type from "@utils/schema";

export const VoteProfileSchema = {

    id: schema_type.primary_key(),

    election_title: schema_type.string(),

    election_date: schema_type.string(),

    start_time: schema_type.string(),

    ElectionId: schema_type.int(),

    UserId: schema_type.int(),

    user_email: schema_type.string(),

    user_first_name: schema_type.string(),

    user_last_name: schema_type.string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const VOTE_PROFILE_TABLE_NAME = "VoteProfiles";