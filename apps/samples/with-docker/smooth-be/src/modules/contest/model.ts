import db from "@db/postgres";
import { CONTEST_PAYOUT_TABLE_NAME, CONTEST_TABLE_NAME, CONTEST_VOTE_REFUND_TABLE_NAME, CONTEST_VOTE_TABLE_NAME, CONTEST_VOTER_TABLE_NAME, CONTESTANT_TABLE_NAME, ContestantSchema, ContestPayoutSchema, ContestSchema, ContestVoteRefundSchema, ContestVoterSchema, ContestVoteSchema } from "@db/postgres/schema/contest";
import { CONTEST_FINANCIAL_RECORD_TABLE_NAME, ContestFinancialRecordSchema } from "@db/postgres/schema/contest-financial-record";
import { CONTEST_ORGANIZER_PROFILE_TABLE_NAME, ContestOrganizerProfileSchema } from "@db/postgres/schema/contest-organizer-profile";
import { CONTEST_PAYMENT_TABLE_NAME, ContestPaymentSchema } from "@db/postgres/schema/contest-payments";

export const ContestModel = db.define(CONTEST_TABLE_NAME, ContestSchema, { timestamps: true });

export const ContestantModel = db.define(CONTESTANT_TABLE_NAME, ContestantSchema, { timestamps: true });

export const ContestOrganizerProfileModel = db.define(CONTEST_ORGANIZER_PROFILE_TABLE_NAME, ContestOrganizerProfileSchema, { timestamps: true });

export const ContestFinancialRecordModel = db.define(CONTEST_FINANCIAL_RECORD_TABLE_NAME, ContestFinancialRecordSchema, { timestamps: true });

export const ContestVoterModel = db.define(CONTEST_VOTER_TABLE_NAME, ContestVoterSchema, { timestamps: true });

export const ContestVoteModel = db.define(CONTEST_VOTE_TABLE_NAME, ContestVoteSchema, { timestamps: true });

export const ContestVoteRefundModel = db.define(CONTEST_VOTE_REFUND_TABLE_NAME, ContestVoteRefundSchema, { timestamps: true })

ContestantModel.hasMany( ContestVoteModel );

ContestVoteModel.belongsTo( ContestantModel );

export const ContestPaymentModel = db.define(CONTEST_PAYMENT_TABLE_NAME, ContestPaymentSchema, { timestamps: true });

export const ContestPayoutModel = db.define(CONTEST_PAYOUT_TABLE_NAME, ContestPayoutSchema, { timestamps: true });

export const CONTEST_MODEL_PROVIDER = "CONTEST_MODEL_PROVIDER";

export const CONTESTANT_MODEL_PROVIDER = "CONTESTANT_MODEL_PROVIDER";

export const CONTEST_ORGANIZER_MODEL_PROVIDER = "CONTEST_ORGANIZER_MODEL_PROVIDER";

export const CONTEST_FINANCIAL_RECORD_MODEL_PROVIDER = "CONTEST_FINANCIAL_RECORD_MODEL_PROVIDER";

export const CONTEST_VOTER_MODEL_PROVIDER = "CONTEST_VOTER_MODEL_PROVIDER";

export const CONTEST_VOTE_MODEL_PROVIDER = "CONTEST_VOTE_MODEL_PROVIDER";

export const CONTEST_VOTE_REFUND_MODEL_PROVIDER = "CONTEST_VOTE_REFUND_MODEL_PROVIDER";

export const CONTEST_PAYMENT_MODEL_PROVIDER = "CONTEST_PAYMENT_MODEL_PROVIDER";

export const CONTEST_PAYOUT_MODEL_PROVIDER = 'CONTEST_PAYOUT_MODEL_PROVIDER';

export const ContestModelProvider = {
    provide: CONTEST_MODEL_PROVIDER,
    useValue: ContestModel
}

export const ContestantModelProvider = {
    provide: CONTESTANT_MODEL_PROVIDER,
    useValue: ContestantModel
}

export const ContestOrganizerProfileModelProvider = {
    provide: CONTEST_ORGANIZER_MODEL_PROVIDER,
    useValue: ContestOrganizerProfileModel
}

export const ContestFinancialRecordModelProvider = {
    provide: CONTEST_FINANCIAL_RECORD_MODEL_PROVIDER,
    useValue: ContestFinancialRecordModel
}

export const ContestVoterModelProvider = {
    provide: CONTEST_VOTER_MODEL_PROVIDER,
    useValue: ContestVoterModel
}

export const ContestVoteModelProvider = {
    provide: CONTEST_VOTE_MODEL_PROVIDER,
    useValue: ContestVoteModel
}

export const ContestVoteRefundModelProvider = {
    provide: CONTEST_VOTE_REFUND_MODEL_PROVIDER,
    useValue: ContestVoteRefundModel
}

export const ContestPaymentModelProvider = {
    provide: CONTEST_PAYMENT_MODEL_PROVIDER,
    useValue: ContestPaymentModel
}

export const ContestPayoutModelProvider = {
    provide: CONTEST_PAYOUT_MODEL_PROVIDER,
    useValue: ContestPayoutModel
}