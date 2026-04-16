import { Controller, Delete, Get, NotFoundException, Patch, Post, Query, UseInterceptors } from "@nestjs/common";
import { UserAuthInterceptor } from "src/interceptors/auth";
import { ContestRepository } from "./repo";
import { ContestService } from "./service";
import { RequestPayload, User } from "@decorators/index";
import { UserModelInterface } from "@modules/user/type";
import { add_bank_details_to_refund_validator, create_contest_validator, create_contestant_validator, get_contest_votes_validator, get_contestants_validator, get_contestants_with_slug_validator, get_payment_link_for_contest, get_voting_fee_for_contest_validator, resolve_bank_account_validator, update_contest_validator, update_contestant_validator, upsert_contest_organizer_profile_validator } from "@validators/contest";
import { ContestantModelInterface, ContestModelInterface, ContestOrganizerProfileInterface, ContestVoteRefundModelInterface, GetContestantsWithSlug, GetContestVotes, GetPaymentLinkForContest, ProcessContestVote } from "./type";
import { response } from "@utils/response";
import { id_validator, id_validator_string, pagination_validator } from "@validators/utils";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { payment_metadata_repo } from "@utils/payment-metadata";

@Controller('contest')
@UseInterceptors(UserAuthInterceptor)
export class ContestController {

    constructor(
        private repo: ContestRepository,
        private service: ContestService,
        private payment_service: PaymentSercvice

    ){}

