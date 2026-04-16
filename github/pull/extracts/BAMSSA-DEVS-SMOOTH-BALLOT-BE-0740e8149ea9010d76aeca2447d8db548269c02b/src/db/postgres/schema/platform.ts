import schema_type from "@utils/schema";

export const PlatformSchema = {

    id: schema_type.primary_key(),

    income: schema_type.decimal(15, 2),

    price_per_voter: schema_type.int(),

    price_per_month: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const PLATFORM_TABLE_NAME = "Platforms";