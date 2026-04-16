import * as Joi from "joi";

export const pagination_validator = Joi.object({
    page: Joi.string().regex(/^[0-9]+$/).default('1'),
    per_page: Joi.string().regex(/^[0-9]+$/).default('50')
})

export const id_validator = ( id: string ) => Joi.object({
    [id]: Joi.alternatives().try(Joi.number(), Joi.string().regex(/^[0-9]+$/)).required()
})

export const otp_validator = Joi.object({
    otp: Joi.string().regex(/^[0-9]+$/).required()
}).required()

export const id_validator_string = ( id: string ) => Joi.object({
    [id]: Joi.string().required()
}).required()