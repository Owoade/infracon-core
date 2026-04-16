import db from "@db/postgres/index";
import { WALLET_TABLE_NAME, WALLET_TRANSACTION_TABLE_NAME, WalletSchema, WalletTransactionSchema } from "@db/postgres/schema/wallet";

export const WalletModel = db.define( WALLET_TABLE_NAME, WalletSchema, { timestamps: true } );

export const WalletTransactionModel = db.define( WALLET_TRANSACTION_TABLE_NAME, WalletTransactionSchema, { timestamps: true } );

WalletModel.hasMany( WalletTransactionModel );

WalletTransactionModel.belongsTo( WalletModel );

export const WALLET_MODEL_PROVIDER = "WALLET_MODEL";

export const WALLET_TRANSACTION_MODEL_PROVIDER = "WALLET_TRANSACTION_MODEL";

export const WalletModelProvider = {
    provide: WALLET_MODEL_PROVIDER,
    useValue: WalletModel
}

export const WalletTransactionModelProvider = {
    provide: WALLET_TRANSACTION_MODEL_PROVIDER,
    useValue: WalletTransactionModel
}
