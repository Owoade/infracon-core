import db from "@db/postgres";
import { USER_TABLE_NAME, UserSchema } from "@db/postgres/schema/smooth-ticket/user";

export const SmoothTicketUserModel = db.define(
    USER_TABLE_NAME.table_name,
    UserSchema,
    {
        schema: USER_TABLE_NAME.schema,
        timestamps: false
    }
)

export const SMOOTH_TICKET_USER_MODEL_PROVIDER = 'SMOOTH_TICKET_USER_MODEL';

export const SmoothTicketUserModelProvider = {
    provide: SMOOTH_TICKET_USER_MODEL_PROVIDER,
    useValue: SmoothTicketUserModel
}