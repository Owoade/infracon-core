import { ContestRepository } from "./repo";
import { ContestantModelInterface, ContestModelInterface, ContestOrganizerProfileInterface, ContestRevenueReportData, ContestVoteModelInterface, ContestVoteRefundModelInterface, GetContestantsWithSlug, GetContestPayouts, GetContestVotes, GetPaymentLinkForContest, ProcessContestRevenueTransfer, ProcessContestVote } from "./type";
import slugify from "slugify";
import * as crypto from "crypto";
import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import * as moment from "moment";
import { StorageService } from "@modules/core/storage/storage.service";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { ResolveAccountNumber } from "@modules/core/payment/type";
import { InjectQueue } from "@nestjs/bull";
import { CONTEST_REVENUE_REPORT_GENERATION_QUEUE, CONTEST_REVENUE_TRANSFER_QUEUE, CONTEST_VOTE_QUEUE } from "@queue/config";
import { Queue } from "bull";
import db from "@db/postgres";
import { Sequelize, Transaction } from "sequelize";
import { Cron } from "@nestjs/schedule";
import { Logger } from "@nestjs/common";
import { WalletService } from "@modules/wallet/wallet.service";
import { WalletRepository } from "@modules/wallet/wallet.repo";
import { EmailService } from "@modules/core/email/email.service";
import { contesat_vote_counted_template } from "@modules/core/email/template/voted-contest";
import { contest_payment_template } from "@modules/core/email/template/contest-payment";
import { format_currency } from "@utils/format_currency";
import { UserService } from "@modules/user/user.service";
import { UserRepository } from "@modules/user/user.repo";
import { NotFound } from "@aws-sdk/client-s3";
import { TransferInitiated } from "paystack-sdk/dist/transfer/interface";
import { BadRequest } from "paystack-sdk/dist/interface";
import { ChildOf } from "@utils/schema";
import { JobRepository } from "@modules/core/job/job.repo";
import contest_refund_email_template from "@modules/core/email/template/contest-refund";
import { ref } from "pdfkit";
import { AccountResolved } from "paystack-sdk/dist/verification/interface";
import { RecipientCreatedResponse } from "paystack-sdk/dist/recipient/interface";
import { payment_metadata_repo } from "@utils/payment-metadata";

@Injectable()
export class ContestService {

    private logger = new Logger(ContestService.name)

    constructor(
        private repo: ContestRepository,
        private storage_service: StorageService,
        private payment_service: PaymentSercvice,
        @InjectQueue(CONTEST_VOTE_QUEUE)
        private contest_queue: Queue,
        @InjectQueue(CONTEST_REVENUE_TRANSFER_QUEUE)
        private contest_revenue_transfer_queue: Queue<ProcessContestRevenueTransfer>,
        private wallet_repo: WalletRepository,
        private email_service: EmailService,
        private user_repo: UserRepository,
        @InjectQueue(CONTEST_REVENUE_REPORT_GENERATION_QUEUE)
        private contest_report_generation_queue: Queue<{ contest_id: number, job_id: number }>,
        private job_repo: JobRepository
    ){}

    async create_contest( payload: ContestModelInterface ){

        let slug = slugify(payload.name.replace(/\b[Ee]lections?\b/g, ""), {
            strict: true,
            lower: true,
            replacement: '-',
            trim: true
        })

        const existing_contest = await this.repo.get_contest({ slug }, ['id']);

        if( existing_contest ){

            const variable = crypto.randomInt(10, 99);
            
            slug += `-${variable}`;

        }

        payload.slug = slug;

        return await this.repo.create_contest( payload )

    }

    async update_contestant( payload: ContestantModelInterface, filter: Partial<ContestantModelInterface> ){

        const existing_contestant = await this.repo.get_contestant( filter, ['image', 'id','name', 'ContestId'] );

        if(!existing_contestant)
            throw new NotFoundException('Contestant not found');

        if( payload.image.id !== existing_contestant.image.id )
            await this.storage_service.delete_file( existing_contestant.image.id );

        if( payload.name !== existing_contestant.name ){
            
            let slug = slugify(payload.name.replace(/\b[Cc]ontest?\b/g, ""), {
                strict: true,
                lower: true,
                replacement: '-',
                trim: true
            });

            slug += `-${existing_contestant.ContestId}`;

            const existing_contestant_with_slug = await this.repo.get_contest({ slug }, ['id']);

            if( existing_contestant_with_slug ){

                const variable = crypto.randomInt(10, 99);

                slug += `-${variable}`;

            }

            payload.slug = slug;

        }

        const updated_contestant = await this.repo.udpdate_contestant(payload, filter);

        return updated_contestant

    }

