import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const TicketSchema = {
    id: schema_type.primary_key(),

    user_id: schema_type.int(),

    event_id: schema_type.int(),

    name: schema_type.string(),

    description: schema_type.long_text(),

    price: schema_type.decimal(10, 2),

    max_per_mail: schema_type.optional_int(),

    stock_count: schema_type.optional_int(),

    admits: schema_type.int(),

    commission: schema_type.int(),

    flat_fee: schema_type.int(),

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
};

export const TICKET_TABLE_NAME = {
    schema: "smooth_ticket",
    table_name: "tickets",
};
