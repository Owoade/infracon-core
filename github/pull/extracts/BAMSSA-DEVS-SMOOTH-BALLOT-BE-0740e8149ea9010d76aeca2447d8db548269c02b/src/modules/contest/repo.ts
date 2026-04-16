import { Inject, Injectable } from "@nestjs/common";
import { CONTEST_FINANCIAL_RECORD_MODEL_PROVIDER, CONTEST_MODEL_PROVIDER, CONTEST_ORGANIZER_MODEL_PROVIDER, CONTEST_PAYMENT_MODEL_PROVIDER, CONTEST_PAYOUT_MODEL_PROVIDER, CONTEST_VOTE_MODEL_PROVIDER, CONTEST_VOTE_REFUND_MODEL_PROVIDER, CONTEST_VOTER_MODEL_PROVIDER, CONTESTANT_MODEL_PROVIDER } from "./model";
import { InferedSchemaType } from "@utils/schema";
import { ContestantModelInterface, ContestFinancialRecordMoelInterface, ContestModelInterface, ContestOrganizerProfileInterface, ContestPaymentInterface, ContestPayoutModelInterface, ContestVoteModelInterface, ContestVoteRefundModelInterface, ContestVoterModelInterface, ProcessContestVote } from "./type";
import { Op, Sequelize, Transaction } from "sequelize";
import VoteContestAuditLog from "@db/mongo/models/vote-contest-audit-log";
import * as moment from "moment";

@Injectable()
export class ContestRepository {
    constructor(

        @Inject(CONTEST_MODEL_PROVIDER)
        private ContestModel: InferedSchemaType<ContestModelInterface>,

        @Inject(CONTESTANT_MODEL_PROVIDER)
        private ContestantModel: InferedSchemaType<ContestantModelInterface>,

        @Inject(CONTEST_ORGANIZER_MODEL_PROVIDER)
        private ContestOrganizerProfileModel: InferedSchemaType<ContestOrganizerProfileInterface>,

        @Inject(CONTEST_FINANCIAL_RECORD_MODEL_PROVIDER)
        private ContestFinancialRecordModel: InferedSchemaType<ContestFinancialRecordMoelInterface>,

        @Inject(CONTEST_VOTER_MODEL_PROVIDER)
        private ContestVoterModel: InferedSchemaType<ContestVoterModelInterface>,

        @Inject(CONTEST_VOTE_MODEL_PROVIDER)
        private ContestVoteModel: InferedSchemaType<ContestVoteModelInterface>,

        @Inject(CONTEST_PAYMENT_MODEL_PROVIDER)
        private ContestPaymentModel: InferedSchemaType<ContestPaymentInterface>,

        @Inject(CONTEST_VOTE_REFUND_MODEL_PROVIDER)
        private ContestVoteRefundModel: InferedSchemaType<ContestVoteRefundModelInterface>,

        @Inject(CONTEST_PAYOUT_MODEL_PROVIDER)
        private ContestPayoutModel: InferedSchemaType<ContestPayoutModelInterface>
        
    ){}

    async create_contest( payload: ContestModelInterface ){

        const contest = await this.ContestModel.create( payload );

        return contest.toJSON();

    }

    async udpdate_contest( payload: Partial<ContestModelInterface>, filter: Partial<ContestModelInterface> ){

        const updated_contest = await this.ContestModel.update( payload, { where: filter, returning: true });

        return updated_contest?.[1]?.[0]?.toJSON();

    }

    async get_contest( filter: Partial<ContestModelInterface> ): Promise<ContestModelInterface>
    async get_contest<T extends keyof ContestModelInterface>( filter: Partial<ContestModelInterface>, attributes: T[] ): Promise<Pick<ContestModelInterface, T>>
    async get_contest<T extends keyof ContestModelInterface>( filter: Partial<ContestModelInterface>, attributes?: T[] ){

        const constest = await this.ContestModel.findOne({ where: filter, ...( attributes ? { attributes }: {}) });

        if( attributes ) return constest?.toJSON() as Pick<ContestModelInterface, T>;

        else return constest?.toJSON() as ContestModelInterface;

    }