    async create_contestant( payload: ContestantModelInterface ){

        let slug = slugify(payload.name.replace(/\b[Ee]lections?\b/g, ""), {
            strict: true,
            lower: true,
            replacement: '-',
            trim: true
        })

        slug += `-${payload.ContestId}`

        const existing_contestant = await this.repo.get_contestant({ slug, ContestId: payload.ContestId }, ['id']);

        if( existing_contestant ) throw new ForbiddenException('Contestant already exists');

        payload.slug = slug;

        const contestant = await this.repo.create_contestant( payload );

        return contestant;

    }

    async get_contestants_with_slug( payload: GetContestantsWithSlug ){

        let contest: Partial<ContestModelInterface>, organizer_profile;

        if( payload.page === 1 && !payload.search ){

            contest = await this.repo.get_contest({ slug: payload.slug });

            if( !contest ) throw new NotFoundException("Contest not found")

            contest.slug = payload.slug

            organizer_profile = await this.repo.get_contest_organizer_profile({ UserId: contest.UserId })

        }

        else {

            contest = await this.repo.get_contest({ slug: payload.slug }, ['id', 'hide_live_votes']);

            if( !contest ) throw new NotFoundException('Contest not found');

        }

        const total_votes = await this.repo.get_contest_votes_count({
            ContestId: contest.id
        })

        const contestants = await this.repo.get_unevicted_contestants(
            { ContestId: contest.id }, 
            payload.page,
            payload.per_page,
            {
                search: payload.search,
                hide_live_votes: contest.hide_live_votes
            }
        )
        
        return {
            contest,
            organizer_profile,
            contestants,
            total_votes
        }

        
        
    }

    async update_contest( payload: ContestModelInterface, filter: Partial<ContestantModelInterface> ){

        const existing_contest = await this.repo.get_contest( filter, ['name', 'id', 'contest_image'] );

        if( !existing_contest ) throw new NotFoundException('Contest not found');

        if( payload.name !== existing_contest.name ){

            let slug = slugify(payload.name.replace(/\b[Cc]ontest?\b/g, ""), {
                strict: true,
                lower: true,
                replacement: '-',
                trim: true
            });

            const existing_contest_with_slug = await this.repo.get_contest({ slug }, ['id']);

            if( existing_contest_with_slug?.id !==  existing_contest.id && existing_contest_with_slug ){

                const variable = crypto.randomInt(10, 99);

                slug += `-${variable}`;

            }

            payload.slug = slug;

        }

        if( payload.start_time || payload.end_time ){

            const start_date = moment( payload.start_time );

            const end_date = moment( payload.end_time );

            const START_DATE_IS_GREATER_THAN_END_DATE = moment(start_date).diff(moment(end_date)) > 0;

            if( START_DATE_IS_GREATER_THAN_END_DATE )
                throw new BadRequestException("Start date can't be greater end date");

        }

        if( payload.contest_image?.id !== existing_contest.contest_image?.id )
            await this.storage_service.delete_file(existing_contest.contest_image.id )

        const updated_contest = await this.repo.udpdate_contest(payload, filter);

        return updated_contest;

    }

