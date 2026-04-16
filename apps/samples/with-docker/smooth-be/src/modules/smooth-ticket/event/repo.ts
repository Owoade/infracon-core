import { Inject, Injectable } from "@nestjs/common";
import { InferedSchemaType } from "@utils/schema";
import { 
    SMOOTH_TICKET_EVENT_MODEL_PROVIDER,
    SMOOTH_TICKET_TICKET_MODEL_PROVIDER,
    SMOOTH_TICKET_ATTENDEE_MODEL_PROVIDER,
    SMOOTH_TICKET_PAYMENT_MODEL_PROVIDER
} from "./model";
import { SmoothTicketAttendeeInterface, SmoothTicketEventInterface, SmoothTicketInterface, SmoothTicketPaymentInterface, TicketPurchaseLogModelInterface } from "./type";
import * as moment from "moment";
import TicketPurchaseLog from "@db/mongo/models/ticket-audit-log";
import { extend } from "joi";
import { Op, Transaction } from "sequelize";

@Injectable()
export class SmoothTicketRepository {
    constructor(
       
        @Inject(SMOOTH_TICKET_EVENT_MODEL_PROVIDER)
        private EventModel: InferedSchemaType<SmoothTicketEventInterface>,

        @Inject(SMOOTH_TICKET_TICKET_MODEL_PROVIDER)
        private TicketModel: InferedSchemaType<SmoothTicketInterface>,

        @Inject(SMOOTH_TICKET_ATTENDEE_MODEL_PROVIDER)
        private AttendeeModel: InferedSchemaType<SmoothTicketAttendeeInterface>,

        @Inject(SMOOTH_TICKET_PAYMENT_MODEL_PROVIDER)
        private PaymentModel: InferedSchemaType<SmoothTicketPaymentInterface>,
    ){}

 
    // --------------------
    // Event methods
    // --------------------
    async get_events(filter: Partial<SmoothTicketEventInterface>, page: number, per_page: number, attributes?: (keyof SmoothTicketEventInterface)[]) {
        const [count, events] = await Promise.all([
            this.EventModel.count({ where: filter }),
            this.EventModel.findAll({
                ...(attributes ? { attributes } : {}),
                offset: per_page * (page - 1),
                limit: per_page,
                where: filter,
                order: [["created_at", "DESC"]],
            }),
        ]);

        return { count, events };
    }

    async get_events_with_tickets(filter: Partial<SmoothTicketEventInterface>, page: number, per_page: number, attributes?: (keyof SmoothTicketEventInterface)[]) {
        const [count, events] = await Promise.all([
            this.EventModel.count({ where: filter }),
            this.EventModel.findAll({
                ...(attributes ? { attributes } : {}),
                offset: per_page * (page - 1),
                limit: per_page,
                where: filter,
                order: [["created_at", "DESC"]],
                include: {
                    model: this.TicketModel,
                    as: "tickets"
                }
            }),
        ]);

        return { count, events };
    }

    async get_single_event<T extends keyof SmoothTicketEventInterface>(filter: Partial<SmoothTicketEventInterface>, attributes?: T[]) {
        const event = await this.EventModel.findOne({
            where: filter,
            ...(attributes ? { attributes } : {}),
        });

        if(attributes)
            return event?.toJSON() as Pick<SmoothTicketEventInterface, T>

        return event?.toJSON();
    }

    async create_event(payload: SmoothTicketEventInterface){
        const new_event = await this.EventModel.create(payload)
        return new_event.toJSON()
    }

    async update_event(
        update: Partial<SmoothTicketEventInterface>,
        filter: Partial<SmoothTicketEventInterface>
    ){
        delete update.id;
        const updated_event = await this.EventModel.update(update, {
            where: filter,
            returning: true,
        });

        return updated_event?.[1]?.[0]?.toJSON();
    }

    // --------------------
    // Ticket methods
    // --------------------

    async create_ticket(payload: SmoothTicketInterface){
        console.log({payload})
        const new_ticket = await this.TicketModel.create(payload);
        return new_ticket.toJSON()
    }

    async get_tickets(filter?: Partial<SmoothTicketInterface>, attributes?: (keyof SmoothTicketInterface)[]) {
        const tickets = await this.TicketModel.findAll({
            where: filter || {},
            ...(attributes ? { attributes } : {}),
            order: [["price", "ASC"]],
        });

        return tickets.map(t => t.toJSON());
    }