    async get_contests( filter: Partial<ContestModelInterface>, page: number, per_page: number ){

        const count = await this.ContestModel.count({ where: filter });

        const contests = await this.ContestModel.findAll({ where: filter, limit: per_page, offset: ( page - 1 ) * per_page });

        return {
            count,
            contests
        };

    }

    async create_contestant( payload: ContestantModelInterface ){

        const contestant = await this.ContestantModel.create( payload );

        return contestant?.toJSON();

    }

    async get_contestant( filter: Partial<ContestantModelInterface> ): Promise<ContestantModelInterface>
    async get_contestant<T extends keyof ContestantModelInterface>( filter: Partial<ContestantModelInterface>, attributes: T[] ): Promise<Pick<ContestantModelInterface, T>>
    async get_contestant<T extends keyof ContestantModelInterface>( filter: Partial<ContestantModelInterface>, attributes?: T[] ){

        (filter as any).is_deleted = null;

        const constestant = await this.ContestantModel.findOne({ where: filter, ...( attributes ? { attributes }: {}) });

        if( attributes ) return constestant?.toJSON() as Pick<ContestantModelInterface, T>;

        else return constestant?.toJSON() as ContestantModelInterface;

    }

    async udpdate_contestant( payload: Partial<ContestantModelInterface>, filter: Partial<ContestantModelInterface> ){

        const updated_contestant = await this.ContestantModel.update( payload, { where: filter, returning: true });

        return updated_contestant?.[1]?.[0]?.toJSON();

    }

    async get_contestants( filter: Partial<ContestantModelInterface>, page: number, per_page: number, search?: string ){

        (filter as any).is_deleted = null

        const count = await this.ContestantModel.count({
            where: {
                [Op.and]: [
                    filter,
                    ( search && Sequelize.where(Sequelize.col("name"), { [Op.iLike]: `%${search.toLowerCase()}%`} ))
                ],
            }, 
        })

        const contestants = await this.ContestantModel.findAll(
            { 
                where: {
                    [Op.and]: [
                        filter,
                        ( search && Sequelize.where(Sequelize.fn('LOWER', Sequelize.col("Contestants.name")), { [Op.like]: `%${search.toLowerCase()}%`} ))   
                    ]
                },
                attributes: {
                    include: [[Sequelize.fn("SUM", Sequelize.col("ContestVotes.number_of_votes")), "vote_count"]]
                },
                include: [
                    {
                        model: this.ContestVoteModel,
                        attributes: []
                    }
                ], 
                group: ["Contestants.id"],
                limit: per_page, 
                offset: per_page * (page-1),
                subQuery: false,
                order:[Sequelize.literal('vote_count DESC NULLS LAST')]
            }
        );
        
        return {
            count,
            contestants
        };

    }

    async get_unevicted_contestants( filter: Partial<ContestantModelInterface>, page: number, per_page: number, opts?: { search: string, hide_live_votes?: boolean} ){

        (filter as any).is_deleted = null;
        (filter as any)[Op.or] = [
            { evicted: null },
            { evicted: false }
        ]
        
        const count = await this.ContestantModel.count({
            where: {
                [Op.and]: [
                    filter,
                    ( opts.search && Sequelize.where(Sequelize.fn('LOWER', Sequelize.col("name")), { [Op.like]: `%${opts.search.toLowerCase()}%`} ))
                ],
            }, 
        })

        const contestants = await this.ContestantModel.findAll(
            { 
                where: {
                    [Op.and]: [
                        filter,
                        ( opts.search && Sequelize.where(Sequelize.fn('LOWER', Sequelize.col("Contestants.name")), { [Op.like]: `%${opts.search.toLowerCase()}%`} ))   
                    ]
                },
                attributes: {
                    ...(!opts.hide_live_votes ? {include: [
                         [Sequelize.fn("SUM", Sequelize.col("ContestVotes.number_of_votes")), "vote_count"]
                    ]} : [])
                },
                include: [
                    {
                        model: this.ContestVoteModel,
                        attributes: []
                    }
                ], 
                group: ["Contestants.id"],
                limit: per_page, 
                offset: per_page * (page-1),
                subQuery: false,
                order:[Sequelize.literal( !opts.hide_live_votes  ? 'vote_count DESC NULLS LAST' : 'name ASC NULLS LAST')]
            }
        );
        
        return {
            count,
            contestants
        };

    }