    async upsert_contest_organizer_profile( payload: Partial<ContestOrganizerProfileInterface>, filter: Partial<ContestOrganizerProfileInterface> ){

        const existing_profile = await this.repo.get_contest_organizer_profile(filter, ['account_number']);

        if( !existing_profile ){
            
            if( payload.account_number ){

                const response = await this.payment_service.resolve_account_number({
                    account_number: payload.account_number,
                    bank_code: payload.bank_code
                })

                if( !response.status ) throw new BadRequestException(response.message);

                payload.account_name = response.data.account_name;

                const recipient_repsonse = await this.payment_service.create_recipient({
                    type: 'nuban',
                    name: payload.account_name,
                    account_number: payload.account_number,
                    bank_code: payload.bank_code
                });

                if(!recipient_repsonse.status) throw new InternalServerErrorException('Something went wrong');

                const recipient_data = recipient_repsonse.data;
                
                payload.recipient_id = recipient_data.recipient_code;

            }

            const new_profile = await this.repo.create_contest_organizer_profile(payload as ContestOrganizerProfileInterface);

            return new_profile;

        }

        if( existing_profile.account_number !== payload.account_number ){

            const response = await this.payment_service.resolve_account_number({
                account_number: payload.account_number,
                bank_code: payload.bank_code
            })

            if( !response.status ) throw new BadRequestException(response.message);

            payload.account_name = response.data.account_name;

            const recipient_repsonse = await this.payment_service.create_recipient({
                type: 'nuban',
                name: payload.account_name,
                account_number: payload.account_number,
                bank_code: payload.bank_code
            });

            if(!recipient_repsonse.status) throw new InternalServerErrorException('Something went wrong');

            const recipient_data = recipient_repsonse.data;

            payload.recipient_id = recipient_data.recipient_code;
  
        }

        const updated_profile = await this.repo.update_contest_organizer_profile( payload, filter );

        return updated_profile;
        
    }

    async resolve_bank_account_number( payload: ResolveAccountNumber ){

        const response = await this.payment_service.resolve_account_number( payload );

        if( !response.status )  throw new BadRequestException( response.message );

        return response.data.account_name;

    }

    async get_voting_fee( payload: { slug: string, number_of_votes: number } ){

        const { slug, number_of_votes } = payload;

        const contest = await this.repo.get_contest({ slug }, ['voting_fee']);

        if( !contest ) throw new NotFoundException("Contest not found");

        return number_of_votes * contest.voting_fee;

    }

    async getting_payment_link_for_contest( payload: GetPaymentLinkForContest ){

        const contest = await this.repo.get_contest({ id: payload.ContestId }, ['id', 'voting_fee', 'UserId', 'slug', 'end_time', 'start_time']);

        if( !contest ) throw new NotFoundException('Contest not found');

        if(!contest.start_time) throw new BadRequestException("Contest is yet to start.")

        if( moment(contest.start_time).diff(moment()) > 0 ) throw new BadRequestException("Contest is yet to start.")

        console.log(moment().diff(moment(contest.end_time), 'minute'))

        if( contest.end_time ){
            if( moment().diff(moment(contest.end_time)) > 0 ){
                throw new BadRequestException("Contest has ended.")
            }
        }

        payload.slug = contest.slug;

        const contestant = await this.repo.get_contestant({ id: payload.ContestantId }, ['id']);

        if( !contestant ) throw new NotFoundException('Contestant not found');

        const session_id = crypto.randomUUID();

        const contest_amount = (( contest.voting_fee * payload.votes ) * 100);

        const metadata = {
            type: "contest:vote",
            contest_id: contest.id,
            rate: contest.voting_fee,
            session_id,
            ...payload,
            amount_paid: contest_amount/100,
            UserId: contest.UserId,
        } satisfies ProcessContestVote

        const payment_link = await this.payment_service.create_charge({
            email: payload.email,
            amount: contest_amount.toString(),
            callback_url: `https://smoothballot.app/vote-confirmation/${session_id}`
        })

        if( payment_link.data?.reference ){
            await payment_metadata_repo.create({
                id: payment_link.data.reference,
                data: metadata,
                type: "contest"
            })
        }

        return {
            payment_link,
            session_id
        };

    }

    async handle_contest_vote( payload: ProcessContestVote ){

        this.logger.log("called handle_contest_vote")

        const session_id = payload.session_id;

        const contest_vote = await this.repo.get_contest_vote({ session_id }, ['id'])

        const CONTEST_VOTE_EXISTS = Boolean(contest_vote);

        if( CONTEST_VOTE_EXISTS )
            return console.error("Transaction has been resolved");

        // Enqueue the job
        await this.contest_queue.add(payload)

        await this.repo.create_contest_vote_audit_log( payload );

    }

