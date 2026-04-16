export interface BillingModelInterface {
    id?: number;
    ElectionId?: number | null;
    amount: number;
    UserId: number;
    no_of_voters: number;
    no_of_months: number;
    expires_at: string;
    warning_count?: number;
    status: 'active' | 'inactive';
    type: 'paid' | 'free';
    election_has_been_disabled?: boolean
    mode: "purchase" | "renewal"
}

export type CreateBilling = Pick<BillingModelInterface, "ElectionId" | "no_of_voters" | "no_of_months" | "type" | "UserId">;

export type GetBillingQuote = Pick<BillingModelInterface, "no_of_months" | "no_of_voters" | "type"> & { mode: 'purchase' | 'renewal'};

export interface CreateBillingBySuperAdmin {
    UserId: number;
    no_of_months: number;
    no_of_voters: number;
}

export interface GetBillings {
    filter: Partial<BillingModelInterface>,
    page: number,
    per_page: number,
    attributes?: (keyof BillingModelInterface)[],
    date?: {
        from: string;
        to: string;
    }
}