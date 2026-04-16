import schema_type from "@utils/schema"
import { DataTypes } from "sequelize";

export const UserSchema = {

    id: schema_type.primary_key(),

    email: schema_type.string(),

    password: schema_type.string(),

    name: schema_type.string(),

    type: schema_type.enum("USER"),

    is_disabled: schema_type.optional_boolean(),

    photo: schema_type.optional( schema_type.jsonb() as any ),

    createdAt: DataTypes.DATE,

    updatedAt: DataTypes.DATE

}

export const USER_TABLE_NAME = "Users";

