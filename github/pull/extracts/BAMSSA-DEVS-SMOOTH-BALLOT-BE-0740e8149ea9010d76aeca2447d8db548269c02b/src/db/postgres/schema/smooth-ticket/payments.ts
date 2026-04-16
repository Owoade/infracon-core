import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const PaymentSchema = {
    id: schema_type.primary_key(),

    user_id: schema_type.int(),

    event_name: schema_type.optional_string(),

    event_id: schema_type.int(),

    ticket_id: schema_type.int(),

    ticket_name: schema_type.string(),

    ticket_amount: schema_type.number(10,2),

    amount: schema_type.number(10,2),

    total_amount: schema_type.number(10,2),

    email: schema_type.string(),

    name: schema_type.string(),

    reference: schema_type.optional_string(),

    phone: schema_type.string(),

    guests: schema_type.optional(schema_type.array( schema_type.jsonb() as any )),

    tickets: schema_type.optional(schema_type.array( schema_type.jsonb() as any )),

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
};

export const PAYMENT_TABLE_NAME = {
    schema: "smooth_ticket",
    table_name: "payments",
};