    async get_single_ticket<T extends keyof SmoothTicketInterface>(
        filter: Partial<SmoothTicketInterface>, 
        attributes?: T[]
    ) {
        const ticket = await this.TicketModel.findOne({
            where: filter,
            ...(attributes ? { attributes } : {}),
        });

        if(attributes)
            return ticket?.toJSON() as Pick<SmoothTicketInterface, T>
    
        return ticket?.toJSON();
    }

    async update_ticket(
        update: Partial<SmoothTicketInterface>,
        filter: Partial<SmoothTicketInterface>
    ){
        const updated_ticket = await this.TicketModel.update(update, {
            where: filter,
            returning: true,
        });

        return updated_ticket?.[1]?.[0];
    }

    async delete_ticket(filter: Partial<SmoothTicketInterface>) {
        return this.TicketModel.destroy({ where: filter });
    }

    // --------------------
    // Attendee methods (paginated)
    // --------------------

    async create_attendee(payload: SmoothTicketAttendeeInterface, transaction: Transaction){
        return await this.AttendeeModel.create(payload, { transaction })
    }

    async get_attendees(filter: Partial<SmoothTicketAttendeeInterface>, page: number, per_page: number, attributes?: (keyof SmoothTicketAttendeeInterface)[]) {
        const [count, attendees] = await Promise.all([
            this.AttendeeModel.count(
                {
                    where: filter
                }
            ),
            this.AttendeeModel.findAll({
                ...(attributes ? { attributes } : {}),
                offset: per_page * (page - 1),
                where: filter,
                limit: per_page,
                order: [["created_at", "DESC"]],
            }),
        ]);

        return { count, attendees };
    }

    async get_ticket_sales_count(ticket_id: number){
        return await this.AttendeeModel.count({
            where: {
                ticket_id
            }
        })
    }

    async get_attendees_count(filter: Partial<SmoothTicketAttendeeInterface>){
        return await this.AttendeeModel.count({
            where: filter
        })
    }

    async get_single_attendee<T extends keyof SmoothTicketAttendeeInterface>(
        filter: Partial<SmoothTicketAttendeeInterface>, 
        attributes?: T[]
    ) {
        const attendee = await this.AttendeeModel.findOne({
            where: filter,
            ...(attributes ? { attributes } : {}),
        });

        if(attributes)
            return attendee?.toJSON() as Pick<SmoothTicketAttendeeInterface, T>
    
        return attendee?.toJSON();
    }

    async update_guest_attendee(update: Partial<SmoothTicketAttendeeInterface>, id: number){
        const result = await this.AttendeeModel.update(
            update, 
            {
                where: {
                    id,
                    email: ""
                },
                returning:true
            }
        )
        return result?.[1]?.[0]?.toJSON();
    }

    // --------------------
    // Payment methods (paginated)
    // --------------------

    async create_payment(payload: SmoothTicketPaymentInterface){
        return await this.PaymentModel.create(payload)
    }

    async get_payments(filter: Partial<SmoothTicketPaymentInterface>, page: number, per_page: number, attributes?: (keyof SmoothTicketPaymentInterface)[]) {
        const [count, payments] = await Promise.all([
            this.PaymentModel.count({
                where: filter
            }),
            this.PaymentModel.findAll({
                ...(attributes ? { attributes } : {}),
                offset: per_page * (page - 1),
                where: filter,
                limit: per_page,
                order: [["created_at", "DESC"]],
            }),
        ]);

        return { count, payments };
    }

    async get_single_payment<T extends keyof SmoothTicketPaymentInterface>(filter: Partial<SmoothTicketPaymentInterface>, attributes?: T[]){
        const payment = await this.PaymentModel.findOne({
            where: filter,
            ...( attributes ? { attributes } : {})
        })

        if( attributes )
            return payment?.toJSON() as Pick<SmoothTicketPaymentInterface, T>

        return payment?.toJSON();
    }

    async create_ticket_purchase_log(payload: TicketPurchaseLogModelInterface){
        return await TicketPurchaseLog.create(payload)
    }

    async get_stale_ticket_purchase_logs(){

        const logs = await TicketPurchaseLog.find({
            createdAt: {
                $lte: moment().subtract(10, 'minutes').toDate()
            }
        })
        .limit(20)
        .exec()

        return logs;

    }

    async delete_ticket_purchase_log( id: string ){

        await TicketPurchaseLog.findByIdAndDelete(id);

    }

    async get_guest_tickets(payment_id: number, email: string){
        return await this.AttendeeModel.findAll({
            where: {
                email: {
                    [Op.ne]: email
                },
                payment_id
            }
        })
    }


}
