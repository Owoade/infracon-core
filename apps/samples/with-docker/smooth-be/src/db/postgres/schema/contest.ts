import schema_type from "@utils/schema";

export const ContestSchema = {

    id: schema_type.primary_key(),

    name: schema_type.string(),

    slug: schema_type.string(),

    UserId: schema_type.int(),

    contest_image: schema_type.jsonb(),

    voting_limit: schema_type.optional_int(),

    voting_fee: schema_type.int(),

    start_time: schema_type.optional_string(),

    end_time: schema_type.optional_string(),

    has_started: schema_type.optional_boolean(),

    description: schema_type.optional_string(),

    report: schema_type.optional( schema_type.jsonb() as any ),

    hide_live_votes: schema_type.optional( schema_type.boolean() ),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_TABLE_NAME = "Contests"; 

export const ContestantSchema = {

    id: schema_type.primary_key(),

    ContestId: schema_type.int(),

    UserId: schema_type.int(),

    name: schema_type.string(),

    image: schema_type.jsonb(),

    bio: schema_type.long_text(),

    evicted: schema_type.optional_boolean(),

    twitter: schema_type.optional_string(),

    instagram: schema_type.optional_string(),

    custom_fields: schema_type.optional( schema_type.jsonb() as any ),

    slug: schema_type.optional_string(),

    is_deleted: schema_type.optional_boolean(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTESTANT_TABLE_NAME = "Contestants";

export const ContestVoterSchema = {
    
    id: schema_type.primary_key(),

    email: schema_type.string(),

    name: schema_type.string(),

    ContestId: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_VOTER_TABLE_NAME = "ContestVoters";

export const ContestVoteSchema = {

    id: schema_type.primary_key(),

    VoterId: schema_type.int(),

    ContestantId: schema_type.int(),

    ContestId: schema_type.int(),

    UserId: schema_type.int(),

    number_of_votes: schema_type.int(),

    amount_paid: schema_type.int(),

    amount: schema_type.optional_int(),

    name: schema_type.string(),

    email: schema_type.string(),

    rate: schema_type.int(),

    session_id: schema_type.string(),

    transfer_status: schema_type.optional_string(),

    account_number: schema_type.optional_string(),

    account_name: schema_type.optional_string(),

    bank_name: schema_type.optional_string(),

    transfer_confirmation_date: schema_type.optional_string(),

    transfer_code: schema_type.optional_string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()
}

export const CONTEST_VOTE_TABLE_NAME = "ContestVotes";

export const ContestVoteRefundSchema = {
    
    id: schema_type.primary_key(),

    ContestantId: schema_type.int(),

    ContestId: schema_type.int(),

    UserId: schema_type.int(),

    number_of_votes: schema_type.int(),

    amount_paid: schema_type.int(),

    amount: schema_type.optional_int(),

    name: schema_type.string(),

    email: schema_type.string(),

    rate: schema_type.int(),

    session_id: schema_type.string(),

    transfer_status: schema_type.optional_string(),

    account_number: schema_type.optional_string(),

    account_name: schema_type.optional_string(),

    bank_name: schema_type.optional_string(),

    bank_code: schema_type.optional_string(),

    recipient_code: schema_type.optional_string(),

    transfer_confirmation_date: schema_type.optional_string(),

    transfer_code: schema_type.optional_string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_VOTE_REFUND_TABLE_NAME = "ContestVoteRefunds";

export const ContestPayoutSchema = {
    
    id: schema_type.primary_key(),

    ContestId: schema_type.int(),

    UserId: schema_type.int(),

    amount: schema_type.int(),

    transfer_status: schema_type.string(),

    account_number: schema_type.string(),

    account_name: schema_type.string(),

    bank_name: schema_type.string(),

    bank_code: schema_type.string(),

    recipient_code: schema_type.string(),

    transfer_confirmation_date: schema_type.optional_string(),

    transfer_code: schema_type.string(),

    initiated_by: schema_type.string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_PAYOUT_TABLE_NAME = "ContestPayouts";