    @Post('/')
    async create_contest(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: create_contest_validator
        })
        payload: ContestModelInterface

    ){

        payload.UserId = user.id;

        const contest = await this.service.create_contest( payload );

        return response({
            status: true,
            data: {
                contest
            },
            statusCode: 201
        })

    }

    @Patch('/')
    async update_contest(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: update_contest_validator
        })
        payload: ContestModelInterface

    ){

        const filter = {
            id: payload.id,
            UserId: user.id
        }

        const updated_contest = await this.service.update_contest(payload, filter);

        return response({
            status: true,
            data: {
                updated_contest
            },
            statusCode: 201
        })

    }

    @Post('/contestant')
    async create_contestant(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: create_contestant_validator
        })
        payload: ContestantModelInterface

    ){

        payload.UserId = user.id;

        const contestant = await this.service.create_contestant( payload );

        return response({
            status: true,
            data: {
                contestant
            },
            statusCode: 200
        })

    }

    @Patch('/contestant')
    async update_contestant(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: update_contestant_validator
        })
        payload: ContestantModelInterface

    ){

        const filter = {
            id: payload.id,
            UserId: user.id
        }

        const update_contestant = await this.service.update_contestant(payload, filter)

        return response({
            status: true,
            data: {
                update_contestant
            },
            statusCode: 200
        })

    }

    @Get('/')
    async get_contests(
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: pagination_validator
        })
        payload: { page: string, per_page: string }

    ){

        const page = parseInt( payload.page );

        const per_page = parseInt( payload.per_page );

        const contests = await this.repo.get_contests({ UserId: user.id }, page, per_page );

        return response({
            status: true,
            data: {
                ...contests
            },
            statusCode: 200
        })

    }

    @Get('/contestants')
    async get_contestants(
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_contestants_validator,
            type: "query"
        })
        payload: { page: string, per_page: string, ContestId: string, search: string }

    ){

        const page = parseInt( payload.page );

        const per_page = parseInt( payload.per_page );

        const ContestId = parseInt( payload.ContestId );

        const contestants = await this.repo.get_contestants({ UserId: user.id, ContestId }, page, per_page, payload.search );

        return response({
            status: true,
            data: {
                ...contestants
            },
            statusCode: 200
        })

    }

    @Delete('/contestant')
    async delete_contestant(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: id_validator('contestant_id'),
            type: "query"
        })
        payload: { contestant_id: number }

    ){

        await this.repo.delete_contestant({
            UserId: user.id,
            id: payload.contestant_id
        })

        return response({
            status: true,
            data: {},
            statusCode: 200
        })

    }

    @Get('/profile/banks')
    async list_banks(){

        const banks = await this.payment_service.list_banks();

        return response({
            status: true,
            data: {
                banks
            },
            statusCode: 200
        })
    }

    @Post('/profile/resolve-account')
    async resolve_bank_account(

        @RequestPayload({
            validator: resolve_bank_account_validator
        })
        payload: any

    ){

        const account_name = await this.service.resolve_bank_account_number( payload );

        return response({
            status: true,
            data: {
                account_name
            },
            statusCode: 200
        })

    }
    @Post('/profile')
    async upsert_organizer_profile(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: upsert_contest_organizer_profile_validator
        })
        payload: Partial<ContestOrganizerProfileInterface>

    ){

        payload.UserId = user.id;

        const updated_profile = await this.service.upsert_contest_organizer_profile(
            payload,
            {
                UserId: user.id
            }
        )

        return response({
            status: true,
            data: {
                updated_profile
            },
            statusCode: 200
        })

    }

    @Post('/whitelist/contestants')
    async get_contestants_with_slug(

        @RequestPayload({
            validator: get_contestants_with_slug_validator
        })
        payload: GetContestantsWithSlug

    ){

        const data = await this.service.get_contestants_with_slug( payload );

        return response({
            status: true,
            data: {
                ...data
            },
            statusCode: 200
        })

    }

    @Get('/whitelist/contestant')
    async get_contestant_with_slug(

        @RequestPayload({
            validator: id_validator_string("slug"),
            type: "query"
        })
        payload: { slug: string }

    ){

        const contestant = await this.repo.get_contestant({ slug: payload.slug });

        if( !contestant ) throw new NotFoundException("Contestant not found");

        const contest = await this.repo.get_contest({ id: contestant.ContestId }, ['voting_fee', 'id', 'slug', 'start_time', 'end_time', 'hide_live_votes']);

        let contest_fee = contest.voting_fee;

        let contest_start_time = contest.start_time;

        let contest_end_time = contest.end_time;

        let contest_slug = contest.slug;

        let total_vote;
        let total_votes;

        if (!contest.hide_live_votes){
            total_votes = await this.repo.get_contest_votes_count({
                ContestId: contest.id,
            })
    
            total_vote = await this.repo.get_contest_votes_count({
                ContestantId: contestant.id
            })
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                contestant,
                contest_fee,
                total_votes,
                total_vote,
                contest_start_time,
                contest_end_time,
                contest_slug
            }
        })

    }

    @Post('/whitelist/paymnet/fee')
    async get_voting_fee(

        @RequestPayload({
            validator: get_voting_fee_for_contest_validator
        })
        payload: any

    ){

        const fee = await this.service.get_voting_fee( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                fee
            }
        })

    }

    @Post('/whitelist/vote')
    async get_payment(

        @RequestPayload({
            validator: get_payment_link_for_contest,
        })
        payload: GetPaymentLinkForContest

    ){

        const payment_link = await this.service.getting_payment_link_for_contest( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                ...payment_link
            }
        })
    }

    @Post('/whitelist/payment/confirm')
    async confirm_payment(
        @RequestPayload({
            validator: id_validator_string('session_id'),
            type: "query"
        })
        payload: { session_id: string }
    ){

        const vote = await this.repo.get_contest_vote({
            session_id: payload.session_id
        }, ['id', 'ContestId']);

        let payment_confirmed_by_callback = false;

        let slug: string;

        if( vote ){
            let contest = await this.repo.get_contest({ id: vote.ContestId }, ['slug']);
            slug = contest.slug;
        }

        if(!Boolean(vote?.id)){
            const metadata = await payment_metadata_repo.get_by_session_id(payload.session_id)
            if(metadata){
                const transaction = await this.payment_service.fetch_transaction(metadata.id)
                if(transaction.status && transaction.data){
                    if(transaction.data.status === "success"){
                        payment_confirmed_by_callback = true;
                        slug = metadata.data.slug;
                        await this.service.process_contest_vote(metadata.data as ProcessContestVote)
                    }
                }
            }
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                confirmed: Boolean(vote?.id),
                slug,
                payment_confirmed_by_callback
            }
        });

    }

    @Get("/whitelist/metadata")
    async get_contest_metadata(
        @RequestPayload(
            {
                validator: id_validator_string("slug"),
                type: "query"
            }
        )
        payload: { slug: string }
    ){

        const contest = await this.repo.get_contest({ slug: payload.slug }, ['name', 'contest_image', 'start_time', 'end_time']);

        return response({
            status: true,
            statusCode: 200,
            data: {
                contest
            }
        })

    }

    @Post("/report")
    async get_contest_report(

        @RequestPayload({
            validator: id_validator("contest_id"),
        })
        payload: { contest_id: number },

        @User()
        user: UserModelInterface

    ){

        const _response = await this.service.generate_contest_revenue_report( user.id, payload.contest_id );

        return response({
            status: true,
            statusCode: 200,
            data: {
                ..._response
            }
        })

    }

    @Get("/whitelist/contestant/metadata")
    async get_contestant_metadata(
        @RequestPayload(
            {
                validator: id_validator_string("slug"),
                type: "query"
            }
        )
        payload: { slug: string }
    ){

        const contestant = await this.repo.get_contestant({ slug: payload.slug }, ['name', 'image', 'ContestId', 'bio']);

        const contest = await this.repo.get_contest({ id: contestant?.ContestId ?? 0 }, ['name', 'slug'])

        return response({
            status: true,
            statusCode: 200,
            data: {
                contest,
                contestant
            }
        })

    }


    @Post("/votes")
    async get_contest_votes(
        
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_contest_votes_validator
        })
        payload: any
    ){

        const _payload = {
            filter: {
                UserId: user.id,
                ContestId: payload.ContestId
            },
            page: payload.page,
            per_page: payload.per_page
        }

        const _response = await this.service.get_contest_votes( _payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                ..._response
            }
        })
    }

    @Post("/payout")
    async get_contest_payouts(
        
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_contest_votes_validator
        })
        payload: any
    ){

        const _response = await this.service.get_payouts({
            filter: {
                UserId: user.id,
                ContestId: payload.ContestId
            },
            page: payload.page,
            per_page: payload.per_page
        })

        return response({
            status: true,
            statusCode: 200,
            data: _response
        })
    }

    @Get('/profile')
    async get_organizer_profile(
        @User()
        user: UserModelInterface
    ){

        const organizer_profile = await this.service.get_oranizer_profile( user.id );

        return response({
            status: true,
            statusCode: 200,
            data: {
                organizer_profile
            }
        })

    }

    @Post("/whitelist/refund/bank-details")
    async add_bank_details_to_refund(

        @RequestPayload(
            {
                validator: add_bank_details_to_refund_validator
            }
        )
        payload: Pick<ContestVoteRefundModelInterface, "bank_code" | "bank_name" | "session_id" | "account_number">

    ){

        await this.service.add_bank_details_to_refund( payload );

        return response({
            status: true,
            statusCode: 201,
            data: {}
        })

    }

    @Get("/whitelist/refund")
    async get_refund(
        @RequestPayload({
            validator: id_validator_string("session_id"),
            type: "query"
        })
        payload: { session_id: string }
    ){

        const refund = await this.repo.get_vote_refund({ session_id: payload.session_id }, ['account_name', 'bank_name', "session_id", "transfer_status"])

        return response({
            status: true,
            statusCode: 200,
            data: {
                refund
            }
        })
    }

    @Get('/whitelist/banks')
    async _list_banks(){

        const banks = await this.payment_service.list_banks();

        return response({
            status: true,
            data: {
                banks
            },
            statusCode: 200
        })
    }


}