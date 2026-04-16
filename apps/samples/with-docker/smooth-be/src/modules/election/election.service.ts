import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, UseInterceptors } from "@nestjs/common";
import { ElectionRepository } from "./election.repo";
import slugify from "slugify";
import * as crypto from "crypto";
import { AccreditationFormModelInterface, AccreditationFormQuestionModelInterface, BulkOperationPayload, CandidateModelInterface, DeleteElectionPost, ElectionAuthPayload, ElectionModelInrterface, ElectionPostModelInterface, GetAggregatedVotesForVoters, GetIndexedAttributeDistinctValues, GetVotersDistinctDataValues, GetVotersWithFilter, GetVotersWithFilterServicePayload, SendBulkEmails, SendResultFlag, VoteModelInterface, VoterModelInterface } from "./type";
import { StorageService } from "@modules/core/storage/storage.service";
import { InjectQueue } from "@nestjs/bullmq";
import { EXPORT_RESULT_QUEUE, LOG_QUEUE, VOTE_QUEUE, VOTERS_AUTH_EMAIL_QUEUE, VOTERS_POPULATION_QUEUE } from "src/queue/config";
import { Queue } from "bull";
import { JobRepository } from "@modules/core/job/job.repo";
import * as moment from "moment";
import { VoterAuthEmailOperationPayload } from "src/queue/workers/voters/email";
import { CLOUDFLARE_TURNSTILE_SECRET_KEY, NODE_ENV, VOTER_PLATFORM } from "@env/index";
import { BillingRepository } from "@modules/billing/billing.repo";
import db from "@db/postgres/index";
import { Transaction } from "sequelize";
import { Cron } from "@nestjs/schedule";
import { redis_client } from "@cache/index";
import { VotersRepository } from "./voters/repo";
import { election_post_schema } from "@validators/election";
import { LogModelInterface } from "@modules/core/gateway/logging/type";
import { VotersService } from "./voters/service";
import { SendResultPayload } from "@modules/core/email/template/result";
import { UserModelInterface } from "@modules/user/type";
import * as OTP from "otp-generator";
import axios from "axios";
import { ElectionData, ElectionResult } from "@queue/workers/results/type";
import { ChildOf } from "@utils/schema";


@Injectable()
export class ElectionService {

    private logger = new Logger(ElectionService.name)

    constructor(

        private repo: ElectionRepository,
        private storage_service: StorageService,

        @InjectQueue(VOTERS_POPULATION_QUEUE)
        private voters_population_queue: Queue,

        private job_repository: JobRepository,

        private billing_repository: BillingRepository,

        private voters_repository: VotersRepository,

        @Inject(forwardRef(()=>VotersService))
        private voters_service: VotersService,

        @InjectQueue(LOG_QUEUE)
        private log_queue: Queue<LogModelInterface>,

        @InjectQueue(EXPORT_RESULT_QUEUE)
        private export_result_queue: Queue,

        @InjectQueue(VOTE_QUEUE)
        private vote_queue: Queue

    ){}

