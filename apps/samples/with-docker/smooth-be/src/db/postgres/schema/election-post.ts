import schema_type from "@utils/schema";

export const ElectionPostSchema = {

    id: schema_type.primary_key(),

    title: schema_type.string(),

    ElectionId: schema_type.int(),

    slug: schema_type.string(),

    UserId: schema_type.int(),

    filter_value: schema_type.optional( schema_type.array( schema_type.string() as any ) ),

    maximum_vote_per_voter: schema_type.optional_int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const ELECTION_POST_TABLE_NAME = "ElectionPosts";