import db from "@db/postgres/index";
import { VOTERS_TABLE_NAME, VotersSchema } from "@db/postgres/schema/voter";

const VoterModel = db.define(VOTERS_TABLE_NAME, VotersSchema, {timestamps: true});

export const VOTERS_MODEL_PROVIDER = "VOTERS_MODEL";

export const VotersModelProvider = {
    provide: VOTERS_MODEL_PROVIDER,
    useValue: VoterModel
}