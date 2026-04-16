import { RequestPayload, User } from "@decorators/index";
import { UserModelInterface } from "@modules/user/type";
import { BadRequestException, Controller, Delete, ForbiddenException, Get, NotFoundException, Patch, Post, Request, UseInterceptors } from "@nestjs/common";
import { bulk_operation_validator, create_election_schema, create_voters_from_form_response_validator, create_voters_validator, delete_election_post_validator, edit_accreditation_form_validator, get_aggregated_votes_for_candidates_validator, get_candidates_validator, get_distict_voter_data_values_validator, get_election_post_with_candidate_count_validator, get_voters_with_filter_validator, get_votes_validator, save_election_result_validator, set_election_post_filter_attribute_validator, set_election_post_filter_value_validator, toggle_election_mode, toggle_election_result_visibility, update_election_validator, update_voter_validator, upsert_accreditation_question_validator, upsert_candidate_validator, upsert_election_post, verify_short_code_validator, voter_get_aggregated_votes_for_candidates_validator, voter_get_votes_validator } from "@validators/election";
import { UserAuthInterceptor } from "src/interceptors/auth";
import { ElectionService } from "./election.service";
import { response } from "@utils/response";
import { AccreditationFormModelInterface, AccreditationFormQuestionModelInterface, BulkOperationPayload, CandidateModelInterface, ElectionModelInrterface, ElectionPostModelInterface, GetPaginatedCandidates, VoterModelInterface } from "./type";
import { id_validator, id_validator_string, pagination_validator } from "@validators/utils";
import { ElectionRepository } from "./election.repo";
import { NotFoundError } from "rxjs";
import { VotersService } from "./voters/service";
import { VotersRepository } from "./voters/repo";
import { Request as ExpressRequest } from "express";
import { LOCAL_AUTHENTICATION_KEY } from "@env/index";
import { LocalAuthenticationKeyInterceptor } from "src/interceptors/local-auth";

@Controller('election')
@UseInterceptors(UserAuthInterceptor)
export class ElectionController {
    
    constructor(
        private service: ElectionService,
        private repo: ElectionRepository,
        private voters_service: VotersService,
        private voters_repo: VotersRepository
    ){}
    
