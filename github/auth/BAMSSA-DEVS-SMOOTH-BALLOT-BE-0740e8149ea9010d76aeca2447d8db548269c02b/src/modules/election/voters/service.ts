import { NODE_ENV, VOTERS_ENCRYPTION_KEY, VOTER_PLATFORM } from "@env/index";
import { VotersRepository } from "./repo";
import * as crypto from "crypto";
import { ElectionRepository } from "../election.repo";
import { ElectionService } from "../election.service";
import { BadRequestException, ForbiddenException, forwardRef, Inject, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { AccreditationFormQuestionModelInterface, AuthenticateVoters, BulkOperationPayload, CastVote, CreateVotersFromAccreditationForm, CreateVotersFromAccreditationFormWithShortCode, ElectionModelInrterface, GetAccreditedVoters, ProcessVote, SendBulkEmails, VoteModelInterface, VoteProfileModelInterface, VoterModelInterface } from "../type";
import * as moment from "moment";
import { VoterAuthpayload } from "@modules/core/email/template/voters-auth";
import { ACCREDITATION_FORM_QUEUE, LOG_QUEUE, VOTERS_AUTH_EMAIL_BATCH_QUEUE, VOTERS_AUTH_EMAIL_QUEUE, VOTE_QUEUE } from "src/queue/config";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { VoterAuthEmailOperationPayload } from "src/queue/workers/voters/email";
import { JobRepository } from "@modules/core/job/job.repo";
import { Cron } from "@nestjs/schedule";
import { BillingRepository } from "@modules/billing/billing.repo";
import { redis_client } from "@cache/index";
import db from "@db/postgres/index";
import { Op, Sequelize, Transaction } from "sequelize";
import { UserService } from "@modules/user/user.service";
import * as Joi from "joi";
import { UserModelInterface } from "@modules/user/type";
import { SendElectionEditReminderPayload } from "@modules/core/email/template/reminder";
import { EmailService } from "@modules/core/email/email.service";
import { filter } from "rxjs";
import { UserRepository } from "@modules/user/user.repo";
import { VoterAuthEmailBatchOperationPayload } from "@queue/workers/voters/batch";
import { error } from "console";
import { setTimeout } from 'timers/promises'
import { AuthenticationService } from "@modules/core/auth/auth.service";

export class VotersService {

    private VOTERS_ENCRYPTION_ALGORITHM = 'aes-256-cbc';

    private VOTERS_ENCRYPTION_KEY = VOTERS_ENCRYPTION_KEY;

    private logger = new Logger(VotersService.name)

    private ACCREDITATION_FORM_ATTRIBUTES_TO_EXCLUDE = ['email', 'e-mail', 'mail']

    private VOTER_EMAIL_SENT_REDIS_KEY = "VOTER_EMAIL_SENT_REDIS_KEY "

    constructor(
        private repo: VotersRepository,
        private election_repo: ElectionRepository,
        @Inject(forwardRef(()=> ElectionService))
        private election_service: ElectionService,
        private job_repository: JobRepository,

        @InjectQueue(VOTERS_AUTH_EMAIL_QUEUE)
        private voter_auth_email_queue: Queue<VoterAuthEmailOperationPayload>,

        @InjectQueue(LOG_QUEUE)
        private log_queue: Queue,

        private billing_repo: BillingRepository,

        @InjectQueue(VOTE_QUEUE)
        private vote_queue: Queue,

        @InjectQueue(ACCREDITATION_FORM_QUEUE)
        private accreditation_form_queue: Queue,

        @InjectQueue(VOTERS_AUTH_EMAIL_BATCH_QUEUE)
        private voters_auth_email_batch_queue: Queue<VoterAuthEmailBatchOperationPayload>,

        private user_service: UserService,

        private user_repo: UserRepository,

        private auth_service: AuthenticationService,

        private email_service: EmailService

    ){}

    async create_voter( payload: VoterModelInterface, strict=true  ){

        let election;

        if( strict )
            election = await this.election_service.validate_election({ id: payload.ElectionId, UserId: payload.UserId });

        else election = await this.election_repo.get_one_election_by_filter({ id: payload.ElectionId, UserId: payload.UserId });

        const [existing_voter, voters_count, last_billing] = await Promise.all([
            this.repo.get_voter_by_filter({ email: payload.email.toLowerCase(), ElectionId: payload.ElectionId }, ['id']),
            this.repo.get_voters_count({ ElectionId: election.id}),
            this.billing_repo.get_last_billing({ElectionId: election.id})
        ]) 

        if( existing_voter ) throw new BadRequestException("Voter already exist for this election");

        if( last_billing.no_of_voters <= voters_count ) throw new ForbiddenException('voters capacity reached')

        const random_int = crypto.randomInt(199999, 999999).toString();

        // const random_int = '123456';

        payload.password = this.encrypt_voters_password( random_int );

        const previous_email_sent_count = await this.get_voter_email_sent_count_from_redis( payload.email, payload.ElectionId )

        payload.email_sent = previous_email_sent_count;

        this.logger.debug( previous_email_sent_count );

        payload.email = payload.email.toLowerCase();

        const voter = await this.repo.create_voter( payload );

        return voter;

    }

    async authenticate_voter( payload: AuthenticateVoters ){

        const election = await this.election_repo.get_one_election_by_filter({ slug: payload.slug }, ['id', 'is_disabled', 'end_time', 'start_time']);

        if( !election ) throw new NotFoundException('Election not found');

        if( election.is_disabled ) throw new ForbiddenException('Election has been disabled');

        payload.email = payload.email.toLowerCase();

        const existing_voter = await this.repo.get_voter_by_filter({ email: payload.email, ElectionId: election.id }, ['has_voted', 'is_suspended', 'email', 'id', 'password']);

        if( !existing_voter ) throw new NotFoundException('Account not found');

        const de_encrypted_password = this.de_encrypt_voters_password( existing_voter.password );

        console.log( de_encrypted_password )

        if( de_encrypted_password !== payload.password ) throw new UnauthorizedException('Invalid password');

        if( existing_voter.has_voted ) throw new BadRequestException('You have voted!');

        if( existing_voter.is_suspended ) throw new ForbiddenException('Your account has been suspended!');

        const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment(), 'seconds') < 0;

        const ELECTION_IS_YET_TO_START = (moment(election.start_time).diff(moment(), 'seconds') > 0);

        if( ELECTION_IS_YET_TO_START ) throw new ForbiddenException("Election is yet to start")

        if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");

        delete existing_voter.password;

        return {voter: existing_voter, slug: payload.slug};

    }

    async perform_operation_on_voters( payload: BulkOperationPayload ){

        let election = await this.election_service.validate_election_less_strict({ id: payload.ElectionId, UserId: payload.UserId });

        const { ElectionId, UserId } = payload;

        if( election.end_time ){
        
            const ELECTION_HAS_ENDED = moment().diff( moment(election.end_time) ) > 0;
            
            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");
        
        }

        if( payload.type === "email" ){

            if(!election.end_time || !election.end_time ) throw new ForbiddenException("Election start or end time not set")

            const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment()) < 0;

            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("This election has ended")

            const [[count, voters], voters_with_exceeded_email_sent] = await Promise.all([

                this.repo.get_voters_by_ids( payload.voter_ids, { UserId: payload.UserId, ElectionId: payload.ElectionId }, ['email', 'password'] ),

                this.repo.get_voters_with_exceeded_email_limit(payload.voter_ids, { UserId: payload.UserId, ElectionId: payload.ElectionId }, ['email'])
            ]) 

            if( voters_with_exceeded_email_sent.length > 0 ){

                const first_email = voters_with_exceeded_email_sent[0].email;

                throw new BadRequestException(`Voter with email: ${first_email} has exceeded their email limit`)

            }

            const EITHER_OF_ELECTION_TIME_OR_DATE_IS_NULL = election.start_time === null && election.end_time === null;

            if( EITHER_OF_ELECTION_TIME_OR_DATE_IS_NULL ) throw new ForbiddenException("Election date or time not set");

            const no_of_iterations = Math.ceil(count / 100);

            await Promise.all([

                this.send_bulk_emails({
                    voters: voters as any,
                    voters_count: count, 
                    election,
                    UserId,
                    ElectionId
                }),

                this.repo.update_email_sent_count(payload.voter_ids,{ ElectionId, UserId } )
                
            ]) 

            for( let i = 2; i < no_of_iterations; i++ ){

                const [count, voters] = await this.repo.get_voters_by_ids( payload.voter_ids, { ElectionId, UserId }, ["email", "password"], i, 100 );

                await this.send_bulk_emails({
                    voters: voters as any,
                    voters_count: count,
                    election,
                    UserId,
                    ElectionId
                })

            }

            return;

        }

        election = await this.election_service.validate_election({id: ElectionId, UserId })

        if( payload.type === "delete" ){

            const [count,voters] = await this.repo.get_voters_by_ids( payload.voter_ids, { ElectionId: payload.ElectionId, UserId: payload.UserId }, ['email_sent', 'email'] );

            await Promise.all([

                this.repo.delete_multiple_voters(payload.voter_ids, { UserId, ElectionId }),

                voters.map( _ => _.toJSON() ).map( voter => this.set_voter_email_sent_count_in_redis( voter.email, ElectionId, voter.email_sent))
            ])
            
        }
            
        if( payload.type === "activate" )
            return await this.repo.update_multiple_voters({ is_suspended: false }, payload.voter_ids, { is_suspended: true, ElectionId, UserId })

        if( payload.type === "deactivate" )
            return await this.repo.update_multiple_voters({ is_suspended: true }, payload.voter_ids, { is_suspended: false, UserId, ElectionId })
    
    }

    async create_voter_from_accreditation_form_with_slug( payload: CreateVotersFromAccreditationForm ){

        const { slug, voter } = payload;

        voter.email = voter.email.toLowerCase();

        const election = await this.election_repo.get_one_election_by_filter({ slug });

        const new_voter = await this.create_voter_from_accreditation_form( election, voter );

        return new_voter

    }

    async create_voter_from_accreditation_form_with_short_code( payload: CreateVotersFromAccreditationFormWithShortCode ){

        const { short_code, voter } = payload;

        const short_code_payload = await this.election_service.verify_short_code( short_code );

        const election = await this.election_repo.get_one_election_by_filter({ id: short_code_payload.id });

        const new_voter = await this.create_voter_from_accreditation_form( election, voter, {SEND_CREDENTIALS_TO_VOTER: false, password: payload.short_code } );

        await this.election_service.remove_short_code_key( short_code );

        const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment(), 'seconds') < 0;

        const ELECTION_IS_YET_TO_START = (moment(election.start_time).diff(moment(), 'seconds') > 0);

        if( !ELECTION_HAS_ENDED && !ELECTION_IS_YET_TO_START ){
            return {
                new_voter,
                slug: election.slug,
                token: await this.auth_service.sign_token({
                    id: new_voter.id,
                    slug: election.slug
                })
            }
        }

        return { new_voter };

    }

    async create_voter_from_accreditation_form( election: Partial<ElectionModelInrterface>, voter: VoterModelInterface, config?: {SEND_CREDENTIALS_TO_VOTER?: boolean, password?: string} ){

        if( !election ) throw new NotFoundException("Election not found");
        
        if( election.end_time ){

            const ELECTION_HAS_ENDED = moment().diff( moment(election.end_time) ) > 0;

            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");

        }

        if( election.voters_acquisition_channel === 'csv' ) throw new ForbiddenException("Invalid voter's acquisition channel");

        if( election.is_disabled ) throw new ForbiddenException("Election has been disabled");

        const accreditation_form = await this.election_repo.get_accreditation_form({ ElectionId: election.id }, ['id', 'is_accepting_response', 'labels']);

        if( !accreditation_form ) throw new BadRequestException('Error2: Something went wrong');

        if( accreditation_form.is_accepting_response === false ) throw new BadRequestException('Form is no longer accepting response');

        const last_billing = await this.billing_repo.get_last_billing({ ElectionId: election.id }, ['no_of_voters']);

        if( !last_billing ) throw new BadRequestException('Error1: Something went wrong');

        const voters_count = await this.repo.get_voters_count({ ElectionId: election.id });

        if( voters_count >= last_billing.no_of_voters ) throw new BadRequestException("Error3: Something went wrong");

        const existing_voter = await this.repo.get_voter_by_filter({ email: voter.email, ElectionId: election.id }, ['id']);

        if( existing_voter ) throw new BadRequestException("You have filled this form already");

        let accreditation_questions = await this.election_repo.get_accreditation_form_questions({ ElectionId: election.id, AccreditationFormId: accreditation_form.id });

        const _accreditation_form_qquestions = accreditation_questions.filter( _ => Boolean(_.toJSON().label )).filter(
            (_) =>
              !this.ACCREDITATION_FORM_ATTRIBUTES_TO_EXCLUDE.includes(
                _.toJSON().label.toLowerCase(),
              ),
        ).map( _ => _.toJSON() );

        const validator = this.get_accreditation_form_validator( _accreditation_form_qquestions )

        const { error } = validator.validate( voter );

        if( error ) throw new BadRequestException(error.message);

        voter.ElectionId = election.id;

        voter.UserId = election.UserId;

        const voters_raw_password = config?.password.toString() ?? crypto.randomInt(199999, 999999).toString();

        // const voters_raw_password = '123456';

        voter.password = this.encrypt_voters_password(voters_raw_password);

        voter.email_sent = await this.get_voter_email_sent_count_from_redis( voter.email, voter.ElectionId );

        voter.email = voter.email.toLowerCase();

        const [ new_voter ] = await Promise.all([
            this.repo.create_voter( voter ),
            this.save_voters_data_fields_in_redis(voter.data, election.id)
        ]);

        const VOTERS_COUNT_IS_ADEQUATE_FOR_INDEXING = (voters_count + 1) % 100 === 0;

        if( VOTERS_COUNT_IS_ADEQUATE_FOR_INDEXING ){

            await this.accreditation_form_queue.add({
                labels: _accreditation_form_qquestions.map( _ => _.label).filter(Boolean),
                election_id: election.id,
                voters_count
            })

        }

        if( config?.SEND_CREDENTIALS_TO_VOTER ){

            const formated_election_date = moment(election.election_date).format('YYYY-MM-DD');

            const formatted_election_start_time = moment(election.start_time).format("hh:mma").toUpperCase();

            const formatted_election_end_time = moment(election.end_time).format("hh:mma").toUpperCase();

            const voting_link = `${election.slug}.${VOTER_PLATFORM}`;

            this.email_service.send_voters_auth({
                email: voter.email,
                election_date: formated_election_date,
                password: voters_raw_password,
                election_start_time: formatted_election_start_time,
                election_end_time: formatted_election_end_time,
                voting_link,
                election_title: election.name.toUpperCase(),
                hide_result_link: election.hide_result_link
            })
        }

        delete new_voter['password'];

        return new_voter;

    }

    async get_voter_from_cache( voter_id: number ){

        const cached_voter = await redis_client.get(`voter-${voter_id}`);

        if( cached_voter ) return JSON.parse( cached_voter ) as VoterModelInterface;

        const voter = await this.repo.get_voter_by_filter({ id: voter_id });

        if( voter ) await redis_client.setex(`voter-${voter_id}`, 3600, JSON.stringify(voter));

        return voter;

    }

    async get_vote_profile_from_cache( election_id: number ){

        const cached_vote_profile = await redis_client.get(`vote-profile-${election_id}`);

        if( cached_vote_profile ) return JSON.parse( cached_vote_profile ) as VoteProfileModelInterface;

        const vote_profile = await this.repo.get_vote_profile_by_filter({ ElectionId: election_id });

        if( vote_profile ) await redis_client.setex(`vote-profile${election_id}`, 3600, JSON.stringify(vote_profile));

        return vote_profile;
    }

    async create_vote_profile( payload: VoteProfileModelInterface, transaction?: Transaction  ){

        const new_vote_profile = await this.repo.create_vote_profile( payload );

        await redis_client.setex(`vote-profile-${payload.ElectionId}`, 3600, JSON.stringify(new_vote_profile));

        return new_vote_profile;

    }

    async set_voter_in_cache( voter: VoterModelInterface ){
        
        if( !voter.id ) return;

        await redis_client.setex(`voter-${voter.id}`, 3600, JSON.stringify(voter) );

    }

    async send_bulk_emails( payload: SendBulkEmails ){

        const { election, voters, UserId, ElectionId } = payload;

        const hour_offset = (moment().utcOffset() / 60) - 1;

        const formated_election_date = moment(election.election_date).format('YYYY-MM-DD');

        const formatted_election_start_time = moment(election.start_time).subtract(hour_offset, "hours").format("hh:mma").toUpperCase();

        const formatted_election_end_time = moment(election.end_time).subtract(hour_offset, "hours").format("hh:mma").toUpperCase();

        console.log({
            election_date: election.election_date,
            election_start_time: election.start_time,
            election_end_time: election.end_time,
            formatted_election_end_time,
            formatted_election_start_time
        })

        const transformed_voters = voters.map<VoterAuthpayload>( (_,i) => ({
            id: i+1,
            ..._.toJSON(),
            password: this.de_encrypt_voters_password(_.toJSON().password),
            election_date: formated_election_date,
            election_start_time: formatted_election_start_time,
            election_end_time: formatted_election_end_time,
            election_title: election.name,
            voting_link: `${election.slug}.${VOTER_PLATFORM}`,
            hide_result_link: election.hide_result_link,
            has_sent_voters_auth_credential: _.toJSON().has_sent_voters_auth_credential
        }))

        console.log( transformed_voters )

        const job = await this.job_repository.create({
            _election_id: ElectionId,
            type: "voters-auth",
            payload: {
                voters_len: voters.length
            },
            status: "pending",
            Userid: UserId
        })

        let processed_email_count = 0;

        for( let transformed_voter of transformed_voters ){

            if( transformed_voter.has_sent_voters_auth_credential ) continue

            this.logger.debug(`Added job to queue ${transformed_voter.email}`)

            await this.voter_auth_email_queue.add({
                election_id: ElectionId,
                payload: transformed_voter,
            } satisfies VoterAuthEmailOperationPayload )

            processed_email_count += 1;

        }

        await this.log_queue.add({
            UserId: election.UserId,
            type: "election",
            description: `Processed ${processed_email_count} emails for election: ${election.name}`
        })

            // this.logger.debug("Added job to queue")
    }

    async get_candidates_for_voter(  voter: VoterModelInterface ){

        const election = await this.election_repo.get_one_election_by_filter({ id: voter.ElectionId, UserId: voter.UserId }, ['name', 'election_post_filter_attribute', 'end_time']);

        if( !election ) throw new NotFoundException('Election not found');

        const filter_value = voter.data?.[election.election_post_filter_attribute ?? Date.now().toString()] ?? 'none';

        const candidates = await this.election_repo.get_all_candidates_by_election_post_filter({
            ElectionId: voter.ElectionId,
            UserId: voter.UserId
        }, filter_value )

        return {
            candidates,
            election_name: election.name,
            end_time: election.end_time
        }

    }

    async get_accreditation_form( slug: string ){

        const election = await this.election_repo.get_one_election_by_filter({ slug }, ['id', 'voters_acquisition_channel', 'end_time', 'start_time', 'mode']);

        console.log(election)

        if( !election ) throw new NotFoundException('Election not found');

        if( election.mode === "hybrid" )
            throw new ForbiddenException("Accreditation form unavailable in hybrid mode.")

        if( election.end_time ){

            const ELECTION_HAS_ENDED = moment().diff( moment(election.end_time) ) > 0;

            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");
            
        }

        if( election.start_time ){

            const ELECTION_HAS_STARTED = moment(election.start_time).diff(moment(), 'seconds') < 0;

            if( ELECTION_HAS_STARTED ) throw new ForbiddenException("Election has started");
            
        }

        if( election.voters_acquisition_channel === 'csv' ) throw new ForbiddenException('Invalid link')

        const accreditation_form_and_questions = await this.election_repo.get_accreditation_form_and_questions({ ElectionId: election.id });

        if( !accreditation_form_and_questions ) throw new NotFoundException("Form not found")

        if( accreditation_form_and_questions?.is_accepting_response === false ) throw new BadRequestException('Form is no longer accepting response');

        accreditation_form_and_questions.AccreditationFormQuestions =
          accreditation_form_and_questions.AccreditationFormQuestions.filter( _ => Boolean(_.toJSON().label )).filter(
            (_) =>
              !this.ACCREDITATION_FORM_ATTRIBUTES_TO_EXCLUDE.includes(
                _.toJSON().label?.toLowerCase(),
              ),
        );

        return accreditation_form_and_questions;

    }

    async get_accreditation_form_with_short_code( short_code: string ){

        const payload = await this.election_service.verify_short_code( short_code );

        const election = await this.election_repo.get_one_election_by_filter({ id: payload.id }, ['end_time']);

        if( election.end_time ){

            const ELECTION_HAS_ENDED = moment().diff( moment(election.end_time) ) > 0;

            if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");
            
        }

        const accreditation_form_and_questions = await this.election_repo.get_accreditation_form_and_questions({ ElectionId: payload.id });

        if( !accreditation_form_and_questions ) throw new NotFoundException("Form not found")

        accreditation_form_and_questions.AccreditationFormQuestions =
            accreditation_form_and_questions.AccreditationFormQuestions.filter( _ => Boolean(_.toJSON().label )).filter(
                (_) =>
                !this.ACCREDITATION_FORM_ATTRIBUTES_TO_EXCLUDE.includes(
                    _.toJSON().label?.toLowerCase(),
                ),
            );

        return {
            accreditation_form_and_questions,
            expires_in: payload.expires_in
        }
    }

    async run_voters_indexing(){

        const ELECTION_ID = 4;

        const voters_count = await this.repo.get_voters_count({ElectionId: ELECTION_ID});

        const accreditation_form_question_labels = (await this.election_repo.get_accreditation_form_questions({ElectionId: ELECTION_ID})).map( _ => _.toJSON().label).filter(Boolean);

        await this.accreditation_form_queue.add({
            labels: accreditation_form_question_labels,
            election_id: ELECTION_ID,
            voters_count
        })

    }

    @Cron("*/10 * * * *")
    async audit_vote_logs(){

        this.logger.log('Staring Vote Auditing')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        this.logger.log('Cron is running');

        const stale_logs = await this.repo.get_stale_vote_logs();

        for( let log of stale_logs ){

            const { voter, votes } = log.payload

            console.log({
                payload: log.payload
            })

            await this.vote_queue.add(
                {
                  votes,
                  voter,
                },
                {
                  removeOnComplete: true,
                  removeOnFail: true,
                  jobId: `${voter.ElectionId}-${voter.id}`,
                },
            )
        }


    }

    @Cron("57 1 * * *", { name: "Process Voter's credential broadcast" })
    async process_election_broadcast(){

        this.logger.log("Running cron job: Voters credentials broadcast");

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        this.logger.log('Cron is running');

        const elections = await this.election_repo.get_elections_due_for_voters_broadcast();

        for( let _election of elections ){

            const election = (_election.toJSON()) as ElectionModelInrterface & { User: { email: string, name: string } };

            const batch_job_id = `${election.id}-1`;

            console.log({
                election,
                batch_job_id
            })

            try {

                await this.voters_auth_email_batch_queue.add({
                    job_id: batch_job_id,
                    batch_no: 1,
                    election_id: election.id
                },
                {
                    jobId: batch_job_id,
                    removeOnComplete: true, 
                    removeOnFail: true
                })
            
                await this.repo.create_voters_auth_email_batch_job(
                    batch_job_id,
                    election.id,
                    1
                )

            }

            catch(e){

                console.log(e)

                continue;

            }

            
        }

    }

    @Cron("*/10 * * * *", { name: "requeue_voters_auth_email_batched_job"})
    async requeue_voters_auth_email_batched_job(){

        const batched_jobs = await this.repo.get_voters_auth_email_batch_jobs();

        for( let batched_job of batched_jobs ){

            const { _id, batch_no, election_id } = batched_job;

            try {
                await this.voters_auth_email_batch_queue.add(
                    {
                        job_id: _id,
                        batch_no,
                        election_id
                    },
                    {
                        jobId: _id,
                        removeOnComplete: true, 
                        removeOnFail: true
                    }
                )
    
            }
            catch(e){
                console.error(e);
            }
        }


    }

    @Cron("*/2 * * * *")
    async requeue_voters_auth_email_job(){

        const jobs = await this.repo.get_voters_auth_email_jobs();

        for( let job of jobs ){

            const voter = await this.repo.get_voter_by_filter({ id: job.voter_id }, ['has_sent_voters_auth_credential'])

            if( voter.has_sent_voters_auth_credential ){

                await this.repo.delete_voters_auth_email_job(job._id);

                continue;

            }

            const { _id, payload, election_id } = job;

            await this.voter_auth_email_queue.add(
                {
                    payload,
                    job_id: _id,
                    election_id
                },
                {
                    jobId: _id,
                    removeOnComplete: true, 
                    removeOnFail: true,
                    delay: 1000
                }
            )
            
        }


    }

    async _process_election_broadcast(){

        this.logger.log('Cron is running');

        const elections = await this.election_repo.get_elections_due_for_voters_broadcast();

        const notify_admin_payload_arr = [] as SendElectionEditReminderPayload[];

        for( let _election of elections ){

            const election = (_election.toJSON()) as ElectionModelInrterface & { User: { email: string, name: string } };

            if( !election.start_time ) continue;

            const election_time = moment(election.start_time).subtract(1, 'hour').format('YYYY-MM-DD HH:mm').toUpperCase();

            const user_name = election.User.name.split(" ")[0];

            notify_admin_payload_arr.push({
                election_name: election.name,
                start_time: election_time,
                name: user_name,
                email: election.User.email
            })

        }

        await Promise.all([

            ...(notify_admin_payload_arr.map( payload => this.email_service.send_election_notice_mail( payload ))),

            ...(elections.map( _ => this.broadcast_voters_credentials(_.toJSON()) ))

        ])

    }

    async broadcast_voters_credentials( election: ElectionModelInrterface ){

        const { count, voters } = await this.repo.get_voters_by_election_id( election.id, 1, 100 );

        if( count > 10 && NODE_ENV !== "production" ) return this.logger.log("BROADCAST DECLINED IN DEVELOPMENT DECLINED DUE TO HIGH VOTER's count" );

        const no_of_iterations = Math.ceil(count / 100);

        await this.send_bulk_emails({
            voters: voters as any,
            voters_count: count, 
            election,
            UserId: election.UserId,
            ElectionId: election.id
        })

        for( let i = 2; i <= no_of_iterations; i++ ){

            const { count, voters } = await this.repo.get_voters_by_election_id( election.id, i, 100 );

            await this.send_bulk_emails({
                voters: voters as any,
                voters_count: count,
                election,
                UserId: election.UserId,
                ElectionId: election.id
            })

        }

        await Promise.all([
            this.election_repo.update_election({ has_sent_broadcast: true }, { id: election.id }),
            this.log_queue.add({
                UserId: election.UserId,
                type: "election",
                description: `Initiating email braodcast for ${election.name} with total voters count of ${count}`
            })
        ]);

    }

    async send_batched_voters_credentials( election_id: number, batch_no: number, batch_job_id: string ){

        this.logger.debug("Batch worker")

        const election = await this.election_repo.get_one_election_by_filter({
            id: election_id
        })

        const voters = await this.repo.get_voters( election.id, election.UserId, batch_no, 100 );

        console.log({
            election,
            voters
        })

        if( voters.length === 0 )
            return await this.repo.delete_voters_auth_email_batch_job(batch_job_id)

        for( let _voter of voters ){

            const voter = _voter.toJSON();

            const job_id =  `${voter.id}-${election.id}`;

            console.log({ voter })

            // check if job has been executed before
            if( voter.has_sent_voters_auth_credential ){
                
                await this.repo.delete_voters_auth_email_job(job_id);

                continue;
                
            }

            const election_schedule = this.get_election_schedule_details({
                end_time: election.end_time,
                start_time: election.start_time,
                slug: election.slug
            })

            const voting_link = `${election.slug}.${VOTER_PLATFORM}`;

            const auth_payload: VoterAuthpayload = {
                email: voter.email,
                election_date: election_schedule.formated_election_date,
                password: this.de_encrypt_voters_password( voter.password ),
                election_start_time: election_schedule.formatted_election_start_time,
                election_end_time: election_schedule.formatted_election_end_time,
                voting_link,
                election_title: election.name.toUpperCase(),
                hide_result_link: election.hide_result_link
            }

            await this.send_voters_credentials(
                voter,
                auth_payload,
                job_id
            )

            await this.repo.update_voter(
                {
                    id: voter.id
                },
                {
                    has_sent_voters_auth_credential: true,
                }
            )

        }

        // delete current batch job from mongo db
        await this.repo.delete_voters_auth_email_batch_job(batch_job_id)

        // add next batch to the queue
        const next_batch_no = ++batch_no;

        const next_batch_job_id = `${election.id}-${next_batch_no}`;

        await this.voters_auth_email_batch_queue.add(
            {
                job_id: next_batch_job_id,
                batch_no: next_batch_no,
                election_id: election_id
            },{
                jobId: next_batch_job_id,
                // 2mins delay between batches
                delay: 120000
            }
        )

        // write next batch job to mongo
        await this.repo.create_voters_auth_email_batch_job(
            next_batch_job_id,
            election.id,
            next_batch_no,
        )


    }

    async cast_vote( payload: CastVote, voter: VoterModelInterface ){

        if( voter.has_voted ) throw new ForbiddenException("You have voted already");

        this.logger.debug({message:"#cast_vote method called"});

        const election = await this.election_service.get_cached_election(voter.ElectionId, voter.UserId);

        const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment(), 'seconds') < 0;

        const ELECTION_IS_YET_TO_START = (moment(election.start_time).diff(moment(), 'seconds') > 0)

        if( ELECTION_IS_YET_TO_START ) throw new ForbiddenException("Election is yet to start")

        if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        try{

            await Promise.all([
              this.repo.update_voter(
                {
                  id: voter.id,
                },
                { has_voted: true },
                transaction,
              ),

              this.vote_queue.add(
                {
                  votes: payload.votes,
                  voter,
                },
                {
                  removeOnComplete: true,
                  removeOnFail: true,
                  jobId: `${voter.ElectionId}-${voter.id}`,
                },
              ),

              this.repo.create_vote_audit_log({
                _id: `${voter.ElectionId}-${voter.id}`,
                payload: {
                  votes: payload.votes,
                  voter: voter,
                },
                ElectionId: voter.ElectionId
              }),
            ]);

            await transaction.commit()

        }

        catch(e:any){

            await transaction.rollback();

            console.log(e);

        }

    }

    async process_vote( payload: ProcessVote ){

        this.logger.debug({message:"#process_vote method called"})

        const { voter, votes } = payload;

        const election = await this.election_service.get_cached_election(payload.voter.ElectionId, payload.voter.UserId);
        // const election = await this.election_repo.get_one_election_by_filter({id: payload.voter.ElectionId, UserId: payload.voter.UserId});

        console.log( election )

        if( !election ) return this.logger.error('Election not found');

        const ELECTION_IS_YET_TO_START = (moment(election.start_time).diff(moment(), 'seconds') > 0);

        if( ELECTION_IS_YET_TO_START ) throw new ForbiddenException("Election is yet to start")

        // if( ELECTION_HAS_ENDED ) throw new ForbiddenException("Election has ended");

        let vote_profile = await this.get_vote_profile_from_cache( election.id );
        // let vote_profile = await this.repo.get_vote_profile_by_filter({ ElectionId: election.id })

        console.log( vote_profile )

        // let user = await this.user_repo.get_user_by_id( election.UserId );
        let user = await this.user_service.get_user_from_cache(election.UserId)

        if(!user) return this.logger.error('User not found');

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        if( !vote_profile ){

            const payload = {
                election_title: election.name,
                election_date: election.election_date,
                start_time: election.start_time,
                ElectionId: election.id,
                UserId: election.UserId,
                user_email: user.email,
                user_first_name: user.name,
                user_last_name: user.name,
            } satisfies VoteProfileModelInterface
            
            vote_profile = await this.create_vote_profile( payload );
            // vote_profile = await this.repo.create_vote_profile( payload );

        }

        try {


            for( let vote of votes ){

                console.log({vote})

                let payload = {
                    VoteProfileId: vote_profile.id,
                    UserId: voter.UserId,
                    voter_email: voter.email,
                    voter_data: voter.data,
                    ElectionId: voter.ElectionId,
                    VoterId: voter.id
                } as VoteModelInterface;

                if( vote.CandidateId ){

                    const candidate = await this.election_service.get_cached_candidate( vote.CandidateId );
                    // const candidate = await this.election_repo.get_candidate({id: vote.CandidateId} );

                    console.log({ candidate })
                    
                    if( !candidate ) continue;

                    payload.CandidateId = candidate.id;
                    payload.candidate_name = candidate.name;
                    payload.candidate_photo = candidate.image.link;

                }

                else payload.CandidateId = null;

                const election_post = await this.election_service.get_cached_election_post( vote.ElectionPostId );
                // const election_post = await this.election_repo.get_election_post({ id: vote.ElectionPostId })

                console.log({
                    election_post,
                })

                if( !election_post ) continue;

                const MAXIMUM_VOTER_PER_VOTER = election_post.maximum_vote_per_voter ?? 1;

                payload.ElectionPostId = election_post.id;
                payload.election_post_title = election_post.title;

                let existing_vote;

                const VOTER_CAN_VOTE_FOR_MORE_THAN_ONE_CANDIDATE = election_post.maximum_vote_per_voter > 1;

                if( VOTER_CAN_VOTE_FOR_MORE_THAN_ONE_CANDIDATE ){

                    existing_vote = await this.repo.get_vote_by_filter({ CandidateId: payload.CandidateId, VoterId: voter.id, UserId: voter.UserId });

                    const vote_count = await this.repo.get_vote_count({ UserId: voter.UserId, ElectionPostId: election_post.id, VoterId: voter.id  });

                    if( vote_count === MAXIMUM_VOTER_PER_VOTER ) continue;

                }

                else existing_vote = await this.repo.get_vote_by_filter({ UserId: voter.UserId, ElectionPostId: election_post.id, VoterId: voter.id });

                if( existing_vote ) continue;

                if(  election.election_vote_weight_attribute !== null )

                    payload.weight = parseInt(voter.data[ election.election_vote_weight_attribute ]) || 1;

                else payload.weight = 1;

                await Promise.all([

                    this.repo.create_vote( payload, transaction ),

                    this.increament_votes_processed_in_redis(election.slug)

                ])
                
            }

            await Promise.all([

                this.repo.update_voter({ id: voter.id }, { has_voted: true }, transaction ),

                this.repo.delete_audit_log(`${voter.ElectionId}-${voter.id}`)

                // this.email_service.send_vote_acknowledgement_mail({
                //     email: voter.email,
                //     name: voter.email.split("@")[0],
                //     election_name: vote_profile.election_title,
                //     result_link: `${election.slug}.${VOTER_PLATFORM}/results`,
                //     result_time: moment(election.end_time).subtract(1, 'hour').format("hh:mma")?.toUpperCase()
                // })

            ]) 

            await transaction.commit();
                
            await redis_client.del(`voter-${voter.id}`);

        }

        catch( e: any ) {

            console.error(e)

            await transaction.rollback();

        }

    }

    async set_voter_email_sent_count_in_redis( email: string, election_id: number, count: number ){
        
        this.logger.debug("SETTING EMAIL SENT IN REDIS")

        await redis_client.setex(`${this.VOTER_EMAIL_SENT_REDIS_KEY}-${election_id}-${email.toLowerCase()}`, 86400, count ?? 0);

    }

    async get_voter_email_sent_count_from_redis( email: string, election_id: number ){

        const cached_count = await redis_client.get(`${this.VOTER_EMAIL_SENT_REDIS_KEY}-${election_id}-${email.toLowerCase()}`);

        this.logger.debug(cached_count)

        return parseInt( cached_count ) || 0;

    }

    async get_election_from_slug( slug: string ){

        const election = await this.election_repo.get_one_election_by_filter({ slug  });

        if( !election ) throw new NotFoundException("Election not found");

        if(!election.start_time || !election.end_time)
            throw new BadRequestException("This election is yet to start");
        
        const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment()) < 0;

        const ELECTION_IS_YET_TO_START = moment(election.start_time).diff(moment()) > 0;

        if( ELECTION_IS_YET_TO_START ) throw new BadRequestException("This election is yet to start");

        if( ELECTION_HAS_ENDED ) throw new BadRequestException("This election has ended")

        return election;

    }

    async increament_votes_processed_in_redis( slug: string ){

        const REDIS_KEY = `VOTES_PROCESSED_${slug}`;

        const value = (await redis_client.get(REDIS_KEY)) ?? '0';

        const new_value = parseInt(value) + 1;

        await redis_client.set(REDIS_KEY, new_value.toString());

    }
    
    async get_processed_votes_from_redis( slug: string ){

        const REDIS_KEY = `VOTES_PROCESSED_${slug}`;

        // const election = await this.election_service.get_cached_election_by_slug( slug );
        const election = await this.election_repo.get_one_election_by_filter( {slug}, ['id'] );

        console.log({election})

        const vote_count = await this.repo.get_vote_count({
            ElectionId: election.id
        })

        return vote_count.toString();

    }

    async remove_processed_votes_from_redis( slug: string ){

        const REDIS_KEY = `VOTES_PROCESSED_${slug}`;

        await redis_client.del( REDIS_KEY );
        
    }

    async create_voter_and_send_credentials( payload: VoterModelInterface ){

        const election = await this.election_repo.get_one_election_by_filter({ id: payload.ElectionId });

        payload.UserId = election.UserId;

        const voter = await this.create_voter( payload );

        const election_schedule = this.get_election_schedule_details( election );

        const voting_link = `${election.slug}.${VOTER_PLATFORM}`;

        const auth_payload: VoterAuthpayload = {
            email: voter.email,
            election_date: election_schedule.formated_election_date,
            password: this.de_encrypt_voters_password( voter.password ),
            election_start_time: election_schedule.formatted_election_start_time,
            election_end_time: election_schedule.formatted_election_end_time,
            voting_link,
            election_title: election.name.toUpperCase(),
            hide_result_link: election.hide_result_link
        }

        await this.voter_auth_email_queue.add({
            election_id: voter.ElectionId,
            payload: auth_payload
        }, { delay: 10000 })
        
    }

    async send_voters_credentials( voter: VoterModelInterface, auth_payload: VoterAuthpayload, job_id: string ){

        await this.voter_auth_email_queue.add(
            {
                election_id: voter.ElectionId,
                payload: auth_payload,
                job_id
            },
            {
                jobId: job_id,
                removeOnComplete: true, 
                removeOnFail: true,
                delay: 1000
            }
        )

         await this.repo.create_voters_auth_email_job(
            job_id,
            voter.ElectionId,
            auth_payload,
            voter.id
        )

    }

    async correct_password_issue( payload: VoterModelInterface ){

        const existing_voter = await this.repo.get_voter_by_filter({
            email: payload.email
        })

        const main_voter = await this.repo.get_voter_by_filter({
            email: payload.email,
            ElectionId: payload.ElectionId
        })

        const de_encrypt_password_1 = this.de_encrypt_voters_password( existing_voter.password );

        const de_encrypt_password_2 = this.de_encrypt_voters_password( main_voter.password );

        if( de_encrypt_password_1 !== de_encrypt_password_2 ){
            await this.repo.update_voter({
                id: main_voter.id
            }, { password: existing_voter.password })
        }


    }

    async get_accredited_voters(payload: GetAccreditedVoters){

        const election = await this.election_repo.get_one_election_by_filter({ slug: payload.slug }, ['indexed_voters_attributes', 'search_attribute', 'id', 'name']);

        if( !election ) throw new NotFoundException("Election not found!");

        if( !election.search_attribute && payload.search_value ){
            this.logger.error("Error: No search attribute")
            throw new ForbiddenException("Bad filter");
        }

        if( payload.filter ){

            if( !election.indexed_voters_attributes ){
                this.logger.error("Error: No indexed attribute")
                throw new ForbiddenException("Bad filter");
            }

            const filter_attributes = Object.keys( payload.filter );

            const MISMATCHED_ATTRIBUTE_EXISTS = filter_attributes.some( attr => !election.indexed_voters_attributes.includes(attr) );

            if( MISMATCHED_ATTRIBUTE_EXISTS ){
                this.logger.error("Error: Mismatched filter attribute found")
                throw new ForbiddenException("Bad filter");
            }
            
        }

        payload.search_key = election.search_attribute;

        payload.election_id = election.id;

        let distinct_values;

        if( election.indexed_voters_attributes?.length ) 
            distinct_values = await this.repo.get_voters_distinct_attribute( election.id, election.indexed_voters_attributes )

        let election_name;

        if( !payload.page || payload.page === 1 ) {

            election_name = election.name;

        }

        let data = await this.repo.get_accredited_voters( payload );

        return {
            ...data,
            distinct_values: distinct_values ?? [],
            election_name,
            search_attribute: election.search_attribute
        }

    }

    async get_voter_distinct_attribute( slug: string ){

        const election = await this.election_repo.get_one_election_by_filter({ slug }, ['indexed_voters_attributes', 'id', 'search_attribute']);

        if( !election ) throw new NotFoundException("Election not found!");

        const results = await this.repo.get_voters_distinct_attribute(election.id, election.indexed_voters_attributes ?? []);

        return {
            searchable: Boolean(election.search_attribute),
            results
        };

    }

    encrypt_voters_password( password: string ){

        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(this.VOTERS_ENCRYPTION_ALGORITHM, Buffer.from(this.VOTERS_ENCRYPTION_KEY, 'utf-8'), iv);

        let encrypted_data = cipher.update(password, 'utf-8', 'hex');

        encrypted_data += cipher.final('hex');

        const encrypted_string = (Buffer as any).from(iv, 'binary').toString('hex') + encrypted_data;

        return encrypted_string;

    }

    private async save_voters_data_fields_in_redis( data: VoterModelInterface['data'], election_id: number ){

        const pair = Object.entries( data );

        for( let [ key, value ] of pair as any ){

            if( !value ) continue;

            await redis_client.sadd(`${key}-${election_id}`, value);

        }

    }

    private de_encrypt_voters_password( encrypted_voters_password: string ){

        const iv = Buffer.from(encrypted_voters_password.slice(0, 32), 'hex');

        const encrypted_data = encrypted_voters_password.slice(32);

        const decipher = crypto.createDecipheriv(this.VOTERS_ENCRYPTION_ALGORITHM, Buffer.from(this.VOTERS_ENCRYPTION_KEY, 'utf-8'), iv);

        let decrypted_data = decipher.update(encrypted_data, 'hex', 'utf-8');

        decrypted_data += decipher.final('utf-8');

        return decrypted_data;

    }

    private get_accreditation_form_validator( form_questions: AccreditationFormQuestionModelInterface[] ){

        const validator_object = {};

        for( let question of form_questions ){

            if( question.type === 'short-answer' ) 
                validator_object[question.label] = question.is_required ? Joi.string().required() : Joi.string()

            if( question.type === 'multiple-choice' && question.options.length > 0 )
                validator_object[question.label] = question.is_required ? Joi.string().valid(...question.options).required() : Joi.string().valid(...question.options)

        }

        return Joi.object({
            email: Joi.string().email().required(),
            data: Joi.object(validator_object).required()
        }).required();

    }

    private get_election_schedule_details( payload: Pick<ElectionModelInrterface, "start_time" | "end_time" | "election_date" | "slug"> ){

        const hour_offset = (moment().utcOffset() / 60) - 1;

        const formated_election_date = moment(payload.election_date).format('YYYY-MM-DD');

        const formatted_election_start_time = moment(payload.start_time).subtract(hour_offset, "hours").format("hh:mma").toUpperCase();

        const formatted_election_end_time = moment(payload.end_time).subtract(hour_offset, "hours").format("hh:mma").toUpperCase();

        return {
            formated_election_date,
            formatted_election_start_time,
            formatted_election_end_time,
        }

    }

    async get_voters_with_password( election_id: number ){
        const voters = await this.repo.get_voters_by_filter({ ElectionId: election_id });
        const result = []
        for( let _voter of voters ){
            result.push({
                email: _voter.toJSON().email,
                password: this.de_encrypt_voters_password(_voter.toJSON().password)
            })
        }
        return result
    }

    async send_bulk_email( payload: { election_id: number, api_key: string }){

        const voters = await this.repo.get_voters_by_filter(
            {
                ElectionId: payload.election_id
            },
            { 
                page: 1,
                per_page: 100,
                advanced_filter: {
                    has_sent_voters_auth_credential: {
                        [Op.is]: null 
                    }
                }
            }
        )

        const election = await this.election_repo.get_one_election_by_filter({ id: payload.election_id });

        for( let _voter of voters ){

            const voter = _voter.toJSON();

            const election_schedule = this.get_election_schedule_details({
                end_time: election.end_time,
                start_time: election.start_time,
                slug: election.slug
            })

            const voting_link = `${election.slug}.${VOTER_PLATFORM}`;

            const auth_payload: VoterAuthpayload = {
                email: voter.email.trim(),
                election_date: election_schedule.formated_election_date,
                password: this.de_encrypt_voters_password( voter.password ),
                election_start_time: election_schedule.formatted_election_start_time,
                election_end_time: election_schedule.formatted_election_end_time,
                voting_link,
                election_title: election.name.toUpperCase(),
                hide_result_link: election.hide_result_link
            }


            try {

                await this.email_service.send_voters_auth_custom(auth_payload, payload.api_key);

                await this.repo.update_voter({ id: voter.id }, { has_sent_voters_auth_credential: true })

                await setTimeout(1000)

            }

            catch(e) {
                console.log(voter.email)
            }
         


            

        }


    }


    
}