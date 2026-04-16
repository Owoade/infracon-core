import { Inject, Injectable } from "@nestjs/common";
import { ELECTION_MODEL_PROVIDER } from "./models/election.model";
import { InferedSchemaType } from "@utils/schema";
import { AccreditationFormModelInterface, AccreditationFormQuestionModelInterface, CandidateModelInterface, ElectionModelInrterface, ElectionPostModelInterface, GetElectionsWithUserInfo, GetVotersWithFilter, VoteProfileModelInterface, VoterModelInterface } from "./type";
import { ELECTION_POST_MODEL_PROVIDER } from "./models/election-post.model";
import { ACCREDITATION_FORM_MODEL_PROVIDER, ACCREDITATION_FORM_QUESTION_MODEL_PROVIDER } from "./models/accreditation-form";
import { CANDIDATE_MODEL_PROVIDER } from "./models/candidate";
import { Op, Sequelize, Transaction } from "sequelize";
import * as moment from "moment";
import { UserModel } from "@modules/user/user.model";

@Injectable()
export class ElectionRepository {

    constructor(
        
        @Inject(ELECTION_MODEL_PROVIDER)
        private ElectionModel: InferedSchemaType<ElectionModelInrterface>,

        @Inject(ELECTION_POST_MODEL_PROVIDER)
        private ElectionPostModel: InferedSchemaType<ElectionPostModelInterface>,

        @Inject(CANDIDATE_MODEL_PROVIDER)
        private CandidateModel: InferedSchemaType<CandidateModelInterface>,

        @Inject(ACCREDITATION_FORM_MODEL_PROVIDER)
        private AccreditationFormModel: InferedSchemaType<AccreditationFormModelInterface>,

        @Inject(ACCREDITATION_FORM_QUESTION_MODEL_PROVIDER)
        private AccreditationFormQuestionModel: InferedSchemaType<AccreditationFormQuestionModelInterface>,

    ){}

    async create_election( payload:ElectionModelInrterface, transaction: Transaction ){

        const election = await this.ElectionModel.create( payload, { transaction } );

        return election.toJSON();

    }

    async update_election( update: Partial<ElectionModelInrterface>, filter: Partial<ElectionModelInrterface>, transaction?: Transaction ){

        if( update.election_date ) update.election_date.toString()
        if( update.start_time ) update.start_time.toString()
        if( update.end_time ) update.end_time.toString()

        const updated_election = await this.ElectionModel.update(update, {
            where: filter,
            returning: true,
            ...( transaction ? { transaction }: {})
        })

        return updated_election?.[1]?.[0];

    }