    @Post('/')
    async create_election(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: create_election_schema
        })
        payload: ElectionModelInrterface
    ){

        console.log( user );

        payload.UserId = user.id;

        const election = await this.service.create_election( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                election
            }
        })

    }

    @Get('/')
    async get_elections_for_user(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: pagination_validator,
            type: "query"
        })
        payload: { page: string, per_page: string }
    ){

        const { page, per_page } = payload;

        const {elections, count} = await this.repo.get_elections_by_user_id(user.id, parseInt( page ), parseInt( per_page ), ['name', 'id', 'slug', 'election_date', 'start_time', 'end_time']);

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,  
                elections
            }
        })
    }

    @Patch('/')
    async update_election(
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: update_election_validator
        })
        payload: Partial<ElectionModelInrterface>
    ){

        const election_id = payload.id;

        const user_id =  user.id;

        delete payload.id;

        payload.UserId = user_id;

        const updated_election = await this.service.update_election( payload, { UserId: user_id, id: election_id });

        let election_post_filter_values: any;

        if( updated_election.toJSON().election_post_filter_attribute ){
            election_post_filter_values = await this.voters_repo.get_voters_data_values(
                { UserId: user_id, ElectionId: election_id },
                updated_election.toJSON().election_post_filter_attribute
            )
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                updated_election,
                election_post_filter_values
            }
        })

    }

    @Post('/post')
    async create_election_post(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: upsert_election_post
        })
        payload: ElectionPostModelInterface
    ){

        payload.UserId = user.id;

        let election_post;

        if( payload.id ) election_post = await this.service.edit_election_post( payload );

        else election_post = await this.service.create_election_post( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                election_post
            }
        })

    }

    @Get('/posts')
    async get_election_posts(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: id_validator('ElectionId'),
            type: "query"
        })
        payload: Pick<ElectionPostModelInterface, 'ElectionId'>
    ){

        const election_posts = await this.repo.get_election_posts_by_election_id_and_user_id( payload.ElectionId, user.id, ['title', 'title', 'id'] );

        return response({
            status: true,
            statusCode: 200,
            data: {
                election_posts
            }
        })

    }

    @Post('/candidate')
    async upsert_candatate(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: upsert_candidate_validator
        })
        payload: CandidateModelInterface
    ){

        payload.UserId = user.id;

        let candidate = await this.service.upsert_candidate( payload )

        return response({
            status: true,
            statusCode: 200,
            data: {
                candidate
            }
        })

    }

    @Delete('/post/:id/:ElectionId')
    async delete_election_post(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: delete_election_post_validator,
            type: "params"
        })
        payload: { id: string, ElectionId: string }
    ){

        const election_id = parseInt( payload.ElectionId );

        const election_post_id = parseInt( payload.id );

        await this.service.delete_election_post({
            ElectionPostId: election_post_id,
            ElectionId: election_id,
            UserId: user.id
        })
        
        return response({
            status: true,
            statusCode: 200,
            data: {}
        })

    }

    @Post('/candidates')
    async get_candidates(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: get_candidates_validator
        })
        payload: GetPaginatedCandidates
    ){

        const { page, per_page } = payload;

        const {candidates, count} = await this.repo.get_candidates({ UserId: user.id, ElectionId: payload.ElectionId }, page, per_page, ['name', 'image', 'ElectionPostId', 'id', 'bio'] );
        
        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                candidates
            }
        })

    }

    @Delete('/candidate/:id/:ElectionId')
    async delete_candidates(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: delete_election_post_validator,
            type: "params"
        })
        payload: { id: string, ElectionId: string }
    ){

        const candidate_id = parseInt( payload.id );

        const election_id = parseInt( payload.ElectionId );

        await this.service.validate_election({id: election_id, UserId: user.id})

        await this.repo.delete_candidate( candidate_id, user.id )
        
        return response({
            status: true,
            statusCode: 200,
            data: {}
        })

    }

    @Get('/accreditation/:id')
    async get_accreditation_form_and_question(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: id_validator("id"),
            type: "params"
        })
        payload: { id: string }
    ){

        const election_id = parseInt( payload.id );

        const accreditation_form_and_questions = await this.repo.get_accreditation_form_and_questions({ UserId: user.id, ElectionId: election_id });

        return response({
            status: true,
            statusCode: 200,
            data: {
                accreditation_form_and_questions
            }
        })

    }

    @Patch('/accreditation/form')
    async edit_accreditation_form(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: edit_accreditation_form_validator
        })
        payload: Partial<AccreditationFormModelInterface>
    ){

        await this.service.validate_election({ UserId: user.id, id: payload.ElectionId })

        payload.UserId = user.id;

        const accreditation_form = await this.repo.update_accrediation_form( payload, { UserId: user.id, id: payload.id, ElectionId: payload.ElectionId } );

        return response({
            status: true,
            data: {
                accreditation_form
            },
            statusCode: 200
        })

    }

    @Post('/accreditation/form/question')
    async upsert_accreditation_form_question(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: upsert_accreditation_question_validator
        })
        payload: AccreditationFormQuestionModelInterface
    ){
        payload.UserId = user.id;

        await this.service.validate_election({ UserId: payload.UserId, id: payload.ElectionId });

        let accreditation_form_question;

        if( payload.id )
            accreditation_form_question = await this.repo.update_accrediation_form_question(payload, { id: payload.id, AccreditationFormId: payload.AccreditationFormId, UserId: user.id, ElectionId: payload.ElectionId })

        else accreditation_form_question = await this.service.create_accreditation_form_question( payload );

        return response({
            status: true,
            data: {
                accreditation_form_question
            },
            statusCode: 200
        })
    }

    @Delete('/accreditation/form/question/:id/:ElectionId')
    async delete_accreditation_form_question(
        @User()
        user: UserModelInterface,
        
        @RequestPayload({
            validator: delete_election_post_validator,
            type: "params"
        })
        payload: { id: string, ElectionId: string }
    ){

        await this.service.validate_election({UserId: user.id, id: parseInt(payload.ElectionId) })

        const question_id = parseInt( payload.id );

        await this.repo.delete_accreditation_question( question_id, user.id )

        return response({
            status: true,
            data: {},
            statusCode: 200
        })
    }

    @Post("/whitelist/accreditation/response")
    async create_voters_from_form_response(
        @RequestPayload({
            validator: create_voters_from_form_response_validator
        })
        payload: any
    ){

        const [ election, accreditation_form ] = await Promise.all([

            this.repo.get_one_election_by_filter({slug: payload.slug}, ["id", "UserId"]),

            this.repo.get_accreditation_form({ id: payload.accreditation_form_id }, ['is_accepting_response'])

        ])

        if( accreditation_form.is_accepting_response === false ) throw new ForbiddenException("Form is no longer accepting response");

        delete payload.slug;

        if( !election ) throw new NotFoundException("Election not found");

        payload.ElectionId = election.id;

        payload.UserId = election.UserId;

        const voter = await this.voters_service.create_voter( payload );

        delete voter.password;

        return response({
            status: true,
            statusCode: 200,
            data: {
                voter
            }
        })

    }

    @Post("/voter")
    async create_voter(
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: create_voters_validator
        })
        payload: any
    ){

        const election = await this.service.validate_election({ UserId: user.id, id: payload.ElectionId })

        payload.UserId = election.UserId;

        const voter = await this.voters_service.create_voter( payload );

        delete voter.password;

        return response({
            status: true,
            statusCode: 200,
            data: {
                voter
            }
        })

    }

    @Post("/voter/filter")
    async get_voters_with_filter(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_voters_with_filter_validator
        })
        payload: Parameters<typeof this.service.get_voters_with_filter >[0]
    ){

        payload.UserId = user.id;

        const data = await this.service.get_voters_with_filter( payload )

        return response({
            status: true,
            statusCode: 200,
            data
        })

    }
    
    @Patch("/voter")
    async update_voter(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: update_voter_validator
        })
        payload: any

    ){

       const voter_id = payload.voter_id;

       await this.service.validate_election({ UserId: user.id, id: parseInt(payload.ElectionId) })

       delete payload.voter_id;

       if( payload.email ){

        const existing_voter = await this.voters_repo.get_voter_by_filter({ email: payload.email },['id']);

        if( existing_voter ) throw new BadRequestException("Email taken");

       }

       const updated_voter = await this.voters_repo.update_voter(
         {
           id: voter_id,
           ElectionId: payload.ElectionId,
           UserId: user.id,
         },
         payload,
       );

       return response({
         status: true,
         data: {
           updated_voter,
         },
         statusCode: 200,
       });

    }

    @Post("/post/candidates")
    async get_election_post_with_candidate_count(
        @RequestPayload({
            validator: get_election_post_with_candidate_count_validator
        })
        payload: any,

        @User()
        user: UserModelInterface
    ){

        const { ElectionId, page, per_page } = payload;

        const election = await this.repo.get_one_election_by_filter({ id: ElectionId, UserId: user.id }, ['mode', 'voters_acquisition_channel', 'indexed_voters_attributes', 'election_post_filter_attribute'])

        const {election_posts, count } = await this.repo.get_election_post_with_candidate_count({ ElectionId, UserId: user.id }, page, per_page);

        let election_post_filter_attributes: string[]

        let election_post_filter_values: string[]

        if( !election )
            throw new NotFoundException('Election not found!')

        if( election.voters_acquisition_channel !== null ){
            if( election.voters_acquisition_channel === 'csv' ){
                election_post_filter_attributes = election.indexed_voters_attributes
            }
            else {
                const accreditation_form = await this.repo.get_accreditation_form({
                    ElectionId
                }, ['id'])
                if(accreditation_form){
                    const accreditation_form_questions = await this.repo.get_accreditation_form_questions({
                        AccreditationFormId: accreditation_form.id
                    }, ['label'])
                    election_post_filter_attributes = accreditation_form_questions.map( _ => _.toJSON().label ).filter(Boolean)
                } 
            }
        }

        if ( election.election_post_filter_attribute ){
            const values = await this.voters_repo.get_voters_data_values({
                ElectionId,
                UserId: user.id
            }, election.election_post_filter_attribute)
            election_post_filter_values = values as any
        }

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                election_posts,
                election_mode: election.mode,
                election_post_filter_attributes,
                election_post_filter_values
            }
        })
    }

    @Delete("/voters/:id")
    async delete_all_voters(
        
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: id_validator("id"),
            type: "params"
        })
        payload: { id: string }
        
    ){

       await this.service.delete_all_voters( parseInt(payload.id), user.id )

        return response({
            status: true,
            data: {},
            statusCode: 200
        })

    }

    @Delete("/voter/:id/:ElectionId")
    async delete_voter(
        
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: delete_election_post_validator,
            type: "params"
        })
        payload: { id: string, ElectionId: string }
        
    ){

        const election_id = parseInt( payload.ElectionId )

        const voter_id = parseInt( payload.id );

        await this.service.delete_voter( voter_id, user.id, election_id );

        return response({
            status: true,
            data: {},
            statusCode: 200
        })

    }

    @Post("/voters/bulk")
    async perform_operation_on_voters(
        
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: bulk_operation_validator
        })
        payload: BulkOperationPayload
        
    ){

        payload.UserId = user.id;

        const service_response = await this.voters_service.perform_operation_on_voters( payload );

        return response({
            status: true,
            data: {
                service_response
            },
            statusCode: 200
        })

    }

    @Post('/voters/distinct-values')
    async get_distict_voter_data_values(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_distict_voter_data_values_validator
        })
        payload: { key: string, ElectionId: number }

    ){

        console.log( user )

        const values = await this.service.get_distict_voter_data_values({
            key: payload.key,
            filter: {
                ElectionId: payload.ElectionId,
                UserId: user.id
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
        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "params"
        })
        payload: { election_id: string }
    ){

        const election_id = parseInt(payload.election_id);

        const _response = await this.service.get_first_set_of_votes({
            ElectionId: election_id,
            UserId: user.id
        })

        return response({
            status: true,
            statusCode: 200,
            data: _response
        })

    }

    @Post('/results')
    async get_votes(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_votes_validator
        })
        payload: Parameters<typeof this.service.get_votes>[0]
    ){

        payload.UserId = user.id;

        const result = await this.service.get_votes(payload);

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

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: get_aggregated_votes_for_candidates_validator
        })
        payload: Parameters<typeof this.service.get_aggregated_votes_for_candidates>[0]

    ){
        
        payload.UserId = user.id;

        const result = await this.service.get_aggregated_votes_for_candidates(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Get('/whitelist/results/first/:slug')
    async get_first_set_of_votes_for_voters(

        @RequestPayload({
            validator: id_validator_string('slug'),
            type: "params"
        })
        payload: { slug: string }

    ){

        const { votes, election_posts, indexed_attributes, Election } = await this.service.get_first_set_of_votes_for_voters( payload.slug )
       
        return response({
            status: true,
            statusCode: 200,
            data: {
                votes,
                election_posts,
                indexed_attributes,
                Election
            }
        })

    }

    @Post('/whitelist/results')
    async get_votes_for_voters(

        @RequestPayload({
            validator: voter_get_votes_validator
        })
        payload: Parameters<typeof this.service.get_votes_for_voters>[0]

    ){

        const result = await this.service.get_votes_for_voters(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Post("/whitelist/results/candidate/aggregate")
    async get_aggregated_votes_for_votes(

        @RequestPayload({
            validator: voter_get_aggregated_votes_for_candidates_validator
        })
        payload: Parameters<typeof this.service.get_aggregated_votes_for_voters>[0]
        
    ){

        const result = await this.service.get_aggregated_votes_for_voters(payload);

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Get('/results/export')
    async export_result(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "query"
        })
        payload: any

    ){

        const {message, link } = await this.service.send_result( payload.election_id, user );

        return response({
            status: true,
            message,
            data: { link },
            statusCode: 200
        })

    }

    @Get('/whitelist/metadata')
    async get_election_metadata(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: 'query'
        })
        payload: { slug: string }
    ){

        const { slug } = payload;

        const election = await this.service.get_cached_election_by_slug( slug );

        return response({
          status: true,
          data: {
            election: {
              name: election?.name,
              election_date: election?.election_date,
              start_time: election?.start_time,
              end_time: election?.end_time,
            },
          },
          statusCode: 200,
        });

    }

    @Patch("/reset")
    async reset_election(

        @User()
        user: UserModelInterface,

        @RequestPayload({
            validator: id_validator('election_id'),
            type: "query"
        })
        payload: any

    ){

        await this.service.reset_demo_election({
            ElectionId: payload.election_id,
            UserId: user.id
        })

        return response({
            status: true,
            message: "Operation successful",
            data: {},
            statusCode: 200
        })
        
    }

    @Patch("/result/visibility")
    async toggle_result_visibility(

        @RequestPayload({
            validator: toggle_election_result_visibility
        })
        payload: { ElectionId: number, value: boolean },

        @User()
        user: UserModelInterface

    ){

        const _response = await this.service.toggle_result_visibility({
            UserId: user.id,
            id: payload.ElectionId,
        }, payload.value );

        
        return response({
            status: true,
            statusCode: 200,
            data: _response
        })

    }

    @Patch('/mode')
    async toggle_election_mode(

        @RequestPayload({
            validator: toggle_election_mode
        })
        payload: { ElectionId: string, mode: ElectionModelInrterface['mode'] },

        @User()
        user: UserModelInterface
    ){

        const _response = await this.service.toggle_election_mode({
            UserId: user.id!,
            id: parseInt(payload.ElectionId!)
        }, payload.mode )

        return response({
            status: true,
            statusCode: 200,
            data: _response
        })
    }

    @Post('/short-code')
    async get_voters_short_code(

        @RequestPayload({
            validator: id_validator('ElectionId')
        })
        payload: { ElectionId: string },

        @User()
        user: UserModelInterface
    ){

        const _response = await this.service.generate_voters_short_code({
            UserId: user.id!,
            id: parseInt(payload.ElectionId!)
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                short_code: _response
            }
        })
    }

    @Post('/whitelist/short-code/verify')
    async verify_short_code(

        @RequestPayload({
            validator: verify_short_code_validator,
            type: 'query'
        })
        payload: { short_code: string, token: string },

    ){

        const TURNSTILE_TOKEN_IS_VALID = await this.service.verify_short_code( payload.short_code );

        if( !TURNSTILE_TOKEN_IS_VALID ) throw new BadRequestException("Unable to verify captcha");

        await this.service.verify_short_code( payload.short_code );

        return response({
            status: true,
            statusCode: 200,
            data: {
                is_valid: true
            }
        })
    }

    @Get('/whitelist/election/result/full')
    @UseInterceptors(LocalAuthenticationKeyInterceptor)
    async get_full_result(

        @RequestPayload({
            validator: id_validator('election_id'),
            type: 'query'
        })
        payload: { election_id: number },

    ){

        const data = await this.service.get_data( payload.election_id );

        return response({
            status: true,
            statusCode: 200,
            data: {
                data
            }
        })
    }

    @Post('/whitelist/result/save')
    @UseInterceptors(LocalAuthenticationKeyInterceptor)
    async save_election_result(

        @RequestPayload({
            validator: save_election_result_validator
        })
        payload: any

    ){

        await this.service.save_result( payload.election_id, payload.result );

        return response({
            status: true,
            data: {},
            statusCode: 200
        })

    }
    // async get_elections(){}

    // async get_election(){}
}