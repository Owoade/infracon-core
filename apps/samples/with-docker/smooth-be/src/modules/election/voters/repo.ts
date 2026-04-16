import { Inject, Injectable } from "@nestjs/common";
import { VOTERS_MODEL_PROVIDER } from "../models/voter.model";
import { InferedSchemaType } from "@utils/schema";
import { ElectionModelInrterface, GetAccreditedVoters, GetVotersWithFilter, VoteAuditLogModelInterface, VoteModelInterface, VoteProfileModelInterface, VoterModelInterface } from "../type";
import { Op, QueryTypes, Sequelize, Transaction, where, WhereOptions } from "sequelize";
import { VOTE_MODEL_PROVIDER, VOTE_PROFILE_MODEL_PROVIDER } from "../models/vote";
import VoteAuditLog from "@db/mongo/models/vote-audit-log";
import * as moment from "moment";
import { ProcessContestVote } from "@modules/contest/type";
import VoteContestAuditLog from "@db/mongo/models/vote-contest-audit-log";
import { VoterAuthpayload } from "@modules/core/email/template/voters-auth";
import VotersAuthEmailJob from "@db/mongo/models/voter-email";
import VoterAuthEmailBatchJob from "@db/mongo/models/voter-email-batch";
import { Where } from "sequelize/types/utils";
import db from "@db/postgres";

@Injectable()
export class VotersRepository {
    constructor(
        @Inject(VOTERS_MODEL_PROVIDER)
        private VoterModel: InferedSchemaType<VoterModelInterface>,

        @Inject(VOTE_MODEL_PROVIDER)
        private VoteModel: InferedSchemaType<VoteModelInterface>,

        @Inject(VOTE_PROFILE_MODEL_PROVIDER)
        private VoteProfileModel: InferedSchemaType<VoteProfileModelInterface>
    ){}

    async create_voter( payload: VoterModelInterface ){
        
        payload.is_suspended = false;

        const new_voter = await this.VoterModel.create(payload);

        return new_voter.toJSON();

    }

    async update_voter( filter: Partial<VoterModelInterface>, update: Partial<VoterModelInterface>, transaction?: Transaction ){

        const updated_voter = await this.VoterModel.update(update, { where: filter, returning: true, ...( transaction ? { transaction }: {} ) });

        return updated_voter?.[1]?.[0];

    }

    async get_last_voter( election_id: number, attributes: (keyof VoterModelInterface)[] ){

        const voter = await this.VoterModel.findOne({
            where: {
                ElectionId: election_id
            },
            order: [["createdAt", "DESC"]],
            ...( attributes ? { attributes }: {})
        })

        return voter?.toJSON();

    }

    async update_multiple_voters(update: Partial<VoterModelInterface>, voter_ids: number[], filter: Partial<VoterModelInterface>){

        const updated_voters = await this.VoterModel.update(update, {
            where: {
                ...filter,
                id: {
                    [Op.in]: voter_ids
                }
            },
            returning: true
        })

        return updated_voters?.[1];

    }

    async delete_multiple_voters( voter_ids: number[], filter: Partial<VoterModelInterface> ){

        await this.VoterModel.destroy({
            where: {
                ...filter,
                has_voted: null,
                id: {
                    [Op.in]: voter_ids
                } 
            }
        })

    }