    async get_one_election_by_filter( filter: Partial<ElectionModelInrterface>): Promise<ElectionModelInrterface>
    async get_one_election_by_filter<T extends keyof ElectionModelInrterface>( filter: Partial<ElectionModelInrterface>, attributes?: T[] ): Promise<Pick<ElectionModelInrterface, T>>
    async get_one_election_by_filter<T extends keyof ElectionModelInrterface>( filter: Partial<ElectionModelInrterface>, attributes?: T[] ){

        const election = (await this.ElectionModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {} )
        }))?.toJSON()

        if( attributes ) return election as Pick<ElectionModelInrterface, T> ;

        return election;

    }

    async get_elections_by_user_id( user_id: number, page: number, per_page: number, attributes: (keyof ElectionModelInrterface)[] ){

        const [ count, elections ] = await Promise.all([

            this.ElectionModel.count(),

            this.ElectionModel.findAll({
                where: {
                    UserId: user_id
                },
                ...( attributes ? { attributes } : {} ),
                offset: per_page * ( page - 1 ),
                limit: per_page,
                order: [["createdAt", "DESC"]]
            })

        ])


        return { count, elections };

    }

    async get_election_post( filter: Partial<ElectionPostModelInterface>): Promise<ElectionPostModelInterface>
    async get_election_post<T extends keyof ElectionPostModelInterface>( filter: Partial<ElectionPostModelInterface>, attributes?: T[] ): Promise<Pick<ElectionPostModelInterface, T>>
    async get_election_post<T extends keyof ElectionPostModelInterface>( filter: Partial<ElectionPostModelInterface>, attributes?: T[] ){

        const election_post = (await this.ElectionPostModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        }))?.toJSON();

        if( attributes ) return election_post as Pick<ElectionPostModelInterface, T>

        return election_post;

    }

    async create_election_post( payload: ElectionPostModelInterface ){

        const election_post = await this.ElectionPostModel.create( payload );

        return election_post?.toJSON();

    }

    async update_election_post( filter: Partial<ElectionPostModelInterface>, payload: Partial<ElectionPostModelInterface>){

        const updated_election_post = await this.ElectionPostModel.update(payload, { where: filter, returning: true });

        return updated_election_post?.[1]?.[0];

    }

    async get_election_posts_by_election_id_and_user_id( election_id: number, user_id: number, attributes: (keyof ElectionPostModelInterface)[] ){

        const election_posts = await this.ElectionPostModel.findAll({
            where: {
                UserId: user_id,
                ElectionId: election_id
            },
            ...( attributes ? { attributes }: {})
        })

        return election_posts;

    }

    async get_election_post_count( filter: Partial<ElectionPostModelInterface> ){

        return await this.ElectionPostModel.count({
            where: filter
        })

    }
    async delete_election_post( post_id: number, user_id: number ){

        await this.ElectionPostModel.destroy({
            where: {
                UserId: user_id,
                id: post_id
            }
        })

    }

    async get_candidate( filter: Partial<CandidateModelInterface> ): Promise<CandidateModelInterface>
    async get_candidate<T extends keyof CandidateModelInterface>( filter: Partial<CandidateModelInterface>, attributes?: T[] ): Promise<Pick<CandidateModelInterface, T>>
    async get_candidate<T extends keyof CandidateModelInterface>( filter: Partial<CandidateModelInterface>, attributes?: T[] ){

        const candidate = (await this.CandidateModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        })).toJSON();

        if( attributes ) return candidate as Pick<CandidateModelInterface, T>

        return candidate;

    }

    async get_candidates( filter: Partial<CandidateModelInterface>, page: number, per_page: number,  attributes?: (keyof CandidateModelInterface)[] ){

        const [ count, candidates ] = await Promise.all([

            this.CandidateModel.count({ where: filter }),

            this.CandidateModel.findAll({
                where: filter,
                limit: per_page,
                ...( attributes ? { attributes } : {} ),
                offset: per_page * ( page - 1 ),
                include: {
                    model: this.ElectionPostModel,
                    attributes: ["title"]
                },
                order: [["createdAt", "DESC"]]
            })

        ])

        return {count,candidates};

    }

    async get_all_candidates( filter: Partial<CandidateModelInterface> ){

        const candidates = await this.CandidateModel.findAll({
            where: filter,
            include: {
                model: this.ElectionPostModel,
                attributes: ['id', 'title']
            }
        })

        return candidates;

    }

    async get_all_candidates_by_election_post_filter( filter: Partial<CandidateModelInterface>, election_post_filter_value: string ){

        const candidates = await this.CandidateModel.findAll({
            where: filter,
            include: {
                model: this.ElectionPostModel,
                where: {
                    [Op.or]: [
                        { filter_value : { [Op.contains]: [election_post_filter_value]} },
                        { filter_value: null },
                        { filter_value: { [Op.contains]: ['all']} }
                    ]
                }
            }
        })

        return candidates;

    }



    async create_candidate( payload: CandidateModelInterface ){

        const candidate = await this.CandidateModel.create( payload );

        return candidate.toJSON();

    }

    async update_candidate( payload: Partial<CandidateModelInterface>, filter: Partial<CandidateModelInterface> ){

        const updated_candidate = await this.CandidateModel.update( payload, { where: filter, returning: true } );

        return updated_candidate?.[1]?.[0];
        
    }

    async delete_candidate( candidate_id: number, user_id: number ){

        await this.CandidateModel.destroy({
            where: {
                UserId: user_id,
                id: candidate_id
            }
        })

    }

    async get_accreditation_form( filter: Partial<AccreditationFormModelInterface> ): Promise<AccreditationFormModelInterface>
    async get_accreditation_form<T extends keyof AccreditationFormModelInterface>( filter: Partial<AccreditationFormModelInterface>, attributes?: T[] ): Promise<Pick<AccreditationFormModelInterface, T>>
    async get_accreditation_form<T extends keyof AccreditationFormModelInterface>( filter: Partial<AccreditationFormModelInterface>, attributes?: T[] ){

        const accreditation_form = (await this.AccreditationFormModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        }))?.toJSON();

        if( attributes ) return accreditation_form as Pick<AccreditationFormModelInterface, T>

        return accreditation_form;

    }

    async get_accreditation_form_and_questions( filter: Partial<AccreditationFormModelInterface> ){

        let [ accreditation_form, _ ] = await Promise.all([

            this.AccreditationFormModel.findOne({
                where: filter
            }),
            
            this.AccreditationFormQuestionModel.findAll({
                where: filter,
                order: [["id", "ASC"]]
            })

        ])

        if( !accreditation_form ) return null;

        let _accreditation_form = accreditation_form?.toJSON() as any;

        _accreditation_form.AccreditationFormQuestions = _;

        return _accreditation_form as AccreditationFormModelInterface & { AccreditationFormQuestions: { toJSON(): AccreditationFormQuestionModelInterface }[] };

    }


    async create_accreditation_form( payload: AccreditationFormModelInterface ){

        console.log( payload )

        const accreditation_form = await this.AccreditationFormModel.create( payload );

        return accreditation_form?.toJSON();

    }
    async create_accreditation_form_question( payload: AccreditationFormQuestionModelInterface, transaction?: Transaction ){

        const accreditation_form_question = await this.AccreditationFormQuestionModel.create( payload, { ...( transaction ? { transaction }: {})} );

        return accreditation_form_question?.toJSON();

    }

    async get_accreditation_form_questions( filter: Partial<AccreditationFormQuestionModelInterface>, attributes?: (keyof AccreditationFormQuestionModelInterface)[] ){

        const accreditation_form_question = await this.AccreditationFormQuestionModel.findAll({
            where: filter,
            attributes
        })

        return accreditation_form_question;

    }

    async update_accrediation_form( payload: Partial<AccreditationFormModelInterface>, filter: Partial<AccreditationFormModelInterface> ){

        const updated_accreditation_form = await this.AccreditationFormModel.update( payload, { where: filter, returning: true });

        return updated_accreditation_form?.[1]?.[0];

    }

    async update_accrediation_form_question( payload: Partial<AccreditationFormQuestionModelInterface>, filter: Partial<AccreditationFormQuestionModelInterface> ){

        const updated_accreditation_form_question = await this.AccreditationFormQuestionModel.update( payload, { where: filter, returning: true });

        return updated_accreditation_form_question?.[1]?.[0];

    }

    async update_accreditation_form_labels( label: string, form_id: number, transaction?: Transaction ){

        await this.AccreditationFormModel.update({
            labels: Sequelize.literal(
                `
                    CASE 
                        WHEN NOT EXISTS (
                            SELECT 1 FROM unnest(labels) as element
                                WHERE element = '${label}'
                        )
                        THEN array_append(labels, '${label}')
                        ELSE labels
                    END
                `
            )
        }, {
            where: { id: form_id },
            ...( transaction ? { transaction }: {})
        })

    }

    async delete_accreditation_question( question_id: number, user_id: number, transaction?: Transaction ){

        await this.AccreditationFormQuestionModel.destroy({
            where: {
                UserId: user_id,
                id: question_id
            },
            ...( transaction ? { transaction } : {})
        })

    }

    async get_election_post_with_candidate_count( filter: Partial<ElectionPostModelInterface>, page: number, per_page: number ){

        const [ count, election_posts ] = await Promise.all([

            this.ElectionPostModel.count({ where: filter }),

            this.ElectionPostModel.findAll({
                where: filter,
                offset: per_page * ( page - 1 ),
                order: [["createdAt", "DESC"]],
                limit: per_page,
                include: {
                    model: this.CandidateModel,
                    attributes: ["id"]
                }
            })
        ])

        return {count,election_posts};

    }

    async get_candidate_count( filter: Partial<CandidateModelInterface> ){

        const count = await this.CandidateModel.count({
            where: filter
        })

        return count;

    }

    
    async get_elections_due_for_voters_broadcast(){

        return await this.ElectionModel.findAll({
            where: {
                broadcast_date: {
                    [Op.lte]: moment().toISOString()
                },
                has_sent_broadcast: null as any
            },
            include: {
                model: UserModel,
                attributes: ['email', 'name']
            }
        })
        
    }

    async get_election_posts_by_filter( filter: Partial<ElectionPostModelInterface> ): Promise<ElectionPostModelInterface[]>
    async get_election_posts_by_filter<T extends (keyof ElectionPostModelInterface)>( filter: Partial<ElectionPostModelInterface>, attributes?: T[] ): Promise<Pick<ElectionPostModelInterface, T>[]>
    async get_election_posts_by_filter<T extends (keyof ElectionPostModelInterface)>( filter: Partial<ElectionPostModelInterface>, attributes?: T[] ){

        const election_posts = await this.ElectionPostModel.findAll({
            where: filter,
            ...( attributes ? { attributes }: {}),
            order: [["createdAt", "ASC"]]
        });

        const election_posts_to_json = election_posts.map( _ => _.toJSON() );

        if( attributes ) return election_posts_to_json as Pick<ElectionPostModelInterface, T>[]

        else return election_posts_to_json as ElectionPostModelInterface[]

    }

    async get_elections_with_user_info( payload: GetElectionsWithUserInfo ){

        const filter = this.get_elections_with_user_info_filter( payload.filter )

        const [ count, elections ] = await Promise.all([

            this.ElectionModel.count({
                where: filter
            }),

            this.ElectionModel.findAll({
                where: filter,
                ...( payload.attributes ? { attributes: payload.attributes }: {}),
                include: {
                    model: UserModel,
                    ...( payload.user_attributes ? { attributes: payload.user_attributes }: {})
                }
            })
            
        ])

        return { count, elections }

    }

    async delete_all_candidates( filter: Pick<CandidateModelInterface, "UserId" | "ElectionId">, transaction: Transaction ){

        await this.CandidateModel.destroy({
            where: filter,
            transaction 
        })

    }

    async delete_all_election_posts( filter: Pick<ElectionPostModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.ElectionPostModel.destroy({
            where: filter,
            transaction
        })

    }

    async delete_accreditation_form( filter: Pick<AccreditationFormModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.AccreditationFormModel.destroy({
            where: filter,
            transaction
        })

    }

    async delete_all_accreditation_form_questions( filter: Pick<AccreditationFormQuestionModelInterface, "ElectionId" | "UserId">, transaction: Transaction ){

        await this.AccreditationFormQuestionModel.destroy({
            where: filter,
            transaction
        })
        
    }

    private get_elections_with_user_info_filter( payload: GetElectionsWithUserInfo['filter'] ){

        if( !payload ) return {};

        let filter = {} as any;

        if( payload.status ){

            if( payload.status === "past" ){

                filter.election_date = {
                    [Op.lte]: moment().add(1, 'day').toISOString()
                }
                
            }

            if( payload.status === "upcoming" ){

                filter.election_date = {
                    [Op.gte]: moment().add(1, 'day').toISOString()
                }

            }

            delete payload.status;

        }

        return {
            ...filter,
            ...payload
        }
    }

}