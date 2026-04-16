import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { BillingRepository } from "./billing.repo";
import { Transaction } from "sequelize";
import db from "@db/postgres/index";
import { WalletRepository } from "@modules/wallet/wallet.repo";
import { ElectionRepository } from "@modules/election/election.repo";
import * as moment from "moment";
import { BillingModelInterface, CreateBilling, CreateBillingBySuperAdmin, GetBillingQuote, GetBillings } from "./type";
import { UserRepository } from "@modules/user/user.repo";
import { EmailService } from "@modules/core/email/email.service";
import { Cron } from "@nestjs/schedule";
import { UserModelInterface } from "@modules/user/type";
import { PlatformRepository } from "@modules/platform/repo";
import { InjectQueue } from "@nestjs/bull";
import { LogModelInterface } from "@modules/core/gateway/logging/type";
import { LOG_QUEUE } from "src/queue/config";
import { Queue } from "bull";
import { ElectionService } from "@modules/election/election.service";
import { PlatformService } from "@modules/platform/service";
import { redis_client } from "@cache/index";

@Injectable()
export class BillingService {

    private CHARGE_PER_MONTH = 1500;
    private logger = new Logger(BillingService.name)


    constructor(
        private repo: BillingRepository,
        private wallet_repo: WalletRepository,
        private user_repo: UserRepository,
        private email_service: EmailService,
        private election_repo: ElectionRepository,
        private election_service: ElectionService,
        private platform_repo: PlatformRepository,
        @InjectQueue(LOG_QUEUE)
        private log_queue: Queue<LogModelInterface>,
        private platform_service: PlatformService,
    ){}

    async create( service_payload: CreateBilling ){

        const billing_payload = {...service_payload} as BillingModelInterface;

        const existing_billing  = await this.repo.get_last_billing({ type: "free", UserId: billing_payload.UserId }, ['type', 'id']);

        if( existing_billing && billing_payload.type === "free" )
            throw new ForbiddenException("Only one free plan is allowed per user");

        if( billing_payload.type === "free" ){

            billing_payload.amount = 0;

            billing_payload.expires_at = moment().toISOString();

            return await this.repo.create( billing_payload );

        }

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        try {

            const quote = await this.get_quote( billing_payload );

            const wallet = await this.wallet_repo.get_wallet({UserId: billing_payload.UserId}, ['account_balance', 'id']);

            const wallet_balance = parseFloat(wallet.account_balance as string)/100;

            if( quote.total > wallet_balance )
                throw new ForbiddenException("Insufficient funds");

            billing_payload.expires_at = moment().add(billing_payload.no_of_months || 1, 'months').toISOString();

            billing_payload.amount = quote.total;

            billing_payload.mode = "purchase";

            const amount_to_be_deducted = -(quote.total * 100);

            const [ wallet_transaction, wallet_deduction, billing ] = await Promise.all([

                this.wallet_repo.create_wallet_transaction({
                    amount: quote.total,
                    type: "debit",
                    UserId: billing_payload.UserId,
                    WalletId: wallet.id,
                    description: "Billing for Election"
                }, transaction),

                this.wallet_repo.mutate_account_balance( amount_to_be_deducted, billing_payload.UserId, transaction ),

                this.repo.create( billing_payload, transaction ),

                this.platform_repo.increament_platform_income( Math.abs( amount_to_be_deducted ), transaction ),

                this.log_queue.add({
                    UserId: billing_payload.UserId,
                    description: `User created billing No of voters: ${billing_payload.no_of_voters}, No of months: ${billing_payload.no_of_months}`,
                    type: "billing"
                })

            ])

            await transaction.commit()

            return billing;

        }

        catch(e){

            console.error(e)

            await transaction.rollback();

            throw new BadRequestException(e.message);

        }

        

    }

