import * as Joi from "joi";

export const update_patform_rates_validator = Joi.object({
    price_per_voter: Joi.number().required(),
    price_per_month: Joi.number().required()
}).required()