    async process_contest_vote( payload: ProcessContestVote ){

        const contest = await this.repo.get_contest({ id: payload.contest_id }, ['name', 'end_time']);

        if( !contest )
            return this.logger.error("Contest not found");

        const CONTEST_HAS_ENDED = moment().diff(moment(contest.end_time)) > 0;

        if( CONTEST_HAS_ENDED )
            return this.process_contest_vote_refund(payload);

        const contest_vote = await this.repo.get_contest_vote({ session_id: payload.session_id }, ['id']);
        if (contest_vote)
            return this.logger.error("Vote already counted");

        const user = await this.user_repo.get_user_by_id( payload.UserId, ['email']);

        const contestant = await this.repo.get_contestant({ id: payload.ContestantId }, ['name']);

        let contest_voter = await this.repo.get_contest_voter({ email: payload.email, ContestId: payload.contest_id }, ['id', 'name', 'email']);

        if( !contest_voter )
            contest_voter = await this.repo.create_contest_voter({ name: payload.name, email: payload.email, ContestId: payload.contest_id });

        let contest_financial_record = await this.repo.get_contest_financial_record({
            ContestId: payload.contest_id
        }, ['id'])

        if( !contest_financial_record ) 
            contest_financial_record = await this.repo.create_contest_financial_record( payload.contest_id, payload.UserId );

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        const net_amount = Number(payload.amount_paid) - (0.1 * Number(payload.amount_paid));

        try {

            await Promise.all([

                this.repo.create_contest_vote({
                    name: payload.name,
                    email: payload.email,
                    rate: payload.rate,
                    amount_paid: payload.amount_paid,
                    ContestId: payload.contest_id,
                    ContestantId: payload.ContestantId,
                    session_id: payload.session_id,
                    VoterId: contest_voter.id,
                    number_of_votes: payload.votes,
                    UserId: payload.UserId,
                    amount: net_amount
                }, transaction ),

                this.repo.update_contest_financial_record({
                    ContestId: payload.contest_id,
                    total_income: net_amount,
                    total_votes: payload.votes
                }, transaction ),

                this.repo.delete_contest_vote_audit_log( payload.session_id )

            ])

            await transaction.commit();

            try {

                const hour_offset = (moment().utcOffset() / 60) - 1;

                await Promise.all([

                    this.email_service.send({
                        subject: "✅ Your Vote Has Been Counted — Thank You for Participating!",
                        to: contest_voter.email,
                        body: contesat_vote_counted_template({
                            name: contest_voter.name.split(" ")[0],
                            contest_name: contest.name,
                            contestant_name: contestant.name,
                            amount_paid: payload.amount_paid,
                            date: moment().subtract(hour_offset, "hours").format("YYYY-MM-DD hh:mm A"),
                            no_of_votes: payload.votes
                        })
                    }),
 
                    this.email_service.send({
                        subject: `🗳️ A New Vote Has Been Cast in Your Contest: "${ contest.name }"`,
                        to: user.email,
                        body: contest_payment_template({
                            name: payload.name,
                            contest_name: contest.name,
                            vote_time: moment().subtract(hour_offset, "hours").format('Do MMM, YYYY'),
                            no_of_votes_paid_for: payload.votes,
                            amount_paid: format_currency( payload.amount_paid )
                        })
                    })
                ])

            }
            catch(e){

                // retry mechanism
                console.error(e)

            }

        }

        catch(e: any){

            await transaction.rollback();

        }



    }