    async update_billiing( payload: Partial<BillingModelInterface>, user: UserModelInterface ){

        // await this.election_service.validate_election({ id: payload.ElectionId, UserId: user.id })

        const election = await this.election_repo.get_one_election_by_filter({ id: payload.ElectionId }, ['start_time', 'end_time'])

        const ELECTION_HAS_ENDED = moment(election.end_time).diff(moment(), 'seconds') < 0;

        const ELECTION_HAS_STARTED = moment(election.start_time).diff(moment(), 'seconds') < 0;

        if( ELECTION_HAS_ENDED || ELECTION_HAS_STARTED ) throw new ForbiddenException("Modifications are not allowed once the election has started or ended.");

        const last_billing = await this.repo.get_last_billing({
            ElectionId: payload.ElectionId,
            UserId: payload.UserId,
        });

        if( !last_billing ) throw new NotFoundException("Billing not found");

        const billing_payload = {...payload} as BillingModelInterface;

        const quote = await this.get_quote( billing_payload, 'renewal');

        console.log(quote)

        if( quote.total === 0 ) return last_billing;

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        if( billing_payload?.no_of_months ){
            
            const MONTH_DIFFERENCE = moment().diff(moment(last_billing.expires_at), 'months');

            const MINIMUM_RENEWABLE_MONTHS = MONTH_DIFFERENCE + 1;

            if( MONTH_DIFFERENCE > 0 && billing_payload.no_of_months < MINIMUM_RENEWABLE_MONTHS ){

                throw new ForbiddenException(`The minimum subscription duration is ${MINIMUM_RENEWABLE_MONTHS} months`)

            }
        }

        try {

            const wallet = await this.wallet_repo.get_wallet({UserId: billing_payload.UserId}, ['account_balance', 'id']);

            const wallet_balance = parseFloat(wallet.account_balance as string)/100;

            const election = await this.election_repo.get_one_election_by_filter({ id: payload.ElectionId, UserId: payload.UserId }, ['name']);

            if( quote.total > wallet_balance )
                throw new ForbiddenException("Insufficient funds");

            const expires_at =  moment(last_billing.expires_at).add(billing_payload.no_of_months, 'months')

            billing_payload.expires_at = expires_at.toISOString();

            billing_payload.amount = quote.total;

            const amount_to_be_deducted = -(quote.total * 100);

            const [ _, __, billing ] = await Promise.all([

                this.wallet_repo.create_wallet_transaction({
                    amount: quote.total,
                    type: "debit",
                    UserId: billing_payload.UserId,
                    WalletId: wallet.id,
                    description: "Billing for Election"
                }, transaction),

                this.wallet_repo.mutate_account_balance( amount_to_be_deducted, billing_payload.UserId, transaction ),

                this.repo.create({
                        no_of_months: payload.no_of_months + last_billing.no_of_months,
                        no_of_voters: payload.no_of_voters + last_billing.no_of_voters,
                        amount: quote.total,
                        expires_at: moment(last_billing.expires_at).add(payload.no_of_months, 'months').toISOString(),
                        UserId: payload.UserId,
                        mode: "renewal",
                        type: "paid",
                        ElectionId: payload.ElectionId,
                        status: 'active'
                }, transaction),

                this.platform_repo.increament_platform_income( Math.abs( amount_to_be_deducted ), transaction ),

                this.log_queue.add({
                    UserId: billing_payload.UserId,
                    description: `User renewed billing No of voters: ${payload.no_of_voters + last_billing.no_of_voters}, No of months: ${payload.no_of_months + last_billing.no_of_months}`,
                    type: "billing"
                }),

                payload?.no_of_months > 0 ? this.election_repo.update_election({ is_disabled: false }, { id: payload.ElectionId }, transaction ) : Promise.resolve(2),

                payload?.no_of_months > 0 ? this.election_service.remove_cached_election(payload.ElectionId, payload.UserId) : Promise.resolve(2)

            ])

            await this.email_service.send_subscription_renewal_notice({
                first_name: user.name.split(' ')[0],
                election_title: election.name,
                new_expiry_date: expires_at.format("YYYY-MM-DD"),
                email: user.email
            }),


            await transaction.commit()

            return billing;

        }

        catch(e){

            console.error(e)

            await transaction.rollback();

            throw new InternalServerErrorException(e.message);

        }


    }

    async get_quote( payload: GetBillingQuote, mode: BillingModelInterface['mode'] = "purchase"  ){

        const { type, no_of_months, no_of_voters } = payload;

        const platform = await this.platform_service.get_platform();

        console.log( platform )

        if( type === "free" ){
            return {
                total: 0,
                voters_cost: 0,
                monthly_cost: 0
            }
        }

        const monthly_cost = ( mode === "purchase" ? no_of_months - 1 : no_of_months ) * (platform.price_per_month);

        console.log(monthly_cost)

        const voters_cost = no_of_voters * platform.price_per_voter;

        return {
            monthly_cost,
            voters_cost,
            total: monthly_cost + voters_cost
        }
    }

    async get_billing_history( payload: GetBillings ){

        const { filter, date } = payload;
         
        let amount;

        if( payload.date )
            amount = await this.repo.aggregate_billing_amount({ filter, date });

        else amount = (await this.platform_repo.get_platform()).income;

        const billings = await this.repo.get_billings( payload );

        return {
            amount,
            billings
        }
    }

    async create_billing_by_super_admin( payload: CreateBillingBySuperAdmin ){

        const existing_user = await this.user_repo.get_user_by_id( payload.UserId, ['id']);

        if( !existing_user ) throw new NotFoundException('User not found');
        
        const billing_payload = {...payload} as BillingModelInterface;

        billing_payload.type = "paid";

        billing_payload.expires_at = moment().add(payload.no_of_months, 'months').toISOString();

        const [ billing ] = await Promise.all([

            this.repo.create( billing_payload ),

            this.log_queue.add({
                UserId: payload.UserId,
                description: `Super admin created billing No of voters: ${billing_payload.no_of_voters}, No of months: ${billing_payload.no_of_months}`,
                type: "billing"
            })

        ])

        return billing;

    }

    async delete_billing_super_admin( id: number ){

        const existing_billing = await this.repo.get_last_billing({ id }, ['ElectionId']);

        if( !existing_billing ) throw new NotFoundException('Billing not found!');

        if( existing_billing.ElectionId ) throw new ForbiddenException('Billing is already linked to an election');

        await this.repo.delete_billing( id );
        
    }

