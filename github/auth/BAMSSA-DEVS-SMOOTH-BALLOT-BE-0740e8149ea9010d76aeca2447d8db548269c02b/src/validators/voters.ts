import * as Joi from "joi";

export const create_voters_from_accreditation_form_validator = Joi.object({
    slug: Joi.string().required(),
    voter: Joi.object({
        email: Joi.string().email().required(),
        data: Joi.object().required()
    }).required()
}).required()

export const create_voters_from_accreditation_form_validator_with_short_code = Joi.object({
    short_code: Joi.alternatives().try(Joi.number(), Joi.string().regex(/^[0-9]+$/)).required(),
    voter: Joi.object({
        email: Joi.string().email().required(),
        data: Joi.object().required()
    }).required()
}).required()

export const authenticate_voters_validator = Joi.object({
    email: Joi.string().email(),
    password: Joi.string().required(),
    slug: Joi.string().required()
}).required()

export const cast_vote_validator = Joi.object({
    votes: Joi.array().items(Joi.object({
        ElectionPostId: Joi.number().integer().required(),
        CandidateId: Joi.number().integer().required()
    }).required()).required()
}).required();

export const insert_voter = Joi.object({
    voter: Joi.object().required()
}).required()