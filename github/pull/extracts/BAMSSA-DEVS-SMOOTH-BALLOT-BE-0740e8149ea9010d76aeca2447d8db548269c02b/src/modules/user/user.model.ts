import db from "@db/postgres/index";
import { ElectionModel } from "@modules/election/models/election.model";
import { USER_TABLE_NAME, UserSchema } from "@db/postgres/schema/user";

export const UserModel = db.define(USER_TABLE_NAME, UserSchema, { timestamps: true });

UserModel.hasMany( ElectionModel );
ElectionModel.belongsTo( UserModel );

export const USER_MODEL_PROVIDER = 'USER_MODEL';

export const UserModelProvider = {
    provide: USER_MODEL_PROVIDER,
    useValue: UserModel
}