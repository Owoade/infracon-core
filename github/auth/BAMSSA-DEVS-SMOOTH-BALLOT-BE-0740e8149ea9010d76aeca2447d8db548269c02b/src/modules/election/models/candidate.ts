import db from "@db/postgres/index";
import { CANDIDATE_TABLE_NAME, CandidateSchema } from "@db/postgres/schema/candidate";

export const CandidateModel = db.define(CANDIDATE_TABLE_NAME, CandidateSchema, { timestamps: true });

export const CANDIDATE_MODEL_PROVIDER = "CANDIDATE_MODEL";

export const CandidateModelProvider = {
    provide: CANDIDATE_MODEL_PROVIDER,
    useValue: CandidateModel
}