    async create_election( payload: ElectionModelInrterface ){

        const billing = await this.billing_repository.get_last_billing({ ElectionId: null, UserId: payload.UserId }, ['id', 'type', 'no_of_months']);

        console.log(billing);

        if( !billing ) throw new NotFoundException("Billing not found");

        const current_date = moment();

        const election_date = moment( payload.election_date );

        const days_ahead = election_date.diff(current_date, "days");

        if( days_ahead < 1 && billing.type === "paid" ) throw new BadRequestException("Election date must be atleast two days ahead of today");

        if( days_ahead < 0 && billing.type === "free" ) throw new BadRequestException("Election date can't be in the past");

        if( billing.type === "free" ) payload.has_sent_broadcast = true;

        payload.broadcast_date = election_date.startOf('day').toISOString();

        payload.result_is_visible = false;

        payload.mode = "online";

       let slug = slugify(payload.name.replace(/\b[Ee]lections?\b/g, ""), {
            strict: true,
            lower: true,
            replacement: '-',
            trim: true
        })

        const existing_election = await this.repo.get_one_election_by_filter({ slug }, ['id']);

        if( existing_election ){
        
            const variable = crypto.randomInt(10, 99);

            slug += `-${variable}`;

        }

        slug = slug.replace("-sandbox", "");

        payload.slug = NODE_ENV === "production" ? slug : `${slug}-sandbox`;

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        })

        try {

            const election = await this.repo.create_election( payload, transaction );

            const billing_payload = {
                ElectionId: election.id,
                ...( billing.type === "paid" ? { expires_at: moment().add( billing.no_of_months, 'months' ).toISOString() } : {} )
            }

            await Promise.all([

                this.billing_repository.update_billing( billing_payload, { id: billing.id }, transaction ),

                this.log_queue.add({
                    UserId: election.UserId,
                    type: "election",
                    description: `User created an election "${election.name}"`
                })

            ])

            await transaction.commit();
    
            return election;

        }

        catch(e){

            console.error(e);

            await transaction.rollback();

            throw new InternalServerErrorException("Something went wrong");

        }

       

    }

    async update_election( update: Partial<ElectionModelInrterface>, filter: Partial<ElectionModelInrterface> ){

        const election = await this.validate_election({ UserId: filter.UserId, id: filter.id })

        if( update.csv_file )
            update.csv_file.link = update.csv_file.link.replace("https://smooth-ballot.s3.eu-north-1.amazonaws.com", "https://storage.smoothballot.com");

        const voters_count = await this.voters_repository.get_voters_count({
            ElectionId: filter.id,
            UserId: filter.UserId
        })

        if( update.election_date ){

            const current_date = moment();

            console.log(current_date.toISOString())

            const election_date = moment( update.election_date );

            const days_ahead = election_date.diff(current_date, "day");

            if( days_ahead < 1 && !election.has_sent_broadcast ) throw new BadRequestException("Election date must be atleast a day ahead of today");

            update.broadcast_date = election_date.startOf('day').toISOString();

        }

        if( update.name && update.name !== election.name ){

            let slug = slugify(update.name.replace(/\b[Ee]lections?\b/g, ""), {
                strict: true,
                lower: true,
                replacement: '-',
                trim: true
            })

            const existing_election = await this.repo.get_one_election_by_filter({ slug }, ['id']);

            if( existing_election && existing_election.id !== filter.id ){
                    
                const variable = crypto.randomInt(10, 99);
    
                slug += `-${variable}`;

                slug = slug.replace("-sbsandbox", "");
    
                update.slug = NODE_ENV === "production" ? slug : `${slug}-sbsandbox`;
            
            }

        }

        if( update.end_time || update.start_time ){

            if( !election.election_date && !update.election_date )
                throw new BadRequestException('Please ensure that the election date is set before specifying the start or end time.');

            if( update.end_time ){

                if( !election.start_time && !update.start_time )
                    throw new BadRequestException('Please ensure that the start time is set before specifying end time.') 

                const end_time_hour = moment( update.end_time ).hour();

                const end_time_min = moment( update.end_time ).minutes();

                const start_time_hour = moment( update.start_time ?? election.end_time ).hour();

                if( end_time_hour < start_time_hour )
                    throw new BadRequestException('Election end time can not be lesser than start time');

                update.end_time = moment(update.election_date ?? election.election_date).startOf('day').add( end_time_hour, 'hours' ).add(end_time_min, 'minutes').toISOString();

            }

            if( update.start_time ){

                const start_time_hour = moment( update.start_time ?? election.end_time ).hour();

                const start_time_min = moment( update.start_time ?? election.end_time ).minutes();

                update.start_time = moment( update.election_date ?? election.election_date ).startOf('day').add(start_time_hour, 'hours').add(start_time_min, 'minutes').toISOString();

            }

            const ELECTION_DATE_HAS_PASSED = moment().startOf("day").diff(moment(update.election_date ?? election.election_date)) > 0;

            if( ELECTION_DATE_HAS_PASSED )
                throw new ForbiddenException("Election date has passed");
            
        }

        if( election.voters_acquisition_channel !== null && election.voters_acquisition_channel !== update.voters_acquisition_channel )
            delete update.voters_acquisition_channel

        if( election.voters_acquisition_channel === null && update.voters_acquisition_channel === "form" ){

            const existing_accreditation_form = await this.repo.get_accreditation_form({ ElectionId: filter.id }, ['id']);

            if( !existing_accreditation_form ){

                const accreditation_form = await this.repo.create_accreditation_form({ ElectionId: filter.id, is_accepting_response: true, UserId: update.UserId } );

                await this.repo.create_accreditation_form_question({ AccreditationFormId: accreditation_form.id, UserId: filter.UserId, ElectionId: filter.id  })  

            }

        }

        if( update?.name && update?.name !== election.name ){

            let slug = slugify(update.name.replace(/\b[Ee]lections?\b/g, ""), {
                strict: true,
                lower: true,
                replacement: '-',
                trim: true
            })

            const existing_election_with_same_slug = await this.repo.get_one_election_by_filter({ slug }, ['id']);

            if( existing_election_with_same_slug ){

                const variable = crypto.randomInt(10, 99);

                slug += `-${variable}`;
    
            }
            
            update.slug = slug;

        }

        console.log( update.csv_file, election.voters_acquisition_channel !== "form", election,  update)

        if( (update.csv_file && !election.csv_file && voters_count === 0)){

            console.log(">>>>>> Populating voters")

            const job = await this.job_repository.create({
                Userid: filter.UserId,
                status: "pending",
                _election_id: filter.id,
                type: "voters-population",
                payload: {
                    csv:  update.csv_file
                }
            })
            
            await this.voters_population_queue.add({
                job_id: job.id,
                file_id: update.csv_file.id,
                election_id: filter.id,
                csv_url: update.csv_file.link,
                user_id: filter.UserId,
            })

            if( election.csv_file ) {
                
                this.storage_service.delete_file(election.csv_file.id);
                
            }

        }

        else {

            if( update.csv_file ){

                await this.storage_service.delete_file( update.csv_file.id );

                delete update.csv_file;

            }
            
        }

        if( update.election_post_filter_attribute ){

            if(!election.voters_acquisition_channel){
                throw new BadRequestException('Voters acquisition channel not set')
            } 
            console.log(election.voters_acquisition_channel)
            if( 
                election.voters_acquisition_channel === 'csv' 
                && !election.indexed_voters_attributes.includes(update.election_post_filter_attribute)
            ){
                throw new ForbiddenException('Invalid csv attribute')
            }

            if( election.voters_acquisition_channel === 'form' ){
                const accreditation_form = await this.repo.get_accreditation_form({
                    ElectionId: filter.id
                }, ['id'])

                if(!accreditation_form)
                    throw new NotFoundException("Accreditation form not found")

                const existing_label = await this.repo.get_accreditation_form_questions({
                    label: update.election_post_filter_attribute,
                    AccreditationFormId: accreditation_form.id
                }, ['label'])

                if( !existing_label )
                    throw new NotFoundException("Accreditation form label doesn't exist")
    
            }

        }

        const updated_election = await this.repo.update_election( update, filter );

        await Promise.all([

            this.save_election_in_cache( filter.id, filter.UserId, updated_election.toJSON() ),

            redis_client.del(`election-${election.slug}`),

            this.log_queue.add({
                UserId: filter.UserId,
                type: "election",
                description: `User updated their election(${election.name}) with the following params ${Object.entries(
                    update,
                )
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}`,
            })

        ])

        return updated_election
        
    }

    async create_election_post( payload: ElectionPostModelInterface ){

        const election = await this.validate_election({ id: payload.ElectionId, UserId: payload.UserId });

        const last_billing = await this.billing_repository.get_last_billing({ ElectionId: election.id, UserId: payload.UserId }, ['type']);

        if( last_billing.type === 'free' ){

            const election_post_count = await this.repo.get_election_post_count({ ElectionId: election.id, UserId: payload.UserId });

            if( election_post_count >= 2 ) 
                throw new ForbiddenException('You have reached the maximum limit of 2 election posts allowed under the Free Plan. To create additional election posts, please upgrade your subscription plan.')

        }

        payload.slug = slugify(payload.title, {
            strict: true,
            lower: true,
            replacement: '-',
            trim: true
        })


        const existing_election_post = await this.repo.get_election_post({ ElectionId: payload.ElectionId, UserId: payload.UserId, slug: payload.slug }, ["id"]);

        if( existing_election_post ) throw new BadRequestException("Election post already exists");

        const [ election_post ] = await Promise.all([

            this.repo.create_election_post( payload ),

            this.log_queue.add({
                UserId: payload.UserId,
                type: "election",
                description: `User created election post ${payload.title} for the election: ${election.name}`
            })

        ])

        return election_post;

    }

    async edit_election_post( payload: ElectionPostModelInterface ){

        const election = await this.validate_election({ id: payload.ElectionId, UserId: payload.UserId })
        
        payload.slug = slugify(payload.title, {
            strict: true,
            lower: true,
            replacement: '-',
            trim: true
        })

        const existing_election_post = await this.repo.get_election_post({ ElectionId: payload.ElectionId, UserId: payload.UserId, id: payload.id }, ["id", "title"]);

        if( !existing_election_post ) throw new NotFoundException("Election post not found")

        if( payload.filter_value ){
            if(!election.election_post_filter_attribute){
                throw new BadRequestException('Election post filter attribute not set')
            }   

            const existing_label = await this.voters_repository.check_existing_voters_data_value(
                {
                    UserId: payload.UserId,
                    ElectionId: payload.ElectionId
                },
                election.election_post_filter_attribute,
                payload.filter_value[0]
            )

            if( !existing_label ){
                throw new BadRequestException('Filter value is invalid')
            }
    
        }

        const [ updated_election ] = await Promise.all([

            this.repo.update_election_post( { UserId: payload.UserId, id: payload.id }, payload ),

            this.log_queue.add({
                UserId: payload.UserId,
                type: "election",
                description: `User updated their election(${election.name}) post(${existing_election_post.title}) with the following params ${Object.entries(
                    payload,
                )
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}`,
            })
        ])

        return updated_election;

    }

    async delete_election_post( payload: DeleteElectionPost ){

        await this.validate_election({
            UserId: payload.UserId,
            id: payload.ElectionId
        })

        const candidate_count = await this.repo.get_candidate_count({ ElectionPostId: payload.ElectionPostId });

        if( candidate_count > 0 ) 
            throw new ForbiddenException(
              'You cannot delete this post because it is associated with an existing candidate. Kindly delete all associated candidates first',
            );
        
        await this.repo.delete_election_post(payload.ElectionPostId, payload.UserId);

    }

    async get_first_set_of_votes( payload: Partial<Pick<VoteModelInterface, 'UserId' | 'ElectionId'>> ){

        const election_posts = await this.repo.get_election_posts_by_filter({ UserId: payload.UserId, ElectionId: payload.ElectionId }, ['id', 'title']);

        const cached_election = await this.get_cached_election(payload.ElectionId, payload.UserId);

        if( !election_posts[0] )
            throw new BadRequestException("Election post not found");

        const votes = await this.voters_repository.get_votes( election_posts[0].id, payload.ElectionId, payload.UserId );

        const voted_candidates = votes.map( _ => _.toJSON().CandidateId );

        const candidates = await this.get_cached_candidates({ ElectionId: payload.ElectionId, ElectionPostId: election_posts[0].id });

        const candidates_without_votes = candidates.filter( _ => !voted_candidates.includes( _.id ));

        // console.log( {candidates_without_votes, voted_candidates} )

        const zero_votes = candidates_without_votes.map<any>( _ => ({
            CandidateId: _.id,
            candidate_name: _.name,
            ElectionPostId: _.ElectionPostId,
            election_post_title: (_ as any).ElectionPost.title,
            votes: "0",
            candidate_photo: _.image.link
        }))

        return {
            votes: votes.concat(zero_votes),
            election_posts,
            result_is_visible: cached_election.result_is_visible,
            indexed_attributes: cached_election.indexed_voters_attributes
        };

    }

    async get_votes( payload: Pick<VoteModelInterface, 'UserId' | 'ElectionId' | 'ElectionPostId'> ){

        const election = await this.repo.get_one_election_by_filter({ id: payload.ElectionId, UserId: payload.UserId }, ['indexed_voters_attributes', 'result_is_visible'])

        const votes = await this.voters_repository.get_votes( payload.ElectionPostId, payload.ElectionId, payload.UserId );

        const voted_candidates = votes.map( _ => _.toJSON().CandidateId );

        const candidates = await this.get_cached_candidates({ ElectionId: payload.ElectionId, ElectionPostId: payload.ElectionPostId });

        const candidates_without_votes = candidates.filter( _ => !voted_candidates.includes( _.id ));

        // console.log( {candidates_without_votes, voted_candidates} )

        const zero_votes = candidates_without_votes.map<any>( _ => ({
            CandidateId: _.id,
            candidate_name: _.name,
            ElectionPostId: _.ElectionPostId,
            election_post_title: (_ as any).ElectionPost.title,
            votes: "0",
            candidate_photo: _.image.link
        }))

        return {
            votes: votes.concat(zero_votes),
            indexed_attributes: election.indexed_voters_attributes,
            result_is_visible: election.result_is_visible,
        }

    }

    async get_aggregated_votes_for_candidates( payload: Pick<VoteModelInterface, 'CandidateId' | 'UserId' | 'ElectionId' | 'ElectionPostId'> & { aggregation_key: string } ,  ){

        const cached_election = await this.get_cached_election( payload.ElectionId, payload.UserId );

        // if( !cached_election.indexed_voters_attributes.includes( payload.aggregation_key ) )
        //     throw new BadRequestException("Invalid key");

        const aggregation_key = payload.aggregation_key;

        if( payload.CandidateId === 0 ) payload.CandidateId = null; 

        delete payload.aggregation_key;

        const votes = await this.voters_repository.get_aggregated_votes_for_candidate( payload, aggregation_key );

        return {
            votes,
            indexed_attributes: cached_election?.indexed_voters_attributes
        };

    }

    // async create_voter( payload: VoterModelInterface ){

    //     await this.validate_election({ id: payload.ElectionId, UserId: payload.UserId })

    //     const existing_voter = await this.voters_repository.get_voter_by_filter({ email: payload.email, ElectionId: payload.ElectionId }, ['id']);

    //     if( existing_voter ) throw new BadRequestException("Voter already exist for this election")

    //         console.log(crypto.randomBytes(32).toString())

    //     payload.password = crypto.randomInt(199999, 999999).toString()

    //     const voter = await this.voters_repository.create_voter( payload );

    //     return voter;

    // }

    // async perform_operation_on_voters( payload: BulkOperationPayload ){

    //     await this.validate_election({ id: payload.ElectionId, UserId: payload.UserId })

    //     const { ElectionId, UserId } = payload;

    //     if( payload.type === "delete" )
    //         return await this.voters_repository.delete_multiple_voters(payload.voter_ids, { UserId, ElectionId })

    //     if( payload.type === "activate" )
    //         return await this.voters_repository.update_multiple_voters({ is_suspended: false }, payload.voter_ids, { is_suspended: true, ElectionId, UserId })

    //     if( payload.type === "deactivate" )
    //         return await this.voters_repository.update_multiple_voters({ is_suspended: true }, payload.voter_ids, { is_suspended: false, UserId, ElectionId })

    //     if( payload.type === "email" ){

    //         const [count, voters] = await this.voters_repository.get_voters_by_ids( payload.voter_ids, { UserId: payload.UserId, ElectionId: payload.ElectionId }, ['email', 'password'] );

    //         const election = await this.repo.get_one_election_by_filter({ id: ElectionId }, ["election_date", "start_time", "end_time", "name", 'slug']);

    //         const EITHER_OF_ELECTION_TIME_OR_DATE_IS_NULL = Object.values(election).some( _ => _ === null );

    //         if( EITHER_OF_ELECTION_TIME_OR_DATE_IS_NULL ) throw new ForbiddenException("Election date or time not set");

    //         const no_of_iterations = Math.ceil(count / 100);

    //         await this.send_bulk_emails({
    //             voters: voters as any,
    //             voters_count: count, 
    //             election,
    //             UserId,
    //             ElectionId
    //         })

    //         for( let i = 2; i < no_of_iterations; i++ ){

    //             const [count, voters] = await this.voters_repository.get_voters_by_ids( payload.voter_ids, { ElectionId, UserId }, ["email", "password"], i, 100 );

    //             await this.send_bulk_emails({
    //                 voters: voters as any,
    //                 voters_count: count,
    //                 election,
    //                 UserId,
    //                 ElectionId
    //             })

    //         }

    //     }
    

    // }

    async delete_voter( voter_id: number, user_id: number, election_id: number ){

        await this.validate_election({ id: election_id, UserId: user_id });

        const [voter, voter_count] = await Promise.all([

            this.voters_repository.get_voter_by_filter({id: voter_id}, ['ElectionId', 'email_sent', 'email']),
       
            this.voters_repository.get_voters_count({
                id: voter_id,
                UserId: user_id
            })

        ])

        if( !voter ) throw new NotFoundException("Voter not found")

        const last_voter = await this.voters_repository.get_last_voter(voter.ElectionId, ['id'])

        this.logger.debug("DELETING VOTER")

        await Promise.all([

            this.voters_repository.delete_voter({
                UserId:user_id,
                id: voter_id
            }),

            this.voters_service.set_voter_email_sent_count_in_redis(voter.email, election_id, voter.email_sent)

        ])

        if( last_voter.id === voter_id && voter_count === 1 ){

            const updated_election = await this.repo.update_election({ voters_acquisition_channel: null, csv_file: null, indexed_voters_attributes: null }, { id: voter.ElectionId });

            await Promise.all([

                this.save_election_in_cache(election_id, user_id, updated_election.toJSON()),

                this.remove_cached_election(election_id, user_id),

                this.delete_cached_indexed_attributes_distinct_values({
                    election_id: election_id,
                    user_id
                })

            ]);

        }
           
    }

    async delete_all_voters( election_id: number, user_id: number ){

        const election = await this.validate_election({ id: election_id, UserId: user_id });

        await Promise.all([

            this.voters_repository.delete_voter({
                UserId: user_id,
                ElectionId: election_id
            }),

            this.repo.update_election({ voters_acquisition_channel: null, csv_file: null, indexed_voters_attributes: null }, { id: election_id }),

            this.remove_cached_election(election_id, user_id),

            this.delete_cached_indexed_attributes_distinct_values({
                election_id: election_id,
                user_id
            })

        ])

        if( election.csv_file )
            await this.storage_service.delete_file(election.csv_file.id);

    }

    async get_cached_election( election_id: number, user_id: number ){

        const ELECTION_KEY = `${election_id}-${user_id}`

        const cached_election = await redis_client.get(ELECTION_KEY);

        if( cached_election ) return JSON.parse(cached_election) as ElectionModelInrterface;

        const election = await this.repo.get_one_election_by_filter( { id: election_id, UserId: user_id } );
        
        if( election ) await redis_client.setex( ELECTION_KEY, 60, JSON.stringify(election) );

        return election;

    }

    async remove_cached_election( election_id: number, user_id: number ){

        const ELECTION_KEY = `${election_id}-${user_id}`;

        await redis_client.del(ELECTION_KEY);

    }

    async get_cached_election_by_slug( slug: string ){

        const ELECTION_KEY = `election-${slug}`;

        const cached_election = await redis_client.get(ELECTION_KEY);

        if( cached_election ) return JSON.parse(cached_election) as ElectionModelInrterface;

        const election = await this.repo.get_one_election_by_filter({slug});

        if( election ) await redis_client.setex(ELECTION_KEY, 3600, JSON.stringify(election));

        return election;

    }

    async save_election_in_cache( id: number, user_id: number, election: ElectionModelInrterface ){

        const ELECTION_KEY = `${id}-${user_id}`;

        if( !election ) return;

        return await redis_client.setex( ELECTION_KEY, 3600, JSON.stringify(election ));
        
    }

    async get_cached_candidate( candidate_id: number ){

        const cached_candidate = await redis_client.get(`candidate-${candidate_id}`);

        if( cached_candidate ) return JSON.parse( cached_candidate ) as CandidateModelInterface;

        const candidate = await this.repo.get_candidate({ id: candidate_id });

        if( candidate ) await redis_client.setex(`candidate-${candidate_id}`, 3600, JSON.stringify(candidate));

        return candidate;
        
    }

    async get_cached_candidates( payload: Pick<VoteModelInterface, 'ElectionPostId' | 'ElectionId'> ){

        const { ElectionId, ElectionPostId } = payload;

        const KEY = `candidates-${ElectionId}-${ElectionPostId}`

        const cached_candidates = await redis_client.get(KEY);

        if( cached_candidates ) return JSON.parse( cached_candidates ) as CandidateModelInterface[];

        const candidates = await this.repo.get_all_candidates(payload);

        if( candidates ) await redis_client.setex(KEY, 3600, JSON.stringify(candidates));

        return candidates.map( _ => _.toJSON() );
        
    }

    async get_cached_election_post( election_post_id: number ){

        const cached_election_post = await redis_client.get(`election_post-${election_post_id}`);

        if( cached_election_post ) return JSON.parse( cached_election_post ) as ElectionPostModelInterface;

        const election_post = await this.repo.get_election_post({ id: election_post_id });

        if( election_post ) await redis_client.setex(`election_post-${election_post_id}`, 3600, JSON.stringify(election_post));

        return election_post;

    }

    async validate_election( payload: ElectionAuthPayload ){

        console.log( payload )

        const cached_election = await this.get_cached_election(payload.id, payload.UserId);

        const last_billing = await this.billing_repository.get_last_billing({ ElectionId: payload.id }, ['type']);

        if( !cached_election ) throw new NotFoundException("Election not found")

        if( cached_election.is_disabled ) throw new ForbiddenException("Election is disabled");

        const ELECTION_HAS_ENDED = moment(cached_election.end_time).diff(moment(), 'seconds') < 0;

        const ELECTION_HAS_STARTED = moment(cached_election.start_time).diff(moment(), 'seconds') < 0;

        console.log({
            start_time_date: cached_election.start_time,
            end_time_date: cached_election.end_time,
            start_time: moment(cached_election.start_time).diff(moment(), 'seconds'),
            end_time: moment(cached_election.end_time).diff(moment(), 'seconds')
        })

        if( ELECTION_HAS_STARTED && !ELECTION_HAS_ENDED ) throw new ForbiddenException("Modifications are not allowed once the election has started");

        if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Modifications are not allowed once the election has ended.");

        return cached_election;

    }

    async validate_election_less_strict( payload: ElectionAuthPayload ){

        console.log( payload )

        const cached_election = await this.get_cached_election(payload.id, payload.UserId);

        if( !cached_election ) throw new NotFoundException("Election not found")

        if( cached_election.is_disabled ) throw new ForbiddenException("Election is disabled");

        return cached_election;

    }
    

    async upsert_candidate( payload: Partial<CandidateModelInterface> ){

        const election = await this.validate_election({ UserId: payload.UserId, id: payload.ElectionId });

        if( payload.image )
            payload.image.link = payload.image.link.replace("https://smooth-ballot.s3.eu-north-1.amazonaws.com", "https://storage.smoothballot.com");

        if( !payload.id ){

            const last_billing = await this.billing_repository.get_last_billing({ ElectionId: election.id, UserId: payload.UserId }, ['type']);

            if( last_billing.type === "free" ){

                const candidate_count = await this.repo.get_candidate_count({ ElectionPostId: payload.ElectionPostId, UserId: payload.UserId });

                if( candidate_count >= 2 )
                    throw new ForbiddenException('You have reached the maximum limit of 2 candidates per election post allowed under the Free Plan. To add more candidates, please consider upgrading your subscription.')
            }

            const [ candidate, _, election_post ] = await Promise.all([

                this.repo.create_candidate( payload as CandidateModelInterface ),

                this.log_queue.add({
                    UserId: payload.UserId,
                    type: "election",
                    description: `User added candidate: ${payload.name} to their election: ${election.name}`
                }),

                this.repo.get_election_post({ id: payload.ElectionPostId }, ['title'])
            ])

            return {
                ...candidate,
                ElectionPost: election_post
            }

        }

        const filter = { ElectionId: payload.ElectionId, id: payload.id, UserId: payload.UserId };

        const candidate = await this.repo.get_candidate(filter, ['image', 'id', 'name']);

        if( payload.image && candidate.image ) await this.storage_service.delete_file( candidate.image.id );

        if( !candidate ) throw new NotFoundException("Candidate not found");

       

        const [ updated_candidate, _, election_post ] = await Promise.all([

            this.repo.update_candidate(payload, filter),

            this.log_queue.add({
                UserId: payload.UserId,
                type: "election",
                description: `User updated the candidate ${candidate.name} in the election: ${election.name} with the following params: ${Object.entries(
                    payload,
                )
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')}`,
            }),

            this.repo.get_election_post({ id: payload.ElectionPostId }, ['title'])

        ])

        return {
            ...updated_candidate,
            ElectionPost: election_post
        };
    }

    async create_accreditation_form_question( payload: AccreditationFormQuestionModelInterface ){

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        try {

            const [ question ] = await Promise.all([

                this.repo.create_accreditation_form_question(payload, transaction),
    
                this.repo.update_accreditation_form_labels( payload.label, payload.AccreditationFormId, transaction ),

                this.log_queue.add({
                    UserId: payload.UserId,
                    type: "election",
                    description: `User created accreditation form`
                })
    
            ])

            await transaction.commit()
    
            return question;
            
        }
        catch(e){

            this.logger.error(e);

            await transaction.rollback();

            throw new InternalServerErrorException();
            
        }

    }

    async get_distict_voter_data_values( payload: GetVotersDistinctDataValues ){

        const election = await this.validate_election({ UserId: payload.filter.UserId, id: payload.filter.ElectionId });

        if( !election.indexed_voters_attributes.includes(payload.key) )
            throw new BadRequestException("Invalid key");

        const values = await this.voters_repository.get_distict_voter_data_values(payload.key, payload.filter);

        return values;

    }

    async get_first_set_of_votes_for_voters( slug: string ){
         
        const election = await this.get_cached_election_by_slug(slug);

        console.log({election, diff: moment(election.start_time).diff(moment()) > 0 })

        if( !election ) throw new NotFoundException("Election not found");

        if(!election.start_time || !election.end_time)
            throw new BadRequestException("This election is yet to start");
        
        const ELECTION_IS_YET_TO_END = moment(election.end_time).diff(moment()) > 0;

        const ELECTION_IS_YET_TO_START = moment(election.start_time).diff(moment()) > 0;

        if( ELECTION_IS_YET_TO_START ) throw new BadRequestException("This election is yet to start");

        const voters_count = await this.voters_repository.get_voters_count({ ElectionId: election.id, has_voted: true })

        if( ELECTION_IS_YET_TO_END ) throw new BadRequestException(`This election is ongoing *-payload-*${voters_count}`);

        if( !election.result_is_visible ) throw new ForbiddenException(`Result is unavailable yet, contact admin*-payload-*${voters_count}`)

        const result_processing_progress = await this.get_result_processing_progress( election );

        if( result_processing_progress < 100 ) throw new ForbiddenException(`Processing result, ${result_processing_progress}% complete-*-payload-*${voters_count}`);
    
        const response = await this.get_first_set_of_votes({
            ElectionId: election.id,
            UserId: election.UserId
        })

        return {
            ...response,
            Election: {
                name: election.name,
                is_disabled: election.is_disabled,
                election_date: election.election_date,
                start_time: election.start_time,
                end_time:election.end_time
            }
        };

    }

    async get_votes_for_voters( payload: { slug: string, ElectionPostId: number } ){

        const election = await this.get_cached_election_by_slug(payload.slug);

        if( !election ) throw new NotFoundException("Election not found");

        if(!election.start_time || !election.end_time)
            throw new BadRequestException("This election is yet to start");
        
        const ELECTION_IS_YET_TO_END = moment(election.end_time).diff(moment()) > 0;

        const ELECTION_IS_YET_TO_START = moment(election.start_time).diff(moment()) > 0;

        if( ELECTION_IS_YET_TO_START ) throw new BadRequestException("This election is yet to start");

        const voters_count = await this.voters_repository.get_voters_count({ ElectionId: election.id, has_voted: true })

        if( ELECTION_IS_YET_TO_END ) throw new BadRequestException(`This election is ongoing *-payload-*${voters_count}`);

        if( !election.result_is_visible ) throw new ForbiddenException(`Result is unavailable yet, contact admin*-payload-*${voters_count}`)

        const result_processing_progress = await this.get_result_processing_progress( election );

        if( result_processing_progress < 100 ) throw new ForbiddenException(`Processing result, ${result_processing_progress}% complete-*-payload-*${voters_count}`);
    
        const election_posts = await this.repo.get_election_posts_by_filter({ ElectionId: election.id }, ['id', 'title']);
        const result = await this.get_votes({
            ElectionId: election.id,
            ElectionPostId: payload.ElectionPostId,
            UserId: election.UserId
        })

        return {
          ...result,
          election_posts,
          Election: {
            name: election.name,
            is_disabled: election.is_disabled,
            election_date: election.election_date,
            start_time: election.start_time,
            end_time: election.end_time,
          },
        };

    }

    async get_aggregated_votes_for_voters( payload: GetAggregatedVotesForVoters ){
       
        const election = await this.get_cached_election_by_slug(payload.slug);

        if( !election ) throw new NotFoundException("Election not found");

        if(!election.start_time || !election.end_time)
            throw new BadRequestException("This election is yet to start");
        
        const ELECTION_IS_YET_TO_END = moment(election.end_time).diff(moment()) > 0;

        const ELECTION_IS_YET_TO_START = moment(election.start_time).diff(moment()) > 0;

        if( ELECTION_IS_YET_TO_START ) throw new BadRequestException("This election is yet to start");

        const voters_count = await this.voters_repository.get_voters_count({ ElectionId: election.id, has_voted: true })

        if( ELECTION_IS_YET_TO_END ) throw new BadRequestException(`This election is ongoing *-payload-*${voters_count}`);

        if( !election.result_is_visible ) throw new ForbiddenException(`Result is unavailable yet, contact admin*-payload-*${voters_count}`)

        const result_processing_progress = await this.get_result_processing_progress( election );

        if( result_processing_progress < 100 ) throw new ForbiddenException(`Processing result, ${result_processing_progress}% complete-*-payload-*${voters_count}`);

        const result = await this.get_aggregated_votes_for_candidates({
            CandidateId: payload.CandidateId || null,
            UserId: election.UserId,
            ElectionId: election.id,
            ElectionPostId: payload.ElectionPostId,
            aggregation_key: payload.aggregation_key
        })

        return {
            ...result,
            Election: {
                name: election.name,
                is_disabled: election.is_disabled,
                election_date: election.election_date,
                start_time: election.start_time,
                end_time:election.end_time
            }
        };
        
    }

    async get_cached_indexed_attributes_distinct_values( payload: GetIndexedAttributeDistinctValues ){

        const KEY = `DA-${payload.election_id}-${payload.user_id}`;

        const cached_hash = await redis_client.get(KEY);

        if( !cached_hash ){

            const hash = await this.construct_hash_of_indexed_attributes_distict_values(payload);

            await redis_client.setex(KEY, 3600, JSON.stringify(hash));

            return hash;

        }

        else return JSON.parse(cached_hash);

    }

    async delete_cached_indexed_attributes_distinct_values( payload: Omit<GetIndexedAttributeDistinctValues, 'indexed_fields'> ){

        const KEY = `DA-${payload.election_id}-${payload.user_id}`;

        await redis_client.del(KEY);

    }

    async construct_hash_of_indexed_attributes_distict_values( payload: GetIndexedAttributeDistinctValues ){

        const { election_id, user_id, indexed_fields } = payload;

        let hash = {};

        for( let field of indexed_fields ){

            const distinc_values = await this.voters_repository.get_distict_voter_data_values(field, { UserId: user_id, ElectionId: election_id });

            hash[field] = distinc_values;

        }

        console.log( hash )

        return hash;

    }

    async get_voters_with_filter( payload: GetVotersWithFilterServicePayload ){

        const { ElectionId, search, page, per_page, query, UserId } = payload;

        const election = await this.repo.get_one_election_by_filter({id: ElectionId, ...( UserId ? { UserId }: {}),}, ["voters_acquisition_channel", 'indexed_voters_attributes', 'UserId', 'mode']);

        if( !election ) throw new  NotFoundException("Election not found");

        let distinct_values; 

        if( query ){
            
            if( !election.indexed_voters_attributes ) throw new BadRequestException("Voters can't be queried by advanced filters")

            const keys = Object.keys(query);

            const invalid_key = keys.find( key => !election.indexed_voters_attributes.includes( key ))

            if( invalid_key ) throw new BadRequestException(`Invelid key: ${invalid_key}`);

        }

        const { voters, count } = await this.voters_repository.get_voters_with_filter_and_paginate({
            filter: {
                ...( UserId ? { UserId }: {}),
                ElectionId
            },
            search,
            page,
            per_page,
            query
        })

        let voters_fields;

        if( election?.voters_acquisition_channel === "csv" && count > 0 ){

            const last_voter = await this.voters_repository.get_last_voter(ElectionId, ['data']);

            voters_fields = Object.keys(last_voter?.data ?? {});

        }

        else {

            const questions = await this.repo.get_accreditation_form_questions({ElectionId, ...( UserId ? { UserId }: {}) }, ['label']);

            voters_fields = questions.map( _ => _.toJSON().label )
        }

        if( election.indexed_voters_attributes && count > 0 ){

            const hash = await this.get_cached_indexed_attributes_distinct_values({
                election_id: payload.ElectionId, 
                user_id: ( UserId ? UserId: election.UserId),
                indexed_fields: election.indexed_voters_attributes 
            })

            distinct_values = hash;

        }

        let accreditation_form_questions;

        if( election.voters_acquisition_channel === "form" && count > 0 )
            accreditation_form_questions = await this.repo.get_accreditation_form_questions({ UserId: election.UserId, ElectionId: payload.ElectionId });

        const job = await this.job_repository.get_most_recent_job({ type: "voters-population", _election_id: ElectionId });

        const voters_turnout = await this.voters_repository.get_voters_turnout({
           ...( payload.UserId ? { UserId: payload.UserId } : {}) ,
            ElectionId: payload.ElectionId
        })

        return {
            count,
            voters,
            voters_fields: voters_fields.filter( _ => _ !== "email_sent"),
            voters_acquisition_channel: election.voters_acquisition_channel,
            indexed_fields: election.indexed_voters_attributes,
            accreditation_form_questions,
            distinct_values,
            voters_turnout,
            job,
            election_mode: election.mode
        }

    }

    async send_result( election_id: number, user: UserModelInterface ){

        const election = await this.repo.get_one_election_by_filter({ UserId: user.id, id: election_id }, ['start_time', 'end_time', 'name', 'slug', 'id']);

        if(!election) throw new NotFoundException('Election not found');

        const ELECTION_HAS_NOT_ENDED = moment(election.end_time).diff(moment(), 'seconds') > 0;

        if( ELECTION_HAS_NOT_ENDED ) throw new ForbiddenException('Results can only be accessed when election has ended');

        const number_of_votes = await this.voters_repository.get_vote_count({ ElectionId: election_id });

        if( number_of_votes === 0 ) throw new BadRequestException('There are no votes for this election');

        let message;

        let link;

        const result_processing_progress = await this.get_result_processing_progress( election );

        if( result_processing_progress < 100 ) throw new ForbiddenException(`Processing result, ${result_processing_progress}% complete`);

        const existing_job = await this.job_repository.get_most_recent_job({ _election_id: election_id, type: "send-result" });

        console.log(existing_job)

        if( !existing_job ){

            const job = await this.job_repository.create({
                type: "send-result",
                _election_id: election_id,
                status: "pending",
                payload: {},
                Userid: user.id
            })
    
            await this.export_result_queue.add({
                email: user.email,
                election_title: election.name,
                name: user.name.split(" ")[0],
                election_id,
                job_id: job.id,
                slug: election.slug
            })

            return {
                message: "Please wait while we process your result, you'll recieve a notification once we are done",
                link
            }

        }

        if( existing_job?.status === "pending"  ){
            return {
                message: "We are still processing your result, you'll recieve a notification once we are done",
                link
            }
        }

        if( existing_job.status === "done" ){

            const link = await this.repo.get_one_election_by_filter({ id: election_id }, ['result']);

            return {
                message: "Hooray! your result is ready",
                link: link.result.link
            }

        }

        
    }

    async save_result( election_id: number, result: ElectionModelInrterface['result'] ){

        const election = await this.repo.get_one_election_by_filter({ id: election_id }, ['start_time', 'end_time', 'name', 'slug', 'id']);

        const ELECTION_HAS_NOT_ENDED = moment(election.end_time).diff(moment(), 'seconds') > 0;

        if( ELECTION_HAS_NOT_ENDED ) throw new ForbiddenException('Results can only be accessed when election has ended');

        const number_of_votes = await this.voters_repository.get_vote_count({ ElectionId: election_id });

        if( number_of_votes === 0 ) throw new BadRequestException('There are no votes for this election');

        const result_processing_progress = await this.get_result_processing_progress( election );

        if( result_processing_progress < 100 ) throw new ForbiddenException(`Processing result, ${result_processing_progress}% complete`);

        const existing_job = await this.job_repository.get_most_recent_job({ _election_id: election_id, type: "send-result" });

        await Promise.all([
            this.repo.update_election({ result }, { id: election_id }),
            this.job_repository.update_job( existing_job.id, { status: "done" } )
        ])

    }

    async reset_demo_election( filter: { UserId: number, ElectionId: number } ){

        const last_billing = await this.billing_repository.get_last_billing({
            ElectionId: filter.ElectionId,
            UserId: filter.UserId
        }, ['type']);

        if( !last_billing ) throw new NotFoundException("Billing not found");

        if( last_billing.type !== "free" )
            throw new ForbiddenException("This election is not a demo election");

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        try {

            await Promise.all([

                this.repo.update_election({
                    end_time: null,
                    start_time: null,
                    result: null,
                    voters_acquisition_channel: null,
                    csv_file: null,
                    indexed_voters_attributes: null
                }, { id: filter.ElectionId, UserId: filter.UserId }, transaction ),

                this.repo.delete_all_candidates( filter, transaction ),

                this.repo.delete_all_election_posts( filter, transaction ),

                this.repo.delete_accreditation_form(filter, transaction),

                this.repo.delete_all_accreditation_form_questions( filter, transaction ),

                this.voters_repository.delete_voters( filter, transaction ),

                this.voters_repository.delete_votes( filter, transaction ),

                this.voters_repository.delete_all_vote_profiles( filter, transaction ),

                this.job_repository.delete_all_jobs( { Userid: filter.UserId, _election_id: filter.ElectionId }, transaction ),

                this.remove_cached_election(filter.ElectionId, filter.UserId)

            ])

            await transaction.commit()

        }

        catch( e ){

            console.error(e);

            await transaction.rollback();

        }

    }

    async toggle_result_visibility( filter: { UserId: number, id: number }, value: boolean ){

        const _updated_election = await this.repo.update_election( { result_is_visible: value }, filter );

        const updated_election = _updated_election?.toJSON()

        if( !updated_election ) throw new NotFoundException("Election not found");

        this.save_election_in_cache( filter.id, filter.UserId, updated_election )

        redis_client.set(`election-${updated_election.slug}`, JSON.stringify(updated_election) )

        return {
            result_is_visible: updated_election.result_is_visible        
        }

    }

    async toggle_election_mode( filter: Pick<ElectionModelInrterface, "id" | "UserId">, mode: ElectionModelInrterface['mode'] ){

        const existing_election = await this.repo.get_one_election_by_filter(filter, ['mode', 'voters_acquisition_channel']);

        if(!existing_election) throw new NotFoundException("Election not found");

        if( existing_election.voters_acquisition_channel !== "form" && mode === "hybrid") throw new ForbiddenException("Only elections with accreditation form can be hybrid.");

        const _updated_election = await this.repo.update_election({ mode }, filter );

        const updated_election = _updated_election?.toJSON();

        this.save_election_in_cache( filter.id, filter.UserId, updated_election )

        redis_client.set(`election-${updated_election.slug}`, JSON.stringify(updated_election) )

        return {
            mode
        }

    }

    async generate_voters_short_code( filter: Pick<ElectionModelInrterface, "id" | "UserId"> ){4

        const existing_election = await this.repo.get_one_election_by_filter(filter, ['mode', 'end_time', 'start_time']);

        if(!existing_election) throw new NotFoundException("Election not found");

        if( existing_election.mode !== "hybrid" ) throw new ForbiddenException("Short code can only be generated for Hybrid Elections");

        if( !existing_election.start_time || !existing_election.end_time ) throw new ForbiddenException("Election start time or end time not set");

        if( existing_election.end_time ){

            const ELECTION_HAS_ENDED = moment().diff( moment(existing_election.end_time) ) > 0;
            
            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");

        }

        const short_code = OTP.generate(6, {
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            digits: true,
        });

        const SHORT_CODE_KEY = this.get_short_code_key( short_code );

        const existing_key_in_redis = await redis_client.get( SHORT_CODE_KEY );

        if( existing_key_in_redis ) throw new ForbiddenException("The generated short key already exists, Try again!");

        const redis_value = {
            ...filter,
            expires_in: moment().add(20, "minutes").toISOString()
        }

        await redis_client.setex(SHORT_CODE_KEY, 1200, JSON.stringify(redis_value));

        return short_code;

    }

    async verify_short_code( short_code: string ){

        const SHORT_CODE_KEY = this.get_short_code_key( short_code );

        const existing_key_in_redis = await redis_client.get( SHORT_CODE_KEY );

        if(!existing_key_in_redis) throw new ForbiddenException("Invalid shortcode");

        return JSON.parse(existing_key_in_redis);

    }

    async remove_short_code_key( short_code: string ){

        const SHORT_CODE_KEY = this.get_short_code_key( short_code );

        await redis_client.del( SHORT_CODE_KEY );

    }

    async get_data( election_id: number ){
    
            const election = await this.repo.get_one_election_by_filter({ id: election_id }, ['name', 'election_date', 'start_time', 'end_time', 'election_vote_weight_attribute']);
    
            const total_voters = await this.voters_repository.get_voters_count({
                ElectionId: election_id
            })
    
            const voters_turnout = await this.voters_repository.get_voters_count({
                has_voted: true,
                ElectionId: election_id
            })
    
            const election_results = await this.build_election_result(election_id);
    
            console.log(election_results)
            
            console.log("waiting on the data", {
                election_title: election.name,
                election_date: election.election_date,
                voting_period: 'hello there',
                total_registered_voters: total_voters,
                voter_turnout: voters_turnout,
                election_results
            }
    )
    
    
            const election_data: ElectionData = {
                election_title: election.name,
                ELECTION_VOTE_IS_WEIGHTED: election.election_vote_weight_attribute !== null,
                election_date: moment(election.election_date).format('MMMM Do YYYY').toUpperCase(),
                voting_period: `${moment(election.start_time).format('MMMM Do YYYY, hh:mm a')} - ${moment(election.end_time).format('MMMM Do YYYY, hh:mm a')}`.toUpperCase(),
                total_registered_voters: total_voters,
                voter_turnout: voters_turnout,
                election_results
            }
    
            console.log( election_data )
    
            return election_data;
    
        }
    
        private async build_election_result( election_id: number ){
    
            const election_posts = await this.repo.get_election_posts_by_filter({ ElectionId: election_id }, ['title', 'id']);
    
            let election_results = [] as ElectionResult[];
    
            for( let post of election_posts ){
    
                const total_votes = await this.voters_repository.get_votes_count({ ElectionPostId: post.id });
    
                let payload = { } as ChildOf<ElectionResult[]>
    
                payload.total_votes = total_votes;
    
                payload.post_title = post.title;
    
                let results = [] as ElectionResult['results'];
    
                const candidates = await this.repo.get_all_candidates({ ElectionId: election_id, ElectionPostId: post.id });
    
                for( let _candidate of candidates ){
    
                    let result = {} as ChildOf<ElectionResult['results']>;
    
                    const candidate = _candidate.toJSON();
                    
                    result.candidate_name = candidate.name;
    
                    const vote_recieved = await this.voters_repository.get_votes_count({
                        CandidateId: candidate.id,
                        ElectionPostId: post.id
                    })
    
                    const vote_weights_recieved = await this.voters_repository.get_votes_weight({
                        CandidateId: candidate.id,
                        ElectionPostId: post.id
                    })
    
                    result.vote_received = vote_recieved;
    
                    result.weight = vote_weights_recieved ?? 0;
    
                    const _percentage = ((vote_recieved/total_votes) * 100) || 0;
    
                    result.percentage = Number.isInteger(_percentage) ? _percentage.toString() : _percentage.toFixed(2);
    
                    results.push(result)
    
                }
    
                const void_votes = await this.voters_repository.get_votes_count({
                    CandidateId: null,
                    ElectionPostId: post.id
                })
    
                const null_vote_weights_recieved = await this.voters_repository.get_votes_weight({
                    CandidateId: null,
                    ElectionPostId: post.id
                })
    
                if (results.length > 0)
                  results.push({
                    candidate_name: 'VOID',
                    vote_received: void_votes,
                    weight: null_vote_weights_recieved ?? 0,
                    percentage: ((void_votes / total_votes) * 100).toFixed(2),
                  });
    
                payload.results = results.sort((a, b)=> b.vote_received - a.vote_received);
    
                election_results.push( payload )
    
            }
    
            return election_results;
        }

    get_short_code_key( code: string ){

        return `VOTERS-SHORT-CODE-${code}`;

    }

    async proxy__create_voter_and_send_credentials( payload: VoterModelInterface ){
        await this.voters_service.create_voter_and_send_credentials(payload)
    }


    async proxy__correct_password_issue( payload: VoterModelInterface ){
        await this.voters_service.correct_password_issue( payload );
    }

    async proxy__process_election_broadcast(){
        await this.voters_service._process_election_broadcast();
    }

    async proxy__election(){
        return await this.voters_service.get_voters_with_password(186)
    }

    async proxy__broadcast_single_election(){
        const election = await this.repo.get_one_election_by_filter({ id: 190 });
        await this.voters_service.broadcast_voters_credentials(election);
    }

    private async get_result_processing_progress( election: Pick<ElectionModelInrterface, 'id' | 'slug'> ){

        let percentage = 100;

        const _processed_votes = await this.voters_service.get_processed_votes_from_redis( election.slug );

        if( _processed_votes ){

            const vote_audit_log_count = await this.voters_repository.get_vote_log_count( election.id );

            const processed_votes = parseInt( _processed_votes );

            percentage = Math.floor( (processed_votes / ( processed_votes + vote_audit_log_count )) * 100 );

            console.log({
                processed_votes,
                vote_audit_log_count
            })

            if( percentage === 100 )
                await this.voters_service.remove_processed_votes_from_redis( election.slug );

        }

        return percentage;

    }

    private async verify_captcha_token( token: string ){

        try {

            const response = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                secret: CLOUDFLARE_TURNSTILE_SECRET_KEY,
                response: token,
            })

            if( response.data.success ) return true;

            return false;

        }

        catch(e){

            return false;

        }
    }



}