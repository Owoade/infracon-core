import { RequestPayload } from "@decorators/index";
import { AuthenticationService } from "@modules/core/auth/auth.service";
import { ElectionRepository } from "@modules/election/election.repo";
import { ElectionService } from "@modules/election/election.service";
import { GetElectionsWithUserInfo, GetPaginatedCandidates, VoterModelInterface } from "@modules/election/type";
import { Controller, Get, NotFoundException, Patch, Post, Query, Response, UseInterceptors } from "@nestjs/common";
import { response } from "@utils/response";
import { create_voters_validator, get_aggregated_votes_for_candidates_validator, get_candidates_validator, get_distict_voter_data_values_validator, get_election_post_with_candidate_count_validator, get_election_with_user_info_validator, get_voters_with_filter_validator, get_votes_validator, send_bulk_emails_validator } from "@validators/election";
import { id_validator, id_validator_string, pagination_validator } from "@validators/utils";
import { SuperAdminAuthInterceptor } from "src/interceptors/super-admin-auth";
import { SuperAdminService } from "../service";
import { Response as ExpressResponse } from "express";
import { createReadStream } from "fs";
import { VotersService } from "@modules/election/voters/service";
import { VotersRepository } from "@modules/election/voters/repo";
import { insert_voter } from "@validators/voters";

@Controller('superadmin/election')
@UseInterceptors(SuperAdminAuthInterceptor)
export class ElectionManagementController {

    constructor(
        private election_repo: ElectionRepository,
        private election_service: ElectionService,
        private service: SuperAdminService,
        private voter_service: VotersService,
        private voter_repo: VotersRepository,
        // private auth_service: AuthenticationService
    ){}

    @Post('/')
    async get_elections(
        @RequestPayload({
            validator: get_election_with_user_info_validator,
        })
        payload: GetElectionsWithUserInfo
    ){

        payload.attributes = ['name', 'election_date', 'start_time', 'end_time', 'id', 'UserId'];

        payload.user_attributes = ['email'];

        const { count, elections } = await this.election_repo.get_elections_with_user_info( payload );

        return response({
            status: true, 
            statusCode: 200,
            data: {
                count,
                elections
            }
        })

    }

    @Post("/post/candidates")
    async get_election_info(

        @RequestPayload({
            validator: get_election_post_with_candidate_count_validator
        })
        payload: any,

        @Query()
        query: any

    ){

        const { ElectionId, page, per_page } = payload;

        let filter = { ElectionId }

        const {election_posts, count} = await this.election_repo.get_election_post_with_candidate_count({ ElectionId }, page, per_page);

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                election_posts
            }
        })

    }

    @Patch('/activity/:ElectionId')
    async toggle_election_activity(

        @RequestPayload({
            validator: id_validator("ElectionId"),
            type: "params"
        })
        payload: any

    ){

        const { ElectionId } = payload;

        const election = await this.election_repo.get_one_election_by_filter({ id: ElectionId }, ['is_disabled',]);

        if( !election ) throw new NotFoundException('Election not found!');

        const updated_election = await this.election_repo.update_election({ is_disabled: !election.is_disabled }, { id: ElectionId });

        return response({
            status: true,
            statusCode: 200,
            data: {
                updated_election
            }
        })
    }

    @Post('/candidates')
    async get_candidates(

        @RequestPayload({
            validator: get_candidates_validator
        })
        payload: GetPaginatedCandidates

    ){

        const { ElectionId, page, per_page } = payload;

        const { count, candidates } = await this.election_repo.get_candidates({ ElectionId }, page, per_page );

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                candidates
            }
        })
    }

    @Post("/voter/filter")
    async get_voters_with_filter(

        @RequestPayload({
            validator: get_voters_with_filter_validator
        })
        payload: Parameters<typeof this.election_service.get_voters_with_filter >[0]
    ){

        const data = await this.election_service.get_voters_with_filter( payload )

        return response({
            status: true,
            statusCode: 200,
            data
        })

    }

    @Post('/voters/distinct-values/:UserId')
    async get_distict_voter_data_values(

        @RequestPayload({
            validator: get_distict_voter_data_values_validator
        })
        payload: { key: string, ElectionId: number },

        @RequestPayload({
            validator: id_validator('UserId'),
            type: "params"
        })
        params: { UserId: number }

    ){

        const values = await this.election_service.get_distict_voter_data_values({
            key: payload.key,
            filter: {
                ElectionId: payload.ElectionId,
                UserId: params.UserId
            }
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                values
            }
        })

    }

    @Get('/results/first/:election_id')
    async get_first_set_of_votes(

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "params"
        })
        payload: { election_id: string },

        @RequestPayload({
            validator: id_validator('UserId'),
            type: "query"
        })
        params: { UserId: number }

    ){

        const election_id = parseInt(payload.election_id);

        const _response = await this.election_service.get_first_set_of_votes({
            ElectionId: election_id,
            UserId: params.UserId
        })

        return response({
            status: true,
            statusCode: 200,
            data: _response
        })

    }

    @Post('/results')
    async get_votes(

        @RequestPayload({
            validator: get_votes_validator
        })
        payload: Parameters<typeof this.election_service.get_votes>[0],

        @RequestPayload({
            validator: id_validator('UserId'),
            type: "query"
        })
        query: { UserId: number }
    ){

        payload.UserId = query.UserId;

        const result = await this.election_service.get_votes(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Post("/results/candidate/aggregate")
    async get_aggregated_votes(

        @RequestPayload({
            validator: get_aggregated_votes_for_candidates_validator
        })
        payload: Parameters<typeof this.election_service.get_aggregated_votes_for_candidates>[0],

        @RequestPayload({
            validator: id_validator('UserId'),
            type: "query"
        })
        query: { UserId: number }

    ){

        payload.UserId = query.UserId;

        const result = await this.election_service.get_aggregated_votes_for_candidates(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Post('/result/export')
    async send_result(

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "query"
        })
        query: { election_id: number }

    ){

        const { message, link } = await this.service.send_result( query.election_id );

        return response({
            status: true,
            statusCode: 200,
            message,
            data: {
                link
            }
        })
    }

    @Get('/result/local')
    async get_result(

        @RequestPayload({
            validator: id_validator_string('file_name'),
            type: "query"
        })
        query: { file_name: string },

        @Response()
        res: ExpressResponse

    ){

        try {

            const file_stream = createReadStream(query.file_name)

            file_stream.pipe(res);

        }

        catch(e){
            console.log(e);
        }
    }

    @Post('/create-voter-send-credentials')
    async create_voter_and_send_credentials(
        @RequestPayload({
            validator: create_voters_validator
        })
        payload: any
    ){

        const response = await this.election_service.proxy__create_voter_and_send_credentials( payload );

        return response;

    }

    @Post('/password')
    async correct_password(
        @RequestPayload({
            validator: create_voters_validator
        })
        payload: any
    ){

        const response = await this.election_service.proxy__correct_password_issue( payload );

        return response;

    }

    @Post('/bulk-email')
    async send_bulk(
        @RequestPayload({
            validator: send_bulk_emails_validator
        })
        payload: any
    ){

        await this.voter_service.send_bulk_email(payload);

        return null


    }

    @Post('/voter')
    async insert_voter(
        @RequestPayload({
            validator: insert_voter
        })
        payload: { voter: VoterModelInterface }
    ){

        const voter = await this.voter_service.create_voter( payload.voter )

        return null
    }

    @Get('/voters/:election_id')
    async get_voter(
        @RequestPayload({
            validator: id_validator("election_id"),
            type: "params"
        })
        payload: { election_id: string }
    ){

        const voters = await this.voter_repo.get_voters_by_filter({ElectionId: parseInt(payload.election_id)})

        return voters
    }

    // @Post('/broadcast')
    // async broadcast_voters_credentials(){
    //     return await this.election_service.proxy__process_election_broadcast();
    // }

    // @Get('/')
    // async election(){
    //     return await this.election_service.proxy__election()
    // }

    @Get('/broadcast/single')
    async boradcast_single(){
        return await this.election_service.proxy__broadcast_single_election()
    }


}