    @Cron("0 4 * * *", { name: "3-days-warning-email" })
    async send_three_days_warning_alert(){

        this.logger.log("Running cron job: Billing expiry notice (3days)");

        if( process.env?.RUN_CRON !== 'true' ) return console.log('Unable to run cron not a cron server');

        console.log('Cron is running');

        const billings = await this.repo.get_billing_expiring_in_three_days() as any[];

        console.log(billings)

        for( let billing of billings ){

            const user = await this.user_repo.get_user_by_id( billing.UserId, ['email', 'name'] );

            const election = await this.election_repo.get_one_election_by_filter({
                id: billing.ElectionId
            }, ['name'])

            await Promise.all([

                this.email_service.send_billing_reminder_notice({
                    first_name: user.name.split(" ")[0],
                    election_title: election.name,
                    expiry_date: moment().add(2, 'days').format('YYYY-MM-DD'),
                    email: user.email
                }),
    
                this.repo.increament_warning_count({ id: billing.id }),

                this.log_queue.add({
                    UserId: billing.UserId,
                    type: "billing",
                    description: `System sent 3 days reminder about billing for the election: ${election.name} to ${user.email}`
                })

            ])

        }
    }

    @Cron("15 4 * * *", { name: "expiry-email" } )
    async send_expiry_alerts(){

        this.logger.log("Running cron job: Billing expiry notice (1 day)");

        // const REDIS_KEY = 

        if( process.env?.RUN_CRON !== 'true' ) return console.log('Unable to run cron not a cron server');

        console.log('Cron is running');

        this.logger.log(moment().toISOString())

        const billings = await this.repo.get_expired_billings() as any[];

        console.log({ expired_billings: billings });

        for( let billing of billings ){

            const wallet = await this.wallet_repo.get_wallet({ UserId: billing.UserId });

            const user = await this.user_repo.get_user_by_id(billing.UserId, ['email', 'name']);

            const user_assumed_first_name = user.name?.split(" ")[0];

            const election = await this.election_repo.get_one_election_by_filter({id: billing.ElectionId})

            // const USER_HAS_SUFFICIENT_BALANCE = wallet._balance >= this.CHARGE_PER_MONTH;

            // if( USER_HAS_SUFFICIENT_BALANCE ){
                
            //     const transaction = await db.transaction({
            //         isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
            //     })
                
            //     const amount_to_be_deducted = this.CHARGE_PER_MONTH * 100;
                
            //     const expires_at = moment().add(1, 'month');

            //     try {

            //         await Promise.all([

            //             this.wallet_repo.mutate_account_balance(-amount_to_be_deducted, billing.UserId, transaction),
    
            //             this.wallet_repo.create_wallet_transaction({
            //                 amount: this.CHARGE_PER_MONTH,
            //                 description: `One month subscription renewal for ${election.name}`,
            //                 type: "debit",
            //                 UserId: billing.UserId,
            //                 WalletId: wallet.id
            //             }, transaction ),
    
            //             this.repo.update_billing({ expires_at: expires_at.toISOString(), election_has_been_disabled: null, warning_count: 0 }, { id: billing.id }, transaction ),
        
            //             this.email_service.send_subscription_renewal_notice({
            //                 first_name: user_assumed_first_name,
            //                 email: user.email,
            //                 new_expiry_date: expires_at.format('YYYY-MM-DD'),
            //                 election_title: election.name
            //             })
            //         ])

            //         return await transaction.commit();

            //     }
            //     catch(e){

            //         await transaction.rollback();

            //         console.error(e);

            //     }

                
            // }

            await Promise.all([

                this.email_service.send_billing_expiry_notice({
                    first_name: user_assumed_first_name,
                    election_title: election.name,
                    email: user.email
                }),
    
                this.repo.increament_warning_count({id: billing.id}),

                this.log_queue.add({
                    UserId: billing.UserId,
                    type: "billing",
                    description: `System sent 1 day reminder about billing for the election: ${election.name} to ${user.email}`
                })

            ])

            

        }
    }

    @Cron("30 3 * * *", { name: "disable-email" })
    async disable_elections_oevrdue_for_subscription_renewal(){

        console.log("Running cron job: Disable election");

        if( process.env?.RUN_CRON !== 'true' ) return console.log('Unable to run cron not a cron server');

        console.log('Cron is running');

        const billings = await this.repo.get_billings_with_highest_warning_count() as any[];

        for( let billing of billings ){

            const transaction = await db.transaction({
                isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
            })

            const election = await this.election_repo.get_one_election_by_filter({id: billing.ElectionId}, ['name'])

            try {

                await Promise.all([

                    this.repo.update_billing({
                        election_has_been_disabled: true
                    }, {id: billing.id }, transaction ),
        
                    this.election_repo.update_election({ is_disabled: true }, { id: billing.ElectionId }, transaction ),

                    this.log_queue.add({
                        UserId: billing.UserId,
                        type: "billing",
                        description: `System disabled due to billing for election: ${election.name}`
                    })

                ])

                await transaction.commit();

            }

            catch(e){

                await transaction.rollback();

                console.error(e);

            }
            
        }
    }

}