    async delete_contestant( filter: Partial<ContestantModelInterface> ){

        await this.ContestantModel.update(
            { is_deleted: true }, 
            { where: filter }
        )

    }

    async create_contest_organizer_profile( payload: ContestOrganizerProfileInterface ){

        const new_profile = await this.ContestOrganizerProfileModel.create( payload );

        return new_profile.toJSON();

    }

    async get_contest_organizer_profile<T extends keyof ContestOrganizerProfileInterface>( filter: Partial<ContestOrganizerProfileInterface>, attributes?: T[] ){

        const profile = await this.ContestOrganizerProfileModel.findOne({
            where: filter,
            ...( attributes && { attributes } )
        })

        if( attributes ) return profile?.toJSON() as Pick<ContestOrganizerProfileInterface, T>;

        else return profile?.toJSON() as ContestOrganizerProfileInterface;

    }

    async update_contest_organizer_profile( update: Partial<ContestOrganizerProfileInterface>, filter: Partial<ContestOrganizerProfileInterface> ){

        const updated_profile = await this.ContestOrganizerProfileModel.update(update, {
            where: filter,
            returning: true
        })

        return updated_profile?.[1]?.[0]?.toJSON();
        
    }

    async create_contest_financial_record( contest_id: number, user_id: number ){

        const financial_record = await this.ContestFinancialRecordModel.create({
            total_income: 0,
            total_votes: 0,
            ContestId: contest_id,
            UserId: user_id
        })

        return financial_record.toJSON();

    }

   async get_contest_payment<T extends keyof ContestPaymentInterface>( filter: Partial<ContestPaymentInterface>, attributes?: T[] ){

        const contest_payment = await this.ContestPaymentModel.findOne({
            where: filter,
            ...( attributes && { attributes } )
        })

        if( attributes ) return contest_payment?.toJSON() as Pick<ContestPaymentInterface, T>

        return contest_payment?.toJSON() as ContestPaymentInterface;
   }

   async create_contest_payment( payload: ContestPaymentInterface ){

        const new_contest_payment = await this.ContestPaymentModel.create( payload );
        
        return new_contest_payment.toJSON()
   }

   async create_contest_vote_audit_log( payload: ProcessContestVote ){

        return await VoteContestAuditLog.create( payload );

   }

   async get_stale_contest_vote_logs(){

        const logs = await VoteContestAuditLog.find({
            createdAt: {
                $lte: moment().subtract(10, 'minutes').toDate()
            }
        })
        .limit(20)
        .exec()

        return logs;

    }

    async get_contest_voter<T extends keyof ContestVoterModelInterface>( filter: Partial<ContestVoterModelInterface>, attributes?: T[] ){

        const contest_voter = await this.ContestVoterModel.findOne({
            where: filter,
            ...( attributes && { attributes })
        })

        if( attributes ) return contest_voter?.toJSON() as Pick<ContestVoterModelInterface, T>;

        return contest_voter?.toJSON() as ContestVoterModelInterface;

    }

    async create_contest_voter( payload: ContestVoterModelInterface ){

        const new_contest_voter = await this.ContestVoterModel.create( payload );

        return new_contest_voter?.toJSON();

    }

