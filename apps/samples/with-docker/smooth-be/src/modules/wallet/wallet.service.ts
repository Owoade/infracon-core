import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { WalletRepository } from "./wallet.repo";
import db from "@db/postgres/index";
import { Transaction } from "sequelize";
import { NotFoundError } from "rxjs";
import { CreateWalletFundingTransaction, FundwalletFromPaystack } from "./type";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { CreateCharge } from "@modules/core/payment/type";
import * as crypto from "crypto";
import { BASE_URL } from "@env/index";
import { payment_metadata_repo } from "@utils/payment-metadata";

@Injectable()
export class WalletService {

    constructor(
        private repo: WalletRepository,
        private payment_service: PaymentSercvice
    ){}

    async fund_wallet( amount: number, account_number: string ){

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        });

        const wallet = await this.repo.get_wallet({ account_number }, ['id', 'UserId'] );

        if( !wallet ) throw new NotFoundException("Wallet not found");

        try {

            await Promise.all([

                await this.repo.mutate_account_balance( amount, wallet.UserId, transaction ),

                await this.repo.create_wallet_transaction({
                    amount: amount/100,
                    WalletId: wallet.id,
                    type: "credit",
                    description: "Wallet funding",
                    UserId: wallet.id
                }, transaction )

            ])

            await transaction.commit()

        }

        catch(e){

            await transaction.rollback();

            throw new InternalServerErrorException("Wallet funding failed", e)

        }

    }

    async fund_wallet_from_paystack( payload: FundwalletFromPaystack ){

        const { UserId, paystack_transaction_id, amount } = payload;

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        const wallet = await this.repo.get_wallet({ UserId }, ['id'] );

        const existing_transaction = await this.repo.get_wallet_transaction({ paystack_transaction_id }, ['id']);

        if( !wallet ) return console.error("Wallet not found");

        if( existing_transaction ) return console.error('Duplicate transaction: Existing paystack transaction')

        try {

            await Promise.all([

                await this.repo.mutate_account_balance( amount, UserId, transaction ),

                await this.repo.create_wallet_transaction({
                    amount: amount/100,
                    WalletId: wallet.id,
                    type: "credit",
                    description: "Wallet funding",
                    UserId: UserId,
                    paystack_transaction_id
                }, transaction )

            ])

            await transaction.commit()

        }

        catch(e){

            console.error(e);

            await transaction.rollback();

            throw new InternalServerErrorException("Wallet funding failed", e)

        }




    }

    async create_wallet_funding_transaction( payload: CreateWalletFundingTransaction ){

        const { amount, user_id, callback_url} = payload;

        const metadata = {
            type: "wallet:funding",
            user_id,
            idempotency_key: crypto.randomUUID()
        };

        const create_charge_payload: CreateCharge = {
            amount: (amount * 100).toString(),
            email: `${user_id}@smoothballot.com`,
            callback_url: callback_url ?? `${BASE_URL}/confirm-payment`,
        }

        const transaction = await this.payment_service.create_charge( create_charge_payload );

        if( !transaction.status ) throw new BadRequestException(transaction.message)

        await payment_metadata_repo.create({
            id: transaction.data.reference,
            data: metadata,
            type: "wallet_funding"
        })

        return transaction;
 
    }

}