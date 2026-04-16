import { InferedSchemaType } from "@utils/schema";
import { WalletModelInterface, WalletTransactionModelInterface } from "./type";
import { Transaction } from "sequelize";
import { Inject } from "@nestjs/common";
import { WALLET_MODEL_PROVIDER, WALLET_TRANSACTION_MODEL_PROVIDER } from "./wallet.model";

export class WalletRepository {

    constructor(

        @Inject(WALLET_MODEL_PROVIDER)
        private WalletModel: InferedSchemaType<WalletModelInterface>,

        @Inject(WALLET_TRANSACTION_MODEL_PROVIDER)
        private WalletTransactionModel: InferedSchemaType<WalletTransactionModelInterface>
        
    ){}

    async create( payload: WalletModelInterface, transaction: Transaction  ){

        if( !payload.account_balance ) payload.account_balance = '0';

        const wallet = await this.WalletModel.create( payload, { transaction } );
        
        return wallet.toJSON();

    }

    async get_wallet( filter: Partial<WalletModelInterface> ): Promise<WalletModelInterface>
    async get_wallet<T extends keyof WalletModelInterface >( filter: Partial<WalletModelInterface>,  attributes?: T[]): Promise<Pick<WalletModelInterface, T>>
    async get_wallet<T extends keyof WalletModelInterface >( filter: Partial<WalletModelInterface>,  attributes?: T[]){

        const wallet = (await this.WalletModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {} )
        }))?.toJSON()

        if( attributes ) return wallet as Pick<WalletModelInterface, T>;

        if(!wallet) return wallet;

        wallet._balance = parseInt(wallet?.account_balance as string) / 100;

        return wallet;
        
    }

    async get_wallet_transaction( filter: Partial<WalletTransactionModelInterface> ): Promise<WalletTransactionModelInterface>
    async get_wallet_transaction<T extends keyof WalletTransactionModelInterface >( filter: Partial<WalletTransactionModelInterface>,  attributes?: T[]): Promise<Pick<WalletTransactionModelInterface, T>>
    async get_wallet_transaction<T extends keyof WalletTransactionModelInterface >( filter: Partial<WalletTransactionModelInterface>,  attributes?: T[]){

        const wallet_transaction = (await this.WalletTransactionModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {} )
        }))?.toJSON()

        if( attributes ) return wallet_transaction as Pick<WalletTransactionModelInterface, T>;

        return wallet_transaction;
        
    }

    async mutate_account_balance( amount: number, user_id: number, transaction: Transaction ){

        await this.WalletModel.increment('account_balance', { by: amount, where: { UserId: user_id }, transaction });

    }

    // async decreament_account_balance( amount: number, user_id: number, transaction: Transaction ){
        
    //     await this.WalletModel.decrement('account_balance', { by: amount, transaction,  });

    // }

    async create_wallet_transaction( payload: WalletTransactionModelInterface, transaction: Transaction ){

        const wallet_transaction = await this.WalletTransactionModel.create(payload, { transaction });

        return wallet_transaction.toJSON();

    }

    async get_wallet_transactions( filter: Partial<WalletTransactionModelInterface>, page: number, per_page: number ){

        const [ count, wallet_transactions ] = await Promise.all([

            this.WalletTransactionModel.count({ where: filter }),

            this.WalletTransactionModel.findAll({
                where: filter,
                limit: per_page,
                offset: per_page * ( page - 1 ),
                order: [["createdAt", "DESC"]]
            })

        ])

        return {count, wallet_transactions};
        
    }
}