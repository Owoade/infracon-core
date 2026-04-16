import { Inject, Injectable } from "@nestjs/common";
import { InferedSchemaType } from "@utils/schema";
import * as moment from "moment";
import { Op, QueryTypes, Transaction } from "sequelize";
import { BillingModelInterface, GetBillings } from "./type";
import { BILLING_MODEL_PROVIDER } from "./billing.model";
import db from "@db/postgres/index";

@Injectable()
export class BillingRepository {
    
    constructor(
        @Inject(BILLING_MODEL_PROVIDER)
        private BillingModel: InferedSchemaType<BillingModelInterface>
    ){}

    async create( payload: BillingModelInterface, transaction?: Transaction ){

        payload.warning_count = 0;

        payload.status = "active";

        const billing = await this.BillingModel.create( payload, { transaction } );

        return billing;

    }

    async get_last_billing( filter: Partial<BillingModelInterface> ): Promise<BillingModelInterface>
    async get_last_billing<T extends keyof BillingModelInterface >( filter: Partial<BillingModelInterface>,  attributes?: T[]): Promise<Pick<BillingModelInterface, T>>
    async get_last_billing<T extends keyof BillingModelInterface >( filter: Partial<BillingModelInterface>,  attributes?: T[]){

        const billing = (await this.BillingModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {} ),
            order: [["createdAt", "DESC"]]
        }))?.toJSON()

        if( attributes ) return billing as Pick<BillingModelInterface, T>;

        return billing;
        
    }

    async update_billing( payload: Partial<BillingModelInterface>, filter: Partial<BillingModelInterface>, transaction?: Transaction ){

        const updated_billing = await this.BillingModel.update(payload, { where: filter, returning: true, ...( transaction ? { transaction }: {})  });

        return updated_billing?.[1]?.[0];

    }

    async get_billing_expiring_in_three_days(){

        const three_days_from_now = moment().add(2, 'days').toISOString();

        const billings = await this.BillingModel.findAll({
            where: {
                warning_count: 0,
                type: 'paid',
                ElectionId: {
                    [Op.not]: null
                },
                election_has_been_disabled: null,
                expires_at: {
                    [Op.lte]: three_days_from_now
                }
            }
        })

        return billings;

    }

    async get_expired_billings(){

        const billings = await this.BillingModel.findAll({
            where: {
                type: 'paid',
                ElectionId: {
                    [Op.not]: null
                },
                election_has_been_disabled: null,
                expires_at: {
                    [Op.lte]: moment().toISOString()
                }
            }
        })

        return billings;

    }

    async get_billings( payload: GetBillings ){

        const { filter, page, per_page, attributes } = payload;

        const [ count, billings ] = await Promise.all([

            this.BillingModel.count({
                where: {
                    ...filter,
                    ...( payload.date ? { createdAt: { [Op.between]: [payload.date.from, payload.date.to] }}: {})
                } 
            }),

            this.BillingModel.findAll({
                where: {
                    ...filter,
                    ...( payload.date ? { createdAt: { [Op.between]: [payload.date.from, payload.date.to] }}: {})
                },
                limit: per_page,
                offset: per_page * ( page - 1 ),
                ...( attributes ? { attributes }: {})
            })

        ])

        return { count, billings };

    }

    async get_billings_with_highest_warning_count(){

        const billings = await this.BillingModel.findAll({
            where: {
                type: 'paid',
                ElectionId: {
                    [Op.not]: null
                },
                warning_count: {
                    [Op.gte]: 2
                },
                election_has_been_disabled: null,
                expires_at: {
                    [Op.lte]: moment().toISOString()
                }
            }
        })

        return billings;

    }

    async delete_billing( id: number ){
        await this.BillingModel.destroy({
            where: {
                id
            }
        })
    }

    async update_billing_for_subscrption_renewal(payload:Partial<BillingModelInterface>, transaction: Transaction ){

        console.log(payload)

        const billing = await db.query(`UPDATE "Billings" SET "no_of_voters"="no_of_voters"+ :voters, "no_of_months"="no_of_months"+ :months, "amount"="amount" + :amount, "expires_at"=:expires_at, "election_has_been_disabled"=NULL WHERE "UserId" = :user_id AND "id" = :id RETURNING *`, {
            replacements: {
                voters: payload.no_of_voters,
                months: payload.no_of_months,
                amount: payload.amount,
                expires_at: payload.expires_at,
                user_id: payload.UserId,
                id: payload.id
            },
            transaction,
            mapToModel: true,
            type: QueryTypes.UPDATE
        })

        return billing?.[1]?.[0];

    }

    async increament_warning_count( filter: Partial<BillingModelInterface> ){

        await this.BillingModel.increment('warning_count', { by: 1, where: filter });
        
    }

    async increament_voters_count( update: Partial<BillingModelInterface> ,filter: Partial<BillingModelInterface>,  transaction: Transaction ){

        await this.BillingModel.increment('no_of_voters', { by: update.no_of_voters, where: filter, transaction });

    }

    async increament_months_count( update: Partial<BillingModelInterface> ,filter: Partial<BillingModelInterface>, transaction: Transaction ){

        await this.BillingModel.increment('no_of_months', { by: update.no_of_months, where: filter, transaction });

    }

    async increament_amount( update: Partial<BillingModelInterface> ,filter: Partial<BillingModelInterface>, transaction: Transaction ){

        await this.BillingModel.increment('amount', { by: update.amount, where: filter, transaction });

    }

    async aggregate_billing_amount( payload: Pick<GetBillings, 'date' | 'filter'> ){

        const billing_amount = await this.BillingModel.aggregate('amount', 'SUM', {
            where: {
                ...payload.filter,
                ...( payload.date ? { createdAt: { [Op.between]: [payload.date.from, payload.date.to] }}: {})
            },
        })

        return billing_amount;
        
    }

}