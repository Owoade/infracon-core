import db from "@db/postgres/index";
import { ELECTION_POST_TABLE_NAME, ElectionPostSchema } from "@db/postgres/schema/election-post";
import { CandidateModel } from "./candidate";

const ElectionPostModel = db.define(ELECTION_POST_TABLE_NAME, ElectionPostSchema, { timestamps: true });

ElectionPostModel.hasMany( CandidateModel );

CandidateModel.belongsTo(ElectionPostModel)

export const ELECTION_POST_MODEL_PROVIDER = "ELECTION_POST_MODEL";

export const ElectionPostModelProvider = {
    provide: ELECTION_POST_MODEL_PROVIDER,
    useValue: ElectionPostModel
}