    async update_contest_vote( update: Partial<ContestVoteModelInterface>, filter: Partial<ContestVoteModelInterface> ){
        await this.ContestVoteModel.update(update, { where: filter })
    }

    async get_financial_records_due_for_debit(){
        return await this.ContestFinancialRecordModel.findAll({
            where: {
                amount_due_for_payout: {
                    [Op.gt]: 0
                }
            }
        })
    }

    async get_contest_financial_record<T extends keyof ContestFinancialRecordMoelInterface>(
        filter: Partial<ContestFinancialRecordMoelInterface>,
        attributes?: T[]
    ) {
        const financial_record = await this.ContestFinancialRecordModel.findOne({
            where: filter,
            ...(attributes && { attributes })
        });
    
        if (attributes) {
            return financial_record?.toJSON() as Pick<ContestFinancialRecordMoelInterface, T>;
        }
    
        return financial_record?.toJSON() as ContestFinancialRecordMoelInterface;

    }

    async create_contest_vote( payload: ContestVoteModelInterface, transaction: Transaction ){

        const contest_vote = await this.ContestVoteModel.create( payload, { transaction } );

        return contest_vote?.toJSON();

    }

    async create_contest_payment_entry( payload: ContestPaymentInterface, transaction?: Transaction ){

        const contest_payment_entry = await this.ContestPaymentModel.create( payload, { transaction } );

        return contest_payment_entry.toJSON();

    }

    async get_financial_record( filter: Partial<ContestFinancialRecordMoelInterface> ){

        const financial_record = await this.ContestFinancialRecordModel.findOne({
            where: filter
        }) 

        return financial_record?.toJSON();

    }

    async get_contest_votes( filter: Partial<ContestVoteModelInterface>, page: number, per_page: number ){

        const count = await this.ContestVoteModel.count({ where: filter })

        const contest_votes = await this.ContestVoteModel.findAll({
            where: filter,
            limit: per_page, 
            offset: per_page * (page-1) ,
            order: [["createdAt", "DESC"]]
        })

        return {
            count,
            contest_votes
        }
        
    }

    async get_contest_votes_unpaginated( filter: Partial<ContestVoteModelInterface> ){

        const contest_votes = await this.ContestVoteModel.findAll({
            where: filter,
            order: [["createdAt", "ASC"]]
        })

        return contest_votes.map( _ => _.toJSON() );
    }

    async get_contest_vote<T extends keyof ContestVoteModelInterface>( filter: Partial<ContestVoteModelInterface>, attributes?: T[] ){

        const vote = await this.ContestVoteModel.findOne({
            where: filter,
            ...( attributes && { attributes } )
        })

        if( attributes ) return vote?.toJSON() as Pick<ContestVoteModelInterface, T>

        else return vote?.toJSON();

    }

    async update_contest_financial_record( payload: Pick<ContestFinancialRecordMoelInterface, 'ContestId' | 'total_income' | 'total_votes'>, transaction: Transaction ){

        await Promise.all(
            [
                this.ContestFinancialRecordModel.increment(
                    'total_income', 
                    { 
                        by: payload.total_income, 
                        where: { ContestId: payload.ContestId }, 
                        transaction 
                    }
                ),
        
                this.ContestFinancialRecordModel.increment(
                    'total_votes',
                    {
                        by: payload.total_votes,
                        where: { ContestId: payload.ContestId }, 
                        transaction 
        
                    }
                ),

                this.ContestFinancialRecordModel.increment(
                    'amount_due_for_payout',
                    {
                        by: payload.total_income,
                        where: { ContestId: payload.ContestId }, 
                        transaction 
        
                    }
                )
            ]
        )

    }

    async debit_amount_due_for_payout( filter:Partial<ContestFinancialRecordMoelInterface>, amount: number, transaction: Transaction ){
        this.ContestFinancialRecordModel.decrement(
            'amount_due_for_payout',
            {
                by: amount,
                where: filter, 
                transaction 

            }
        )
    }

    async delete_contest_vote_audit_log( session_id: string ){

        await VoteContestAuditLog.deleteOne({ session_id });

    }

    async get_contest_votes_count( filter: Partial<ContestVoteModelInterface> ){

        const vote_count = await this.ContestVoteModel.aggregate("number_of_votes", "SUM", {
            where: filter
        })

        return parseInt(vote_count as string) || 0;
        
    }

    async get_transaction_amount( filter: Partial<ContestVoteModelInterface> ){

        const amount = await this.ContestVoteModel.aggregate("amount", "SUM", {
            where: filter
        })

        return parseInt(amount as string) || 0;

    }

    async create_vote_refund( payload: ContestVoteRefundModelInterface ){

        const refund = await this.ContestVoteRefundModel.create( payload );

        return refund.toJSON();

    }

    async get_vote_refund<T extends (keyof ContestVoteRefundModelInterface)>( filter: Partial<ContestVoteRefundModelInterface>, attributes?: T[] ){

        const refund = await this.ContestVoteRefundModel.findOne({
            where: filter,
            ...( attributes ? attributes : [] )
        })

        return attributes?.length ? refund?.toJSON() as Pick<ContestVoteRefundModelInterface, T> : refund?.toJSON();
        
    }

    async get_vote_refund_due_for_initiation( page: number, per_page: number ){

        const refunds = await this.ContestVoteRefundModel.findAll({
            where: {
                transfer_status: "pending",
                recipient_code: {
                    [Op.not]: null
                }
            },
            limit: per_page, 
            offset: per_page * (page-1),
            order: [["amount", "ASC"]]
        })

        return refunds.map( _ => _.toJSON() );

    }

    async get_vote_refund_due_for_verification( page: number, per_page: number ){

        const refunds = await this.ContestVoteRefundModel.findAll({
            where: {
                transfer_status: "transfering",
            },
            limit: per_page, 
            offset: per_page * (page-1),
            order: [["amount", "ASC"]]
        })

        return refunds.map( _ => _.toJSON() );

    }

    async update_vote_refund( update: Partial<ContestVoteRefundModelInterface>, filter: Partial<ContestVoteRefundModelInterface> ){

        const updated_refund = await this.ContestVoteRefundModel.update(update, {
            where: filter,
            returning: true
        })

        return updated_refund?.[1]?.[0]?.toJSON();

    }

    async create_contest_payout( payload: ContestPayoutModelInterface, transaction: Transaction ){
        return await this.ContestPayoutModel.create(payload, { transaction })
    }

    async update_contest_payout(update: Partial<ContestPayoutModelInterface>, filter: Partial<ContestPayoutModelInterface>){
        
        const updated_payout = await this.ContestPayoutModel.update(update, {
            where: filter,
            returning: true
        })

        return updated_payout?.[1]?.[0]?.toJSON();

    }

    async get_contest_payout( filter: Partial<ContestPayoutModelInterface>, page: number, per_page: number ){

        const count = await this.ContestPayoutModel.count({
            where: filter
        })

        const payouts = await this.ContestPayoutModel.findAll({
            where: filter,
            limit: per_page, 
            offset: per_page * (page-1),
            order: [['createdAt', "DESC"]]
        })

        return {
            count,
            payouts: payouts.map( _ => _.toJSON() )
        };

    }

    async get_contest_statistics(){

        const total_contest = await this.ContestModel.count();
        const total_revenue = await this.ContestFinancialRecordModel.aggregate('total_income', 'SUM');
        const total_votes = await this.ContestFinancialRecordModel.aggregate('total_votes', 'SUM');
        const total_amount_due_for_payout = await this.ContestFinancialRecordModel.aggregate('amount_due_for_payout', 'SUM');

        return {
            total_contest,
            total_revenue,
            total_votes,
            total_amount_due_for_payout
        }
        
    }

}