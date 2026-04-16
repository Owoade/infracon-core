import db from "@db/postgres/index";
import { VOTE_TABLE_NAME, VoteSchema } from "@db/postgres/schema/vote";
import { VOTE_PROFILE_TABLE_NAME, VoteProfileSchema } from "@db/postgres/schema/vote-profile";

export const VoteProfileModel = db.define(VOTE_PROFILE_TABLE_NAME, VoteProfileSchema);

export const VoteModel = db.define(VOTE_TABLE_NAME, VoteSchema);

VoteProfileModel.hasMany( VoteModel );

VoteModel.belongsTo( VoteProfileModel );

export const VOTE_MODEL_PROVIDER = "VOTE_MODEL";

export const VOTE_PROFILE_MODEL_PROVIDER = "VOTE_PROVIDER_MODEL";

export const VoteProfileModelProvider = {
    provide: VOTE_PROFILE_MODEL_PROVIDER,
    useValue: VoteProfileModel
}

export const VoteModelProvider = {
    provide: VOTE_MODEL_PROVIDER,
    useValue: VoteModel
}
