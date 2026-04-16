import * as Joi from "joi";

export const create_billing_validator = Joi.object({
    ElectionId: Joi.number(),
    no_of_voters: Joi.number().min(1).required(),
    no_of_months: Joi.number().min(1).required(),
    type: Joi.string().valid("free", "paid")
}).required()

export const update_billing_validator = Joi.object({
    id: Joi.number().required(),
    ElectionId: Joi.number().required(),
    no_of_voters: Joi.number().required(),
    no_of_months: Joi.number().required(),
}).required()

export const get_quote_validator = Joi.object({
    no_of_voters: Joi.number().default(0).required(),
    no_of_months: Joi.number().default(0).required(),
    type: Joi.string().valid("free", "paid"),
    mode: Joi.string().valid("renewal", "purchase").default("purchase")
}).required()


export const get_billings_validator = Joi.object({
    filter: Joi.object({
        UserId: Joi.number().integer().required()
    }),
    
    date: Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required()
    }), 
    page: Joi.number().default(1),
    per_page: Joi.number().default(50)
}).required()

export const create_billing_by_super_admin_validator = Joi.object({
    UserId: Joi.number().integer().required(),
    no_of_voters: Joi.number().integer().required(),
    no_of_months: Joi.number().integer().required(),
}).required()


