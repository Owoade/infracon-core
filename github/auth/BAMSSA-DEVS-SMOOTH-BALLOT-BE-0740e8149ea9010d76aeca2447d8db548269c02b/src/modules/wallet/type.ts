export interface WalletModelInterface {
    id?: number;
    account_name: string;
    account_number: string;
    bank_name: string;
    account_balance: string | number;
    meta: Record<string, any>;
    _balance?: number;
    UserId: number;
}

export interface WalletTransactionModelInterface {
    id?: number;
    WalletId: number;
    UserId: number;
    amount: number;
    type: 'credit' | 'debit';
    description?: string;
    paystack_transaction_id?: string;
}

export type FundwalletFromPaystack = Pick<WalletTransactionModelInterface, 'UserId' | 'amount' | 'paystack_transaction_id'>;

export interface CreateWalletFundingTransaction {
    user_id: number;
    amount: number;
    callback_url?: string
}