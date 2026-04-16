import * as Joi from "joi";

export const create_contest_validator = Joi.object({
    name: Joi.string().required(),
    voting_limit: Joi.number().integer().required(),
    voting_fee: Joi.number().required(),
    contest_image: Joi.object({
        id: Joi.string().required(),
        url: Joi.string().uri().required(),
        file_name: Joi.string(),
        extension: Joi.string()
    }).required(),
}).required()

export const update_contest_validator = Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    voting_limit: Joi.number().integer().required(),
    voting_fee: Joi.number().required(),
    contest_image: Joi.object({
        id: Joi.string().required(),
        url: Joi.string().uri().required(),
        file_name: Joi.string(),
        extension: Joi.string()
    }).required(),
    description: Joi.string().allow(''),
    start_time: Joi.string().isoDate(),
    end_time: Joi.string().isoDate()
}).required()

export const create_contestant_validator = Joi.object({
    name: Joi.string().required(),
    ContestId: Joi.number().required(),
    image: Joi.object({
        id: Joi.string().required(),
        url: Joi.string().uri().required(),
        file_name: Joi.string(),
        extension: Joi.string()
    }).required(),
    bio: Joi.string().required(),
    twitter: Joi.string(),
    instagram: Joi.string(),
    custom_fields: Joi.object().pattern(
        Joi.string().required(), 
        Joi.object({
            title: Joi.string().required(),
            value: Joi.string().required()
        }).required()
    )
}).required()

export const update_contestant_validator = Joi.object({
    id: Joi.number().required(),
    name: Joi.string().required(),
    ContestId: Joi.number().required(),
    image: Joi.object({
        id: Joi.string().required(),
        url: Joi.string().uri().required(),
        file_name: Joi.string(),
        extension: Joi.string()
    }).required(),
    bio: Joi.string().required(),
    twitter: Joi.string(),
    instagram: Joi.string(),
    evicted: Joi.boolean(),
    custom_fields: Joi.object().pattern(
        Joi.string().required(), 
        Joi.object({
            title: Joi.string().required(),
            value: Joi.string().required()
        }).required()
    )
}).required()

export const get_contestants_validator = Joi.object({
    page: Joi.string().regex(/^[0-9]+$/).default('1'),
    per_page: Joi.string().regex(/^[0-9]+$/).default('50'),
    ContestId: Joi.string().regex(/^[0-9]+$/).required(),
    search: Joi.string()
}).required()

export const get_contestants_with_slug_validator = Joi.object({
    page: Joi.number().default(1),
    per_page: Joi.number().default(50),
    slug: Joi.string().required(),
    search: Joi.string()
}).required()


export const resolve_bank_account_validator = Joi.object({
    bank_code: Joi.string().required(),
    account_number: Joi.string().required()
}).required()

export const upsert_contest_organizer_profile_validator = Joi.object({
    name: Joi.string().required(),
    instagram: Joi.string().optional(),
    twitter: Joi.string().optional(),
    website: Joi.string().optional().uri(),
    official_email: Joi.string().optional().email(),
    account_number: Joi.string().optional().pattern(/^\d+$/),
    bank_code: Joi.string().when('account_number', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
    }),
    bank_name: Joi.string().when('account_number', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
    })
}).required();

export const get_voting_fee_for_contest_validator = Joi.object({
    slug: Joi.string().required(),
    number_of_votes: Joi.number().required()
}).required()

export const get_payment_link_for_contest = Joi.object({
    ContestId: Joi.number().integer().required(),
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    ContestantId: Joi.number().integer().required(),
    votes: Joi.number().required() 
}).required()

export const get_contest_votes_validator = Joi.object({
    ContestId: Joi.number().integer().required(),
    page: Joi.number().default(1),
    per_page: Joi.number().default(50)
}).required()

export const add_bank_details_to_refund_validator = Joi.object({
    session_id: Joi.string().uuid().required(),
    bank_name: Joi.string().required(),
    bank_code: Joi.string().required(),
    account_number: Joi.string().required()
}).required()

export const initiate_contest_payout_validator = Joi.object({
    financial_record_id: Joi.number().integer().required(),
    amount: Joi.number().greater(0).required()
}).required()