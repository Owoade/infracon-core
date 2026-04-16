import { BadRequestException, Controller, ForbiddenException, Get, NotFoundException, Post, Req, Res, UseInterceptors } from "@nestjs/common";
import { ElectionRepository } from "../election.repo";
import { VotersService } from "./service";
import { RequestPayload, Voter } from "@decorators/index";
import { id_validator, id_validator_string } from "@validators/utils";
import { authenticate_voters_validator, cast_vote_validator, create_voters_from_accreditation_form_validator, create_voters_from_accreditation_form_validator_with_short_code } from "@validators/voters";
import { AuthenticateVoters, CastVote, CreateVotersFromAccreditationForm, CreateVotersFromAccreditationFormWithShortCode, GetAccreditedVoters, VoterModelInterface } from "../type";
import { Response } from "express";
import { AuthenticationService } from "@modules/core/auth/auth.service";
import { response } from "@utils/response";
import { VoterAuthInterceptor } from "src/interceptors/voter.auth";
import { VotersRepository } from "./repo";
import { get_accredited_voters_validator } from "@validators/election";

@Controller('voter')
@UseInterceptors(VoterAuthInterceptor)
export class VoterController {
    
    constructor(
        private election_repo: ElectionRepository,
        private service: VotersService,
        private  auth_service: AuthenticationService,
        private repo: VotersRepository
    ){}

    @Get('/accreditation')
    async get_accreditation_form(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: 'query'
        })
        payload: { slug: string }
    ){

        const accreditation_form_and_questions = await this.service.get_accreditation_form( payload.slug );

        return response({
            status: true,
            statusCode: 200,
            data: {
                accreditation_form_and_questions
            }
        });

    }

    @Get('/accreditation/short-code')
    async get_accreditation_form_with_short_code(

        @RequestPayload({
            validator: id_validator('short_code'),
            type: "query"
        })
        payload: { short_code: string },

    ){

        const _response = await this.service.get_accreditation_form_with_short_code( payload.short_code );

        return response({
            status: true,
            statusCode: 200,
            data: _response
        })

    }


    @Post('/accreditation')
    async create_voter_from_accreditation_form(
        @RequestPayload({
            validator: create_voters_from_accreditation_form_validator,
        })
        payload: CreateVotersFromAccreditationForm
    ){

        const voter = await this.service.create_voter_from_accreditation_form_with_slug(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                voter
            }
        });

    }

    @Post('/accreditation/short-code')
    async create_voter_from_accreditation_form_with_short_code(
        @RequestPayload({
            validator: create_voters_from_accreditation_form_validator_with_short_code,
        })
        payload: CreateVotersFromAccreditationFormWithShortCode
    ){

        const voter = await this.service.create_voter_from_accreditation_form_with_short_code(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                ...voter
            }
        });

    }

    @Get('/election/:slug')
    async get_election_from_slug(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: 'params'
        })
        payload: { slug: string }
    ){

        const election = await this.service.get_election_from_slug(payload.slug)

        return response({
            status: true,
            statusCode: 200,
            data: {
                election
            }
        })

    }

    @Post('/auth')
    async authenticate_voters(
        @RequestPayload({
            validator: authenticate_voters_validator,
        })
        payload: AuthenticateVoters,

        @Res({ passthrough: true })
        res: Response

    ){

        const _response = await this.service.authenticate_voter( payload );

        const token = await this.auth_service.sign_token({ id: _response.voter.id, slug: _response.slug });

        res.cookie('token', token, { path: '/', sameSite: false, maxAge: 3600,});

        (_response as any).token = token;

        return response({
            status: true,
            statusCode: 200, 
            data: {
                _response
            }
        })
        
    }

    @Get('/action/candidates')
    async get_candidates(
        @Voter()
        voter: VoterModelInterface
    ){

        const { candidates, election_name, end_time } = await this.service.get_candidates_for_voter( voter )

        return response({
            status: true,
            statusCode: 200,
            data: {
                candidates,
                election_name,
                election_end_time: end_time
            }
        })

    }

    @Get('/action/verify-token')
    async verify_token(
        @Voter()
        voter: VoterModelInterface
    ){

       return response({
        status: true,
        statusCode: 200,
        message: "token verified",
        data: {
            voter
        }
       })

    }

    @Post('/action/vote')
    async vote(
        @Voter()
        voter: VoterModelInterface,

        @RequestPayload({
            validator: cast_vote_validator
        })
        payload: CastVote
    ){

        console.log( voter )

        await this.service.cast_vote( payload, voter );

        return response({
            status: true,
            statusCode: 200,
            data: {},
            message: "Congratulations, you have successfully voted"
        })
        
    }

    @Post('/accreditation/all')
    async get_accredited_voters(
        @RequestPayload({
            validator: get_accredited_voters_validator
        })
        payload: GetAccreditedVoters
    ){

        const data = await this.service.get_accredited_voters( payload );

        return response({
            status: true,
            statusCode: 200,
            data
        })

    }

    @Get('/accreditation/all/values')
    async get_voter_distinct_attribute(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: "query"
        })
        payload: { slug: string }
    ){

        const data = await this.service.get_voter_distinct_attribute(payload.slug)

        return response({
            status: true,
            statusCode: 200,
            data
        })

    }
    
}