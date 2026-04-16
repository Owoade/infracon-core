import { Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { WalletRepository } from "./wallet.repo";
import { UserAuthInterceptor } from "src/interceptors/auth";
import { UserModelInterface } from "@modules/user/type";
import { RequestPayload, User } from "@decorators/index";
import { response } from "@utils/response";
import { pagination_validator } from "@validators/utils";
import { fund_wallet_validator } from "@validators/wallet";
import { WalletService } from "./wallet.service";
import { CreateWalletFundingTransaction } from "./type";

@Controller('wallet')
@UseInterceptors(UserAuthInterceptor)
export class WalletController{
    
    constructor(
        private repo: WalletRepository,
        private service: WalletService
    ){}

    @Get('/')
    async get_wallet(
        @User()
        user: UserModelInterface
    ){

        const wallet = await this.repo.get_wallet({ UserId: user.id });

        return response({
            status: true,
            statusCode: 200,
            data: {
                wallet
            }
        })

    }

    @Get('/transactions')
    async get_wallet_transactions(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: pagination_validator,
            type: "query"
        })
        payload: any

    ){
        const page = parseInt( payload.page );

        const per_page = parseInt( payload.per_page );

        const {wallet_transactions, count} = await this.repo.get_wallet_transactions( { UserId: user.id }, page, per_page )

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                wallet_transactions
            }
        })
        
    }

    @Post('/fund')
    async fund_wallet(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: fund_wallet_validator
        })
        payload: CreateWalletFundingTransaction

    ){

        payload.user_id = user.id;

        const transaction = await this.service.create_wallet_funding_transaction( payload );

        return response({
            status: true,
            statusCode: 200,
            data: transaction.data
        })
    }

}