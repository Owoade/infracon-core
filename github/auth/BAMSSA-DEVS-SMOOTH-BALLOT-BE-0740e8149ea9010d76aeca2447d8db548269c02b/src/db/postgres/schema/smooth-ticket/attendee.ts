import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const AttendeeSchema = {
    id: schema_type.primary_key(),

    user_id: schema_type.int(),

    name: schema_type.string(),

    email: schema_type.string(),

    phone: schema_type.string(),

    access_code: schema_type.string(),

    event_id: DataTypes.INTEGER,

    ticket_id: DataTypes.INTEGER,

    payment_id: schema_type.optional_int(),

    qr_code_image_url: schema_type.optional_string(),

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
};

export const ATTENDEE_TABLE_NAME = {
    schema: "smooth_ticket",
    table_name: "attendees",
};