    async process_contest_vote_refund( payload: ProcessContestVote ){

        const existing_refund = await this.repo.get_vote_refund({ session_id: payload.session_id }, ['id']);

        if( existing_refund )
            return this.logger.error("Refund exists");

        const contest = await this.repo.get_contest({ id: payload.contest_id }, ['name', 'end_time']);

        if( !contest )
            return this.logger.error("Contest not found");

        const net_amount = Number(payload.amount_paid) - (0.1 * Number(payload.amount_paid));

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        })

        try {

            await this.repo.create_vote_refund({
                name: payload.name,
                email: payload.email,
                rate: payload.rate,
                amount_paid: payload.amount_paid,
                ContestId: payload.contest_id,
                ContestantId: payload.ContestantId,
                session_id: payload.session_id,
                number_of_votes: payload.votes,
                UserId: payload.UserId,
                amount: net_amount,
                transfer_status: "pending"
            })

            this.repo.delete_contest_vote_audit_log( payload.session_id )
    
            await this.email_service.send({
                to: payload.email,
                subject: `Refund for Your Vote – ${contest.name}`,
                body: contest_refund_email_template({
                    contest_name: contest.name,
                    name: payload.name.split(" ")[0],
                    add_bank_details_link: `https://smoothballot.app/c/refund?session_id=${payload.session_id}`,
                    track_refund_link: `https://smoothballot.app/c/refund/track?session_id=${payload.session_id}`,
                })
            })

            await transaction.commit();
    
        }

        catch(e){

            await transaction.rollback();

            this.logger.error(e);

        }

        


    }

    async get_contest_votes( payload: GetContestVotes ){

        const { contest_votes, count } = await this.repo.get_contest_votes( payload.filter, payload.page, payload.per_page );

        let response: any = {
            contest_votes,
            count
        } 

        response.financial_record = await this.repo.get_financial_record( payload.filter )

        return response;

    }

    async get_oranizer_profile( user_id: number ){

        const organizer_profile = await this.repo.get_contest_organizer_profile({
            UserId: user_id
        })

        delete organizer_profile.recipient_id;
        delete organizer_profile.id;

        return organizer_profile;
        
    }

    async process_contest_revenue_transfer( payload: ProcessContestRevenueTransfer ): Promise<string | null> {

        const financial_record_id = payload.financial_record_id;
        let amount = payload.amount;
        const initiated_by = payload.initiated_by;

        let financial_record = await this.repo.get_financial_record({ id: financial_record_id  });

        if( !financial_record ){
            const error_message = `Financial record not found; ${financial_record_id}`;
            this.logger.error(error_message);
            return error_message
        }

        financial_record.amount_due_for_payout = parseFloat(financial_record.amount_due_for_payout as any );

        if( amount ){
            amount = Math.abs(amount);
            if( financial_record.amount_due_for_payout < amount ){
                const error_message = `Insufficient balane Amount: ${amount} Balance: ${financial_record.amount_due_for_payout}`;
                this.logger.error(error_message);
                return error_message
            }
            financial_record.amount_due_for_payout = amount;
        }

        const organizer_profile = await this.repo.get_contest_organizer_profile({ UserId: financial_record.UserId });

        if( !organizer_profile.account_number ){
            const error_message = `Transfer failed due to abscence account number:${organizer_profile.UserId}`;
            this.logger.error(error_message);
            return error_message
        }
            
        const contest = await this.repo.get_contest({ id: financial_record.ContestId  }, ['name']);

        if( !organizer_profile.recipient_id ){

            const recipient_repsonse = await this.payment_service.create_recipient({
                type: 'nuban',
                name: organizer_profile.account_name,
                account_number: organizer_profile.account_number,
                bank_code: organizer_profile.bank_code
            });

            if(!recipient_repsonse.status){
                const error_message = `Transfer failed due to the inability to create reciepient: ${organizer_profile.UserId}`;
                this.logger.error(error_message);
                return error_message
            }
                

            organizer_profile.recipient_id = recipient_repsonse.data.recipient_code;

            await this.repo.update_contest_organizer_profile({
                recipient_id: recipient_repsonse.data.recipient_code
            }, { UserId: organizer_profile.UserId })

        }

        const bank_transfer_payload = {
            recipient: organizer_profile.recipient_id,
            reason: `Contest Revenue ${contest.name} `,
            amount: financial_record.amount_due_for_payout * 100,
            source: "balance",
        }

        const transfer_response = await this.payment_service.initiate_transfer(bank_transfer_payload)

        if( !(transfer_response as BadRequest).status ){
            const error_message = `Transfer failed: ${(transfer_response as BadRequest).message} Id: ${financial_record.id}`;
            this.logger.error(error_message);
            return error_message;
        }
            
        const transfer_response_data = (transfer_response as TransferInitiated).data;

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        })

        try {

            await Promise.all([

                this.repo.create_contest_payout({
                    ContestId: financial_record.ContestId,
                    UserId: financial_record.UserId,
                    amount: financial_record.amount_due_for_payout,
                    transfer_status: 'transfering',
                    account_name: organizer_profile.account_name,
                    account_number: organizer_profile.account_number,
                    bank_code: organizer_profile.bank_code,
                    transfer_code: transfer_response_data.transfer_code,
                    recipient_code: organizer_profile.recipient_id,
                    bank_name: organizer_profile.bank_name,
                    initiated_by
                }, transaction),

                this.repo.debit_amount_due_for_payout({
                    id: financial_record_id
                }, financial_record.amount_due_for_payout, transaction)

            ])

            await transaction.commit()

        }
        catch(e: any){
            this.logger.error(e)
            await transaction.rollback()
            return "Something went wrong!"
        }

        return null

    }

    async get_contest_report_data( contest_id: number ){

        const contest = await this.repo.get_contest({ id: contest_id });

        const contest_profile = await this.repo.get_financial_record({ ContestId: contest_id });

        const transactions = await this.repo.get_contest_votes_unpaginated({ ContestId: contest_id, transfer_status: "successful" });

        const total_amount_of_successful_transaction = await this.repo.get_transaction_amount({ContestId: contest_id, transfer_status: "successful"})

        const user = await this.user_repo.get_user_by_id( contest.UserId, ['email', 'name'] );

        (typeof transactions)

        const data: ContestRevenueReportData = {
            contest: {
                contest_name: contest.name,
                contest_slug: contest.slug,
                contest_organizer: user.name,
                contest_organizer_email: user.email,
                total_revenue: total_amount_of_successful_transaction
            },
            transactions: transactions as Required<ChildOf<typeof transactions>>[]
        }

        return data;

    }

    async generate_contest_revenue_report( user_id: number, contest_id: number ){

        const contest = await this.repo.get_contest({ id: contest_id, UserId: user_id, }, ['report']);

        if( !contest )
            throw new NotFoundException("Contest not found");

        const job = await this.job_repo.get_most_recent_job({ Userid: user_id, type: "contest-revenue-report-generation" })

        console.log({contest,
            job
        })

        if( job?.status === "pending" ){
            return {
                message: "The revenue report is currently being generated. This may take a few moments. Please check back shortly to access the finalized report.",
                report: contest.report,
                status: "pending"
            }
        }

        else if( job?.status === "done" && moment().diff(moment(contest?.report?.expiry)) < 0 ) {
            return {
                message: "Your contest revenue report has been successfully generated and is now ready for download.",
                report: contest.report,
                status: "done"
            }
        }

        else {

            const job = await this.job_repo.create({
                Userid: user_id,
                type: "contest-revenue-report-generation",
                status: "pending",
                payload: {
                    contest_id
                }
            })

            await this.contest_report_generation_queue.add({ contest_id, job_id: job.id })

            return {
                message: "The revenue report is currently being generated. This may take a few moments. Please check back shortly to access the finalized report.",
                report: contest?.report,
                status: "pending"
            }

        }


    }

    async add_bank_details_to_refund( payload: Pick<ContestVoteRefundModelInterface, "bank_code" | "bank_name" | "session_id" | "account_number"> ){

        const existing_refund = await this.repo.get_vote_refund({ session_id: payload.session_id }, ['id', 'recipient_code']);
        
        if( !existing_refund )
            throw new NotFoundException('Refund not found!');

        if( existing_refund.recipient_code )
            throw new BadRequestException('Bank details added already!')

        const resolve_account_number_response = await this.payment_service.resolve_account_number({
            account_number: payload.account_number,
            bank_code: payload.bank_code
        })

        if( !(resolve_account_number_response as BadRequest).status )
            throw new BadRequestException("Unable to resolve account number")

        const resolve_account_number_response_data = (resolve_account_number_response as AccountResolved).data;

        const create_recipient_response = await this.payment_service.create_recipient({
            bank_code: payload.bank_code,
            account_number: payload.account_number,
            type: "nuban",
            name: resolve_account_number_response_data.account_name
        })

        if( !(create_recipient_response as BadRequest).status )
            throw new InternalServerErrorException("Something went wrong!")

        const create_recipient_response_data = (create_recipient_response as RecipientCreatedResponse).data;

        await this.repo.update_vote_refund(
            {
                account_name: resolve_account_number_response_data.account_name,
                account_number: payload.account_number,
                bank_code: payload.bank_code,
                bank_name: payload.bank_name,
                recipient_code: create_recipient_response_data.recipient_code
            },
            { session_id: payload.session_id }
        )

    }

    async get_payouts(payload: GetContestPayouts){

        const response = await this.repo.get_contest_payout(payload.filter, payload.page, payload.per_page );
        const financial_record = await this.repo.get_financial_record(payload.filter)

        return {
            ...response,
            financial_record
        }

    }

    @Cron("*/5 * * * *", { name: "verify transfer cron"})
    async initiate_contest_revenue_transfer(){

        this.logger.log('Staring Transfer Initiation')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        const financial_records_due_for_debit = await this.repo.get_financial_records_due_for_debit();

        for( let _record of financial_records_due_for_debit ){

            const record = _record.toJSON();

            await this.contest_revenue_transfer_queue.add({
                financial_record_id: record.id,
                initiated_by: 'system'
            })
        
        }
        
    }

    @Cron("*/10 * * * *", { name: "Audit Transfer cron"})
    async audit_contest_vote_logs(){

        this.logger.log('Staring Vote Auditing')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        const stale_logs = await this.repo.get_stale_contest_vote_logs();

        for( let log of stale_logs ){
            await this.contest_queue.add( log )
        }
    }

    @Cron("*/30 * * * *", { name: "Verify Revenue Transfer" })
    async verify_revenue_transfer(){

        this.logger.log('Staring Vote Auditing')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        const { payouts: pending_payouts } = await this.repo.get_contest_payout({ transfer_status: "transfering" }, 1, 50);

        for ( let payout of pending_payouts ){

            const paystack_transfer_response = await this.payment_service.fetch_transfer(payout.transfer_code);

            if( paystack_transfer_response.status ){

                const transfer = ( paystack_transfer_response as TransferInitiated ).data;

                if( transfer.status === "success" ){
                    await this.repo.update_contest_payout({
                        transfer_status: "successful",
                        transfer_confirmation_date: moment().toISOString()
                    }, { id: payout.id })
                }

                else continue

            }

            else continue
            

        }
    }

    @Cron("*/30 * * * *", { name: "Refund Cron" })
    async initiate_vote_refund_transfer(){

        this.logger.log('Staring Refund Cron')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        const refunds = await this.repo.get_vote_refund_due_for_initiation(1, 50);

        const contest_name_hash = {};

        for( let refund of refunds ){

            let contest_name: string;

            if( !contest_name_hash[refund.ContestId] ){

                const contest = await this.repo.get_contest({ id: refund.ContestId }, ['name']);

                contest_name = contest.name ?? "CONTEST";

                contest_name_hash[refund.ContestId] = contest_name;

            }
                
            else contest_name = contest_name_hash[refund.ContestId]           

            const transfer_response = await this.payment_service.initiate_transfer({
                recipient: refund.recipient_code,
                reason: `Contest Refund-${refund.session_id.split("-")[0]}-${contest_name}`,
                amount: refund.amount * 100,
                source: "balance"
            })

            if( !(transfer_response as BadRequest).status )
                return this.logger.error(`Transfer failed: ${(transfer_response as BadRequest).message} Id: ${refund.id}`);

            const transfer_response_data = (transfer_response as TransferInitiated).data;

            await this.repo.update_vote_refund({
                transfer_status: "transfering",
                transfer_code: transfer_response_data.transfer_code
            }, { id: refund.id })

        }

    }

    @Cron("*/40 * * * *", { name: "Verify Revenue Transfer" })
    async verify_refund_transfer(){

        this.logger.log('Staring Refund Verification')

        if( process.env?.RUN_CRON !== 'true' ) return this.logger.log('Unable to run cron not a cron server');

        const refunds = await this.repo.get_vote_refund_due_for_verification(1, 50);

        for( let refund of refunds ){

            const paystack_transfer_response = await this.payment_service.fetch_transfer(refund.transfer_code);

            if( paystack_transfer_response.status ){

                const transfer = ( paystack_transfer_response as TransferInitiated ).data;

                if( transfer.status === "success" ){
                    await this.repo.update_vote_refund({
                        transfer_status: "successful",
                        transfer_confirmation_date: moment().toISOString()
                    }, { id: refund.id })
                }

            }

        }
    }

}

