import { RequestPayload } from "@decorators/index";
import { ContestRepository } from "@modules/contest/repo";
import { ContestService } from "@modules/contest/service";
import { Controller, Get, Post, UseInterceptors } from "@nestjs/common";
import { response } from "@utils/response";
import { initiate_contest_payout_validator } from "@validators/contest";
import { id_validator, pagination_validator } from "@validators/utils";
import { SuperAdminAuthInterceptor } from "src/interceptors/super-admin-auth";

@Controller('superadmin/contest')
@UseInterceptors(SuperAdminAuthInterceptor)
export class ContestManagementController {

    constructor(
        private contest_repo: ContestRepository,
        private contest_service: ContestService
    ){}

    @Get('/')
    async get_contests(
        @RequestPayload({
            validator: pagination_validator
        })
        payload: { page: string, per_page: string }
    ){

        const page = parseInt(payload.page);
        const per_page = parseInt(payload.per_page);

        const contests = await this.contest_repo.get_contests({}, page, per_page);
        const stats = await this.contest_repo.get_contest_statistics();

        return response({
            status: true,
            statusCode: 200,
            data: {
                contests,
                stats
            }
        })

    }

    @Get('/:id')
    async get_contest(
        @RequestPayload({
            validator: id_validator('id'),
            type: 'params'
        })
        payload: { id: string }
    ){

        const id = parseInt(payload.id);
        const contest = await this.contest_repo.get_contest({ id });
        const financial_record = await this.contest_repo.get_contest_financial_record({ ContestId: id })

        return response({
            status: true,
            statusCode: 200,
            data: {
                contest,
                financial_record
            }
        })

    }

    @Post('/:id/candidates')
    async get_contestants(
        @RequestPayload({
            validator: id_validator('id'),
            type: 'params'
        })
        payload: { id: string },

        @RequestPayload({
            validator: pagination_validator
        })
        pagination_payload: { page: string, per_page: string }
    ){

        const id = parseInt(payload.id);
        const page = parseInt(pagination_payload.page);
        const per_page = parseInt(pagination_payload.per_page);

        const contest = await this.contest_repo.get_contestants({ ContestId: id }, page, per_page)

        return response({
            status: true,
            statusCode: 200,
            data: {
                contest
            }
        })
        
    }

    @Post('/:id/votes')
    async get_votes(
        @RequestPayload({
            validator: id_validator('id'),
            type: 'params'
        })
        payload: { id: string },

        @RequestPayload({
            validator: pagination_validator
        })
        pagination_payload: { page: string, per_page: string }
    ){

        const id = parseInt(payload.id);
        const page = parseInt(pagination_payload.page);
        const per_page = parseInt(pagination_payload.per_page);

        const _response = await this.contest_service.get_contest_votes({
            page,
            per_page,
            filter: { ContestId: id }
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                ..._response
            }
        })
        
    }

    @Post('/:id/payouts')
    async get_payouts(
        @RequestPayload({
            validator: id_validator('id'),
            type: 'params'
        })
        payload: { id: string },

        @RequestPayload({
            validator: pagination_validator
        })
        pagination_payload: { page: string, per_page: string }
    ){

        const id = parseInt(payload.id);
        const page = parseInt(pagination_payload.page);
        const per_page = parseInt(pagination_payload.per_page);

        const _response = await this.contest_service.get_payouts({
            page,
            per_page,
            filter: { ContestId: id }
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                ..._response
            }
        })
        
    }

    @Post('/:id/payout')
    async initiate_payout(
        @RequestPayload({
            validator: initiate_contest_payout_validator
        })
        payload: { financial_record_id: number, amount: number }
    )
    {

        const error_message = await this.contest_service.process_contest_revenue_transfer({
            amount: payload.amount,
            initiated_by: "admin",
            financial_record_id: payload.financial_record_id
        })

        return response({
            status: error_message ? false : true,
            message: error_message ?? "Payout initiated",
            statusCode: error_message ? 400 : 200,
            data: {}
        })

    }


}