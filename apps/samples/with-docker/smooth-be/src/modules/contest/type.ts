export interface ContestModelInterface {
    id: number;
    name: string;
    slug: string;
    UserId: number;
    voting_fee: number;
    contest_image: Image,
    voting_limit?: number;
    start_time: string;
    end_time: string;
    has_started?: boolean;
    description?: string;
    hide_live_votes?: boolean;
    report?: {
        url: string,
        expiry: string
    }
}

interface Image {
    id: string;
    url: string;
    file_name?: string;
    extension: string;
}

export interface ContestantModelInterface {
    id: number;
    ContestId: number;
    UserId: number;
    name: string;
    slug: string;
    image: Image,
    bio: string;
    evicted: boolean;
    twitter?: string;
    instagram?: string;
    custom_fields?: Record<string, any>;
    is_deleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContestOrganizerProfileInterface {
    id?: number;
    UserId: number;
    name: string;
    instagram?: string;
    twitter?: string;
    website?: string;
    official_email?: string;
    recipient_id?: string;
    account_name?: string;
    account_number?: string;
    bank_code?: string;
    bank_name?: string;
}

export interface ContestPaymentInterface {
    id: number;
    name: string;
    email: string;
    ContestId: number;
    amount_paid: string;
    session_id: string;
  }

export interface ContestVoterModelInterface {
    id?: number;
    ContestId: number;
    email: string;
    name: string;
}

export interface ContestVoteModelInterface {
    id?: number;
    VoterId: number;
    ContestantId: number;
    number_of_votes: number;
    session_id: string;
    amount_paid: number;
    rate: number
    name: string;
    email: string;
    ContestId: number,
    transfer_status?: "pending" | "transfering" | "successful",
    account_number?: string,
    account_name?: string,
    bank_name?: string
    transfer_confirmation_date?: string;
    transfer_code?: string,
    UserId: number;
    amount: number;
    createdAt?: Date;
}

export interface ContestVoteRefundModelInterface {
    id?: number;
    ContestantId: number;
    number_of_votes: number;
    session_id: string;
    amount_paid: number;
    rate: number
    name: string;
    email: string;
    ContestId: number,
    transfer_status?: "pending" | "transfering" | "successful",
    account_number?: string,
    account_name?: string,
    bank_name?: string
    transfer_confirmation_date?: string;
    transfer_code?: string,
    UserId: number;
    amount: number;
    bank_code?: string,
    recipient_code?: string,
    createdAt?: Date;
}

export interface ContestFinancialRecordMoelInterface {
    id?: number;
    total_votes: number;
    total_income: number; 
    amount_due_for_payout: number,
    UserId: number;
    ContestId: number;
}

export interface GetContestantsWithSlug{
    slug: string,
    page: number,
    per_page: number,
    search: string
}

export interface GetPaymentLinkForContest {
    ContestId: number;
    email: string;
    name: string;
    votes: number;
    ContestantId: number;
    slug?: string;
    rate: number
}

export interface ProcessContestVote extends GetPaymentLinkForContest {
    type: string;
    amount_paid: number;
    contest_id: number,
    session_id: string,
    UserId: number;
}

export interface GetContestVotes {
    page: number;
    per_page: number;
    filter: Partial<ContestVoteModelInterface>
}

export interface ContestRevenueReportData {
    contest: {
        contest_name: string;
        contest_slug: string;
        contest_organizer: string;
        contest_organizer_email: string;
        total_revenue: number; 
    },
    transactions: {
        createdAt: Date,
        amount: number,
        transfer_confirmation_date: string;
        account_number: string;
        bank_name: string;
    }[]
}

export interface ContestPayoutModelInterface {
    id?: number,
    ContestId: number;
    UserId: number;
    amount: number;
    transfer_status?: "pending" | "transfering" | "successful",
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_code: string;
    recipient_code: string;
    transfer_confirmation_date?: string;
    transfer_code: string;
    initiated_by: "system" | "admin"
}

export interface ProcessContestRevenueTransfer {
    financial_record_id: number, 
    amount?: number,
    initiated_by: ContestPayoutModelInterface['initiated_by'] 
}

export interface GetContestPayouts {
    page: number,
    per_page: number,
    filter: Partial<ContestPayoutModelInterface>
}