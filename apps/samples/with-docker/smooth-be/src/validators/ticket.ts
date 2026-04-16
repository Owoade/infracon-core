import * as Joi from 'joi';

export const event_validator = Joi.object({
    id: Joi.number().optional(),

    name: Joi.string().required(),

    slug: Joi.string().required(),

    description: Joi.string().required(),

    image: Joi.object({
        link: Joi.string().uri().required(),
        id: Joi.string().required()
    }).optional(),

    start_date: Joi.string().isoDate().required(),

    end_date: Joi.string().isoDate().required(),

    community_link: Joi.string().uri().max(255),

    location: Joi.object({
        venue: Joi.string().required(),
        address: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required()
    }).required()
});

export const ticket_validator = Joi.object({
    id: Joi.number().optional(),

    event_id: Joi.number().optional().allow(null),

    name: Joi.string().required(),

    description: Joi.string().required(),

    price: Joi.number().optional().allow(null),

    max_per_mail: Joi.number().optional().allow(null),

    stock_count: Joi.number().optional().allow(null),

    admits: Joi.number()
});

export const payment_validator = Joi.object({
    slug: Joi.string().required(),

    name: Joi.string().required(),

    email: Joi.string().email().required(),

    phone: Joi.string().required(),

    tickets: Joi.array().items(
        Joi.object({
            ticket_id: Joi.number().required(),
            email: Joi.string().email().required(),
            name: Joi.string().required()
        }).required()
    ).required()
});

export const authenticate_scanner_key_validator = Joi.object({
    scanner_key: Joi.string().required(),
    event_id: Joi.number().required()
}).required()

export const validate_attendee_validator = Joi.object({
    scanner_key: Joi.string().required(),
    event_id: Joi.number().required(),
    access_code: Joi.string().required()
}).required()

export const get_guest_attendees_validator = Joi.object({
    reference: Joi.string().required(),
    payment_id: Joi.number().required()
}).required()

export const add_guest_attendees_validator = Joi.object({
    reference: Joi.string().required(),
    payment_id: Joi.number().required(),
    guests: Joi.array().items(
        Joi.object({
            id: Joi.number().required(),
            email: Joi.string().email().required(),
            name: Joi.string().required()
        }).required()
    ).required()
}).required()