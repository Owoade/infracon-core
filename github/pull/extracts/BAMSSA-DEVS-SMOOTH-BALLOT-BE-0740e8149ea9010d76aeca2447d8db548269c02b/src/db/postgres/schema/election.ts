    import schema_type from "@utils/schema";

export const ElectionSchema = {

    id: schema_type.primary_key(),

    name: schema_type.string(),

    slug: schema_type.string(),

    election_date: schema_type.optional_string(),

    start_time: schema_type.optional_string(),

    end_time: schema_type.optional_string(),

    UserId: schema_type.int(),

    voters_acquisition_channel: schema_type.optional_enum("csv", "form"),

    csv_file: schema_type.optional( schema_type.jsonb() as any ),

    broadcast_date: schema_type.optional_string(),

    has_sent_broadcast: schema_type.optional_boolean(),

    is_disabled: schema_type.optional_boolean(),

    result: schema_type.optional( schema_type.jsonb() as any ),

    indexed_voters_attributes: schema_type.optional( schema_type.array( schema_type.string() as any ) ),

    result_is_visible: schema_type.optional_boolean(),

    mode: schema_type.optional_string(),

    election_post_filter_attribute: schema_type.optional_string(),

    election_vote_weight_attribute: schema_type.optional_string(),

    hide_result_link: schema_type.optional_boolean(),

    search_attribute: schema_type.optional_string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const ELECTION_TABLE_NAME = "Elections"; 