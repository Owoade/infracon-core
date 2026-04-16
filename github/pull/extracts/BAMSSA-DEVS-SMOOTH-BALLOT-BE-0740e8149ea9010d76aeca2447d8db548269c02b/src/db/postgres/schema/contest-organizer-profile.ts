import schema_type from "@utils/schema";

export const ContestOrganizerProfileSchema = {

    id: schema_type.primary_key(),

    UserId: schema_type.int(),

    name: schema_type.string(),

    instagram: schema_type.optional_string(),

    twitter: schema_type.optional_string(),

    website: schema_type.optional_string(),

    official_email: schema_type.optional_string(),

    recipient_id: schema_type.optional_string(),

    account_name: schema_type.optional_string(),

    account_number: schema_type.optional_string(),

    bank_name: schema_type.optional_string(),

    bank_code: schema_type.optional_string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_ORGANIZER_PROFILE_TABLE_NAME = "ContestOrganizerProfiles";