import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const EventSchema = {
    id: schema_type.primary_key(),

    user_id: schema_type.int(),

    name: schema_type.string(),

    slug: schema_type.string(),

    description: schema_type.long_text(),

    image: schema_type.optional(schema_type.jsonb() as any),

    community_link: schema_type.optional_string(),

    start_date: DataTypes.DATE,

    end_date: DataTypes.DATE,

    scanner_key: schema_type.optional_string(),

    location: schema_type.json() as any,

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
};

export const EVENT_TABLE_NAME = {
    schema: "smooth_ticket",
    table_name: "events",
};
