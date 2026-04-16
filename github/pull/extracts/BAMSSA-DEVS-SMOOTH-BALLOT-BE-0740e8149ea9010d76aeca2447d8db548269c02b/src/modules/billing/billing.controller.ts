import { Controller, Get, Injectable, Patch, Post, UseInterceptors } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { RequestPayload, User } from "@decorators/index";
import { create_billing_validator, get_quote_validator, update_billing_validator } from "@validators/billing";
import { UserModelInterface } from "@modules/user/type";
import { BillingModelInterface, CreateBilling, GetBillingQuote } from "./type";
import { response } from "@utils/response";
import { UserAuthInterceptor } from "src/interceptors/auth";
import { id_validator } from "@validators/utils";
import { BillingRepository } from "./billing.repo";
import { redis_client } from "@cache/index";

@Injectable()
@UseInterceptors(UserAuthInterceptor)
@Controller("billing")
export class BillingConroller {
    
    constructor(
        private service: BillingService,
        private repo: BillingRepository
    ){}

    @Post("/")
    async create(

        @RequestPayload({
            validator: create_billing_validator
        })
        payload: CreateBilling,

        @User()
        user: UserModelInterface
        
    ){

        payload.UserId = user.id;

        const billing = await this.service.create( payload );

        return response({
            status: true,
            data: {
                billing
            },
            statusCode: 201
        })

    }

    @Patch("/")
    async update(

        @RequestPayload({
            validator: update_billing_validator
        })
        payload: CreateBilling & { id: number },

        @User()
        user: UserModelInterface
        
    ){

        payload.UserId = user.id;

        const billing = await this.service.update_billiing( payload, user );

        return response({
            status: true,
            data: {
                billing
            },
            statusCode: 201
        })

    }

    @Post("/quote")
    async get_quote(

        @RequestPayload({
            validator: get_quote_validator
        })
        payload: GetBillingQuote

    ){

        const quote = await this.service.get_quote( payload, payload.mode );

        return response({
            status: true,
            statusCode: 200,
            data: {
                quote
            }
        })

    }

    @Post("/whitelist/quote")
    async get_quote_unauth(

        @RequestPayload({
            validator: get_quote_validator
        })
        payload: GetBillingQuote

    ){

        const quote = await this.service.get_quote( payload, payload.mode );

        let prices;

        const platform_hash = await redis_client.get('PLATFORM_HASH');

        if( platform_hash ) {
            const _platform_hash = JSON.parse(platform_hash);
            prices = {
                monthly_cost: _platform_hash.price_per_month,
                voters_cost: _platform_hash.price_per_voter
            }
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                quote,
                prices
            }
        })

    }

    @Get("/whitelist/price")
    async get_price_unauth(){

        let prices;

        const platform_hash = await redis_client.get('PLATFORM_HASH');

        if( platform_hash ) {
            const _platform_hash = JSON.parse(platform_hash);
            prices = {
                monthly_cost: _platform_hash.price_per_month,
                voters_cost: _platform_hash.price_per_voter
            }
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                prices
            }
        })

    }

    @Get('/:election_id')
    async get_eleaction_last_billing(

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "params"
        })
        payload: { election_id: string },

        @User()
        user: UserModelInterface

    ){

        const { election_id } = payload;

        const billing = await this.repo.get_last_billing({
            ElectionId: parseInt(election_id),
            UserId: user.id
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                billing
            }
        })

    }

    @Get('/')
    async get_last_free_billing(

        @User()
        user: UserModelInterface

    ){

        const billing = await this.repo.get_last_billing({ ElectionId: null, UserId: user.id });

        return response({
            status: true,
            message: "Billing retrieved",
            statusCode: 200,
            data: {
                billing
            }
        })
    }

}