    async get_voter_by_filter( filter: Partial<VoterModelInterface> ): Promise<VoterModelInterface>
    async get_voter_by_filter<T extends keyof VoterModelInterface>( filter: Partial<VoterModelInterface>, attributes?: T[] ): Promise<Pick<VoterModelInterface, T>>
    async get_voter_by_filter<T extends keyof VoterModelInterface>( filter: Partial<VoterModelInterface>, attributes?: T[] ){

        const voter = (await this.VoterModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        }))?.toJSON();

        if( attributes ) return voter as Pick<VoterModelInterface, T>

        return voter;

    }

    async get_voters( election_id: number, user_id: number, page: number, per_page: number ){

        const voters = await this.VoterModel.findAll({
            where: {
                UserId: user_id,
                ElectionId: election_id
            },
            limit: per_page,
            offset: per_page * ( page - 1 )
        })

        return voters;

    }

    async get_voters_by_filter( filter: Partial<VoterModelInterface>, opts?: { page: number, per_page: number, advanced_filter: WhereOptions<VoterModelInterface> } ){

        const voters = await this.VoterModel.findAll({
            where: {
                [Op.and]: [
                    filter,
                    ...(opts?.advanced_filter ? [opts.advanced_filter] : [] )
                ]
            },
            ...( opts && { limit: opts.per_page,
                offset: opts.per_page * ( opts.page - 1 )})
        })

        return voters;

    }

    async get_voters_with_filter_and_paginate( payload: GetVotersWithFilter ){

        if( payload.search ){

            payload.filter.email = {
                [Op.like]: `%${payload.search.toLowerCase()}%`
            } as any
        }

        if( !payload.filter.UserId )
            delete payload.filter.UserId;

        let filter = [];

        if( payload.query ){

            const pairs = Object.entries(payload.query);

            for( let [ key, value ] of pairs ){
                filter.push(
                    Sequelize.where(Sequelize.literal(`"data"->>'${key}'`), "=", value)
                )
            }

        }

        const [ count, voters ] = await Promise.all([

            this.VoterModel.count({  where: {
                [Op.and]: [
                    payload.filter,
                    ...filter
                ]
            }, }),

            this.VoterModel.findAll({
                where: {
                    [Op.and]: [
                        payload.filter,
                        ...filter
                    ]
                },
                attributes: {
                    exclude: ['password', "has_sent_voters_auth_credential"]
                },
                limit: payload.per_page,
                offset: payload.per_page * ( payload.page - 1 ),
                order: [["createdAt", "DESC"]]
            })

        ])

        return { voters, count }

    }

    async delete_voter( filter: Partial<VoterModelInterface> ){

        await this.VoterModel.destroy({
            where: filter
        })

    }

    async bulk_insert_voters( voters: VoterModelInterface[], transaction?: Transaction ){

        await this.VoterModel.bulkCreate(voters, { ...( transaction ? { transaction } : {} )});
        
    }

    async get_voters_by_ids( voter_ids: number[], filter: Partial<VoterModelInterface>, attributes: (keyof VoterModelInterface)[], page: number = 1, per_page: number = 100 ){

        return await Promise.all([

          this.VoterModel.count({
            where: {
                id: {
                  [Op.in]: voter_ids,
                },
                ...filter,
              },
          }),

          this.VoterModel.findAll({
            where: {
              id: {
                [Op.in]: voter_ids,
              },
              ...filter,
            },
            offset: per_page * (page - 1),
            limit: per_page,
            ...(attributes ? { attributes } : {}),
          })

        ]);

    }

    async update_email_sent_count( voter_ids: number[], filter: Partial<VoterModelInterface> ){

        await this.VoterModel.increment('email_sent', { by: 1, where:{ 
            ...filter,
            id: {
                [Op.in]: voter_ids,
            },
        }});

        await this.VoterModel.update({ has_sent_voters_auth_credential: true }, { where: {
            ...filter,
            id: {
                [Op.in]: voter_ids,
            },
        }})

    }

    async get_voters_with_exceeded_email_limit<T extends keyof VoterModelInterface>( voter_ids: number[], filter: Partial<VoterModelInterface>, attributes?: T[] ){

        const voters = await this.VoterModel.findAll({
            where: {
                ...filter,
                id: {
                    [Op.in]: voter_ids,
                },
                email_sent: {
                    [Op.gte]: 3
                }
            }
        })

        return voters.map((voter) =>
          attributes
            ? (voter.toJSON() as Pick<VoterModelInterface, T>)
            : (voter.toJSON() as VoterModelInterface),
        );

    }

    async get_voters_by_election_id( election_id: number, page: number = 1, per_page: number = 50 ){

        const [ count, voters ] = await Promise.all([

            this.VoterModel.count({
                where: {
                    ElectionId:election_id
                }
            }),

            this.VoterModel.findAll({
                where: {
                    ElectionId: election_id
                },
                offset: per_page * ( page - 1 ),
                limit: per_page,
                attributes: ["email", "password"]
            })

        ])

        return { count, voters };

    }

    async get_voters_count( filter: Partial<VoterModelInterface> ){

        return await this.VoterModel.count({
            where: filter
        });

    }

    async get_votes_count( filter: Partial<VoteModelInterface> ){

        return await this.VoteModel.count({
            where: filter
        });

    }

    async get_votes_weight( filter: Partial<VoteModelInterface> ){

        return await this.VoteModel.aggregate("weight", "SUM", { where: filter }) as number;
        
    }


    async get_vote_profile_by_filter( filter: Partial<VoteProfileModelInterface> ): Promise<VoteProfileModelInterface>
    async get_vote_profile_by_filter<T extends keyof VoteProfileModelInterface>( filter: Partial<VoteProfileModelInterface>, attributes?: T[] ): Promise<Pick<VoteProfileModelInterface, T>>
    async get_vote_profile_by_filter<T extends keyof VoteProfileModelInterface>( filter: Partial<VoteProfileModelInterface>, attributes?: T[] ){

        const voter = (await this.VoteProfileModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        }))?.toJSON();

        if( attributes ) return voter as Pick<VoteProfileModelInterface, T>

        return voter;

    }

    async create_vote_profile( payload: VoteProfileModelInterface ){

        const new_voter = await this.VoteProfileModel.create( payload );

        return new_voter?.toJSON();

    }

    async get_vote_by_filter( filter: Partial<VoteModelInterface> ): Promise<VoteModelInterface>
    async get_vote_by_filter<T extends keyof VoteModelInterface>( filter: Partial<VoteModelInterface>, attributes?: T[] ): Promise<Pick<VoteModelInterface, T>>
    async get_vote_by_filter<T extends keyof VoteModelInterface>( filter: Partial<VoteModelInterface>, attributes?: T[] ){

        const voter = (await this.VoteModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        }))?.toJSON();

        if( attributes ) return voter as Pick<VoteModelInterface, T>

        return voter;

    }

    async get_vote_count( filter: Partial<VoteModelInterface> ){

        const count = await this.VoteModel.count({ where: filter });

        return count;
        
    }

    async get_distict_voter_data_values(key: string, filter: Partial<VoterModelInterface>){

        const values = await this.VoterModel.findAll({
            attributes: [[Sequelize.literal(`"data"->>'${key}'`), 'value']],
            group: ['value'],
            where: filter
        })

        return values;

    }

    async create_vote( payload: VoteModelInterface, transaction: Transaction ){

        const new_vote = await this.VoteModel.create( payload, { transaction} );

        return new_vote.toJSON();

    }

    async get_votes( ElectionPostId: number, ElectionId: number, UserId: number ){

        const votes = await this.VoteModel.findAll({
          attributes:[
              [Sequelize.fn('COUNT', Sequelize.col('VoterId')), 'votes'],
              'CandidateId',
              'candidate_name',
              'ElectionPostId',
              'election_post_title',
              'candidate_photo'
          ],
          group: [
            'CandidateId',
            'candidate_name',
            'ElectionPostId',
            'election_post_title',
            'candidate_photo'
          ],
          where: {
            UserId,
            ElectionId,
            ElectionPostId
          },
          order: [[Sequelize.literal(`votes`), "DESC"]]
        });

        return votes;

    }

    async get_aggregated_votes_for_candidate( filter: Pick<VoteModelInterface, 'CandidateId' | 'UserId' | 'ElectionId' | 'ElectionPostId'>, aggregation_key: string ){


        const votes = await this.VoteModel.findAll({
            attributes: [
                [Sequelize.fn('COUNT', Sequelize.literal(`"voter_data"->>'${aggregation_key}'`)), 'vote'],
                [Sequelize.literal(`"voter_data"->>'${aggregation_key}'`), 'aggregation_key']
            ],
            group: [Sequelize.literal(`"voter_data"->>'${aggregation_key}'`) as any],
            where: filter,
            order: [["vote", "DESC"]]
        })

        return votes;
        
    }

    async create_contest_vote_audit_log( payload: ProcessContestVote ){

        return await VoteContestAuditLog.create( payload );

    }

    async create_vote_audit_log( payload: VoteAuditLogModelInterface ){

        const audit_log = await VoteAuditLog.create( payload );

        return audit_log;

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

    async get_stale_vote_logs(){

        const logs = await VoteAuditLog.find({
            createdAt: {
                $lte: moment().subtract(10, 'minutes').toDate()
            }
        })
        .limit(20)
        .exec()

        return logs;

    }

    async delete_audit_log( id: string ){

        await VoteAuditLog.findByIdAndDelete(id);

    }

    async get_vote_log_count( election_id: number ){

        const count = await VoteAuditLog.countDocuments({
            ElectionId: election_id
        })

        return count;
        
    }

    async delete_all_vote_profiles( filter: Pick<VoteProfileModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.VoteProfileModel.destroy({
            where: filter,
            transaction
        })

    }

    async delete_votes( filter: Pick<VoteModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.VoteModel.destroy({
            where: filter,
            transaction
        })

    }

    async delete_voters( filter: Pick<VoterModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.VoterModel.destroy({
            where: filter,
            transaction
        })
        
    }

    async get_voters_turnout( filter: Partial<VoterModelInterface> ){

        const voters_turnout = await this.VoterModel.count({
            where: {
                ...filter,
                has_voted: true
            }
        })

        return voters_turnout;
        
    }

    async create_voters_auth_email_job( job_id: string, election_id: number, payload: VoterAuthpayload, voter_id: number ){

        const job = await VotersAuthEmailJob.create({
            _id: job_id,
            election_id,
            payload,
            voter_id
        })

        return job;

    }

    async get_voters_auth_email_jobs(){

        const jobs = await VotersAuthEmailJob.find().limit(20).exec();

        return jobs;

    }

    async delete_voters_auth_email_job( id: string ){

        await VotersAuthEmailJob.findByIdAndDelete(id);

    }

    async create_voters_auth_email_batch_job( id: string, election_id: number, batch_no: number ){

        const job = await VoterAuthEmailBatchJob.create({
            _id: id,
            election_id,
            batch_no
        })

        return job;

    }

    async get_voters_auth_email_batch_jobs(){

        const jobs = await VoterAuthEmailBatchJob.find().limit(20).exec();

        return jobs;

    }

    async delete_voters_auth_email_batch_job( id: string ){

        await VoterAuthEmailBatchJob.findByIdAndDelete(id);

    }

    async get_accredited_voters( payload: GetAccreditedVoters ){

        console.log({ payload })

        const and_filter = [];

        const page = payload.page ?? 1;

        const per_page = payload.per_page ?? 50;

        if( payload.search_value ){
            and_filter.push(
                Sequelize.where(Sequelize.literal(`LOWER("data"->>'${payload.search_key}')`), "LIKE", `%${payload.search_value.toLowerCase()}%`)
            )
        }

        if( payload.filter ){
            for(let [key, value] of Object.entries(payload.filter)){
                and_filter.push(
                    Sequelize.where(Sequelize.literal(`"data"->>'${key}'`), "=", value)
                )
            }
        }

        const [
            count,
            voters
        ] = await Promise.all([
            this.VoterModel.count({
                where: {
                    ElectionId: payload.election_id,
                    [Op.and]: and_filter
                }
            }),
            this.VoterModel.findAll({
                where: {
                    ElectionId: payload.election_id,
                    [Op.and]: and_filter
                },
                attributes: ['email', 'data'],
                limit: per_page,
                offset: per_page * ( page - 1 )
            })
        ])

        return {
            count,
            voters
        }

    }

    async get_voters_distinct_attribute( election_id: number, attributes: string[] ){

        const result = [];

        for( let attribute of attributes ){
            const values = await this.VoterModel.findAll({
                where: {
                    ElectionId: election_id
                },
                attributes: [[ Sequelize.fn("DISTINCT", Sequelize.literal(`"data"->>'${attribute}'`)), attribute]],
            })

            result.push({
                attribute,
                values
            })
        }

        return result;

    }

    async check_existing_voters_data_value(filter: Pick<VoterModelInterface, "ElectionId" | "UserId">, key: string, value: string){
        const query = `SELECT EXISTS(
            SELECT true FROM "Voters" 
            WHERE "ElectionId" = :election_id
            AND "UserId" = :user_id 
            AND data->>'${key}' = :value
        );`;
        
        const [result] = await db.query(query, {
           replacements: {
                election_id: filter.ElectionId,
                user_id: filter.UserId,
                value
           },
           type: QueryTypes.SELECT
        });
 
        return (result as any).exists;
    }

    async get_voters_data_values(filter: Pick<VoterModelInterface, "ElectionId" | "UserId">, key: string){
        const query = `
            SELECT 
                DISTINCT data->>'${key}' as "value"
            FROM "Voters"  
            WHERE "ElectionId" = :election_id AND "UserId" = :user_id
        `;
        const [result] = await db.query(
            query,
            {
                replacements: {
                    election_id: filter.ElectionId,
                    user_id: filter.UserId
                }
            }
        )
        return result
    }




}