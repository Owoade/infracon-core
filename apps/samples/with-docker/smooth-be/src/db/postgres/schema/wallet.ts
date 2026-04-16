import schema_type from "@utils/schema";
import { DataTypes } from "sequelize";

export const WalletSchema = {

    id: schema_type.primary_key(),

    account_name: schema_type.string(),

    account_number: schema_type.string(),

    bank_name: schema_type.string(),

    account_balance: schema_type.decimal(15, 2),

    meta: schema_type.jsonb(),

    UserId: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const WalletTransactionSchema = {

    id: schema_type.primary_key(),

    WalletId: schema_type.int(),

    UserId: schema_type.int(),

    amount: schema_type.decimal(10, 2),

    type: schema_type.enum("credit", "debit"),

    description: schema_type.optional_string(),

    paystack_transaction_id: schema_type.optional_string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const WALLET_TABLE_NAME = "Wallets";

export const WALLET_TRANSACTION_TABLE_NAME = "WalletTransactions";