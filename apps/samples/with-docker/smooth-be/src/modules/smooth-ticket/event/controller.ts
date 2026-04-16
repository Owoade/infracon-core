import { BadRequestException, Controller, Get, NotFoundException, Post, Res, UseInterceptors } from "@nestjs/common";
import { SmoothTicketRepository } from "./repo";
import { StorageService } from "@modules/core/storage/storage.service";
import { SmoothTicketUserAuthInterceptor } from "src/interceptors/ticket";
import { RequestPayload, User } from "@decorators/index";
import { SmoothTicketUserInterface } from "../user/type";
import { add_guest_attendees_validator, authenticate_scanner_key_validator, event_validator, get_guest_attendees_validator, payment_validator, ticket_validator, validate_attendee_validator } from "@validators/ticket";
import { InitiatePayment, SmoothTicketEventInterface, SmoothTicketInterface, ValidateAttendee } from "./type";
import { response } from "@utils/response";
import { SmoothTicketService } from "./service";
import { id_validator, id_validator_string, pagination_validator } from "@validators/utils";
import { SmoothTicketUserRepository } from "../user/repo";
import { redis_client } from "@cache/index";
import { Response } from "express";
import * as EventEmitter from "events";



@Controller('ticket')
@UseInterceptors(SmoothTicketUserAuthInterceptor)
export class SmoothTicketController {
    constructor(
        private repo: SmoothTicketRepository,
        private service: SmoothTicketService,
        private storage_service: StorageService,
        private user_repo: SmoothTicketUserRepository
    ){}

    @Post('/event')
    async upsert_event(
        @User()
        user: SmoothTicketUserInterface,

        @RequestPayload({
            validator: event_validator
        })
        payload: SmoothTicketEventInterface
    ){

        payload.user_id = user.id

        let event: SmoothTicketEventInterface;

        if(payload.id){
            event = await this.service.update_event(payload, {
                id: payload.id,
                user_id: user.id
            })
        }

        else {
            event = await this.service.create_event(payload)
        }

        return response({
            data: {
                event
            },
            status: true,
            statusCode: 200
        })
           
    }

    @Post('/')
    async upsert_ticket(
        @User()
        user: SmoothTicketUserInterface,

        @RequestPayload({
            validator: ticket_validator
        })
        payload: SmoothTicketInterface
    ){

        payload.user_id = user.id

        let ticket: SmoothTicketInterface

        if(payload.id){
            ticket = await this.service.update_ticket(payload, {
                id: payload.id,
                user_id: user.id
            })
        }

        else {
            ticket = await this.service.create_ticket(payload)
        }

        return response({
            data: {
               ticket
            },
            status: true,
            statusCode: 200
        })

    }

    @Post('/list')
    async get_list_of_events(
        @User()
        user: SmoothTicketUserInterface,
        @RequestPayload({
            validator: pagination_validator
        })
        payload: { page: number, per_page: number }
    ){
        const events = await this.repo.get_events({
            user_id: user.id
        }, payload.page, payload.per_page )

        return response({
            data: {
               ...events
            },
            status: true,
            statusCode: 200
        })
    }

    @Get('/event')
    async get_event(
        @User()
        user: SmoothTicketUserInterface,

        @RequestPayload({
            validator: id_validator('event_id'),
            type: 'query'
        })
        payload: { event_id: number }
    ){

        const event = await this.repo.get_single_event({
            id: payload.event_id,
            user_id: user.id
        })

        if(!event)
            throw new NotFoundException('Event not found')

        const tickets = await this.repo.get_tickets({
            event_id: event.id
        })

        for( let ticket of tickets ){
            const tickets_sold = await this.repo.get_ticket_sales_count(ticket.id);
            (ticket as any).tickets_sold = tickets_sold
        }

        return response({
            data: {
               event,
               tickets
            },
            status: true,
            statusCode: 200
        })

    }

    @Get('/media')
    async get_presigned_url(
        @RequestPayload({
            validator: id_validator_string('key'),
            type: 'query'
        })
        payload: { key: string }
    ){
        payload.key = "smooth-events/events/" + payload.key
        const url = await this.storage_service.get_presigned_url(payload.key);

        return response({
            data: {
               upload_url: url,
               file_url: "https://storage.smoothballot.com/" + payload.key,
               id: payload.key
            },
            status: true,
            statusCode: 200
        })
    }

    @Get('/payments')
    async get_payments(
        @User()
        user: SmoothTicketUserInterface,

        @RequestPayload({
            validator: id_validator('event_id'),
            type: 'query'
        })
        q: { event_id: number },

        @RequestPayload({
            validator: pagination_validator
        })
        payload: { page: number, per_page: number }
    ){
        const payments = await this.repo.get_payments(
            {
                event_id: q.event_id,
                user_id: user.id
            },
            payload.page,
            payload.per_page
        )

        return response({
            data: {
               ...payments
            },
            status: true,
            statusCode: 200
        })
    }

    @Get('/attendee')
    async get_attendee(
        @User()
        user: SmoothTicketUserInterface,

        @RequestPayload({
            validator: id_validator('event_id'),
            type: 'query'
        })
        q: { event_id: number },

        @RequestPayload({
            validator: pagination_validator
        })
        payload: { page: number, per_page: number }
    ){
        const attendees = await this.repo.get_attendees(
            {
                event_id: q.event_id,
                user_id: user.id
            },
            payload.page,
            payload.per_page
        )

        return response({
            data: {
               ...attendees
            },
            status: true,
            statusCode: 200
        })
    }

    @Get('/scanner')
    async generate_scanner_key(
        @RequestPayload({
            validator: id_validator('event_id'),
            type: "query"
        })
        payload: { event_id: number },
        @User()
        user: SmoothTicketUserInterface,
    ){

        const scanner_key = await this.service.generate_scanner_key({
            user_id: user.id,
            id: payload.event_id
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                scanner_key
            }
        })

    }

    @Post('/whitelist/scanner/auth')
    async authenticate_scanner_key(
        @RequestPayload({
            validator: authenticate_scanner_key_validator
        })
        payload: { event_id: number, scanner_key: string },
    ){

        const event = await this.service.authenticate_scanner_key({
            scanner_key: payload.scanner_key,
            id: payload.event_id
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                event
            }
        })

    }

    @Post("/whitelist/scanner/validate")
    async validate_attendee(
        @RequestPayload({
            validator: validate_attendee_validator
        })
        payload: ValidateAttendee
    ){
        const info = await this.service.validate_attendee(payload)

        return response({
            status: true,
            statusCode: 200,
            data: {
                info
            }
        })
    }

    @Post("/whitelist/guests")
    async get_guest_attendees(
        @RequestPayload({
            validator: get_guest_attendees_validator
        })
        payload: { reference: string, payment_id: number }
    ){
        const result = await this.service.get_guest_attendees({
            id: payload.payment_id,
            reference: payload.reference
        })

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })
    }

    @Get("/whitelist/guests/tickets")
    async get_group_tickets(
        @RequestPayload({
            validator: get_guest_attendees_validator,
            type: "query"
        })
        payload: { reference: string, payment_id: number },

        @Res()
        res: Response
    ){
        this.service.generate_ticket_pdf(
            { reference: payload.reference, id: payload.payment_id },
            res,
            new EventEmitter()
        )
    }

    @Post("/whitelist/add/guests")
    async add_guest_attendees(
        @RequestPayload({
            validator: add_guest_attendees_validator
        })
        payload: { reference: string, payment_id: number, guests: any[] }
    ){
        const result = await this.service.add_guest_attendee({
            id: payload.payment_id,
            reference: payload.reference
        }, payload.guests)

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })
    }

    @Get('/whitelist')
    async get_event_by_slug(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: 'query'
        })
        q: { slug: string },
    ){

        const event = await this.repo.get_single_event({
            slug: q.slug
        })

        if(!event)
            throw new NotFoundException('Event not found')

        let tickets = await this.repo.get_tickets({
            event_id: event.id
        })

        const organizer = await this.user_repo.get_user({
            id: event.user_id
        }, ['name', 'email'])

        const total_attendees = await this.repo.get_attendees_count({
            event_id: event.id
        })

        return response({
            data: {
               organizer,
               event,
               tickets,
               total_attendees
            },
            status: true,
            statusCode: 200
        })

    }

    @Get("/whitelist/discovery")
    async discover_events(
        @RequestPayload({
            validator: pagination_validator
        })
        paylaod: {page: string, per_page: string}
    ){
        const { count, events } = await this.repo.get_events_with_tickets(
            {},
            parseInt(paylaod.page),
            parseInt(paylaod.per_page),
            ['name', 'slug', 'description', 'start_date', 'end_date', 'image', 'created_at']
        )

        return response({
            data: {
                count,
                events
            },
            status: true,
            statusCode: 200
        })
    }

    @Post('/whitelist/pay')
    async initiate_payment(
        @RequestPayload({
            validator: payment_validator
        })
        paylod: InitiatePayment
    ){

        const payment = await this.service.initiate_payment(paylod)

        return response({
            data: {
                ...payment
            },
            status: true,
            statusCode: 200
        })

    }

    @Get('/whitelist/payment-confirmation')
    async confirm_payment(
        @RequestPayload({
            validator: id_validator_string('session_id'),
            type: 'query'
        })
        payload: { session_id: string }
    ){

        const cached_data = await redis_client.get(
            `SMOOTH_TICKET_PURCHASE_${payload.session_id}`
        )

        if(!cached_data)
            throw new NotFoundException("Invalid session")

        try {

            const data = JSON.parse(cached_data)

            return response({
                data: {
                    ...data
                },
                status: true,
                statusCode: 200
            })

        }

        catch(e){
            throw new NotFoundException("Invalid session")
        }

    }

    @Get('/whitelist/metadata')
    async get_event_metadata(
        @RequestPayload({
            validator: id_validator_string('slug'),
            type: 'query'
        })
        payload: { slug: string }
    ){

       const event = await this.repo.get_single_event({
        slug: payload.slug
       }, ["name", "image", "description"])

       return response({
        data: {
            image: event?.image?.link ?? "",
            name: event?.name ?? "",
            description: event?.description ?? ""
        },
        status: true,
        statusCode: 200
    })
    }


}