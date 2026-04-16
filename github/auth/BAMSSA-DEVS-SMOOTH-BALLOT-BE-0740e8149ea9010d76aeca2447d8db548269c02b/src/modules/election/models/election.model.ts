import db from "@db/postgres/index";
import { ELECTION_TABLE_NAME, ElectionSchema } from "@db/postgres/schema/election";

export const ElectionModel = db.define(ELECTION_TABLE_NAME, ElectionSchema, { timestamps: true });

export const ELECTION_MODEL_PROVIDER = "ELECTION_MODEL";

export const ElectionModelProvider = {
    provide: ELECTION_MODEL_PROVIDER,
    useValue: ElectionModel
}
