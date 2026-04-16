import * as Joi from 'joi';

export const fund_wallet_validator = Joi.object({
    amount: Joi.number().required(),
    callback_url: Joi.string().uri()
}).required();