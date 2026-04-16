import { redis_client } from "@cache/index";
import { ContestRepository } from "@modules/contest/repo";
import { ContestService } from "@modules/contest/service";
import { ProcessContestVote } from "@modules/contest/type";
import { SmoothTicketService } from "@modules/smooth-ticket/event/service";
import { FundwalletFromPaystack } from "@modules/wallet/type";
import { WalletService } from "@modules/wallet/wallet.service";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { payment_metadata_repo } from "@utils/payment-metadata";
import * as moment from "moment";
import { PaystackSignatureValidationGuard } from "src/guard/paystack";


@Controller('payment')
export class PaymentController {

    constructor(
        private wallet_service: WalletService,
        private contest_service: ContestService,
        private contest_repo: ContestRepository,
        private smooth_ticket_service: SmoothTicketService
    ){}

    @UseGuards(PaystackSignatureValidationGuard)
    @Post('/paystack/webhook')
    async paystack_webhook(
        @Body()
        payload: any
    ){

        const data = payload.data;

        const metadata = (
            await payment_metadata_repo.get(
                data.reference
            )
        )?.data;

        if (!metadata)
            return "Thanks"

        console.log({
            metadata,
            data
        })

        if( payload.event === "charge.success" ){

            const data = payload.data;

            if( metadata.type === "wallet:funding" ){

                const user_id = metadata.user_id;

                const idempotency_key = metadata.idempotency_key;

                const TRANSACTION_HAS_BEEN_RESOLVED = await redis_client.get(idempotency_key);

                if( TRANSACTION_HAS_BEEN_RESOLVED ){

                    console.error("Transaction has been resolved");

                    return "Thanks";

                }

                const fund_wallet_payload: FundwalletFromPaystack = {
                    amount: data.amount,
                    UserId: parseInt(user_id),
                    paystack_transaction_id: data.id.toString()
                }

                await this.wallet_service.fund_wallet_from_paystack( fund_wallet_payload );

                await redis_client.setex(idempotency_key, Date.now().toString(), 86400);

            }

            if( metadata.type === "contest:vote")
                await this.contest_service.handle_contest_vote( metadata as ProcessContestVote);

            if( metadata.type === "ticket:purchase" )
                await this.smooth_ticket_service.handle_payment(metadata.payment)

        }

        if( payload.event === "transfer.success" ){

            const transfer_code = data.transfer_code;

            const transfer_reason = data.reason as string;

            if ( transfer_reason.startsWith("Contest Revenue") ){
                await this.contest_repo.update_contest_payout({
                    transfer_status: "successful",
                    transfer_confirmation_date: moment().toISOString()
                }, { transfer_code })
            }

            if( transfer_reason.startsWith("Contest Refund") ){
                await this.contest_repo.update_vote_refund({
                    transfer_status: "successful",
                    transfer_confirmation_date: moment().toISOString()
                }, { transfer_code })
            }

        }

        await payment_metadata_repo.delete(data.reference)

        return "thanks";

    }


}