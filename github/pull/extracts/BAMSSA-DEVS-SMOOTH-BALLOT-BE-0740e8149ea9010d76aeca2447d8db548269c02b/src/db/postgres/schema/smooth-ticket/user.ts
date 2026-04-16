import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const UserSchema = {
    id: schema_type.primary_key(),

    name: schema_type.string(),

    email: schema_type.string(),

    password: schema_type.string(),

    is_disabled: schema_type.optional_boolean(),

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
};

export const USER_TABLE_NAME = {
    schema: "smooth_ticket",
    table_name: "users",
};
