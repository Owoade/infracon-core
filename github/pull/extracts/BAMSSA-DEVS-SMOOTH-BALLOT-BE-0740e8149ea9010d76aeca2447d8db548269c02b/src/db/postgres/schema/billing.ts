import schema_type from "@utils/schema";

export const BillingSchema = {

    id: schema_type.primary_key(),

    ElectionId: schema_type.optional_int(),

    amount: schema_type.decimal(10, 2),

    UserId: schema_type.int(),

    no_of_voters: schema_type.int(),

    no_of_months: schema_type.int(),

    expires_at: schema_type.string(),

    warning_count: schema_type.int(),

    status: schema_type.enum("active", "inactive"),

    type: schema_type.enum("paid", "free"),

    mode: schema_type.optional_enum("purchase", "renewal"),

    election_has_been_disabled: schema_type.optional_boolean(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const BILLING_TABLE_NAME = "Billings";