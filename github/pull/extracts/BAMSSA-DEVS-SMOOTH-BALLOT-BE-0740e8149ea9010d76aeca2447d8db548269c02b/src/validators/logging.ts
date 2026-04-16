import * as Joi from "joi";

export const get_logs_validater = Joi.object({

    UserId: Joi.number().integer().required(),

    date: Joi.object({
        from: Joi.string().isoDate().required(),
        to: Joi.string().isoDate().required()
    }),

    type: Joi.string().valid("election", "auth", "billing"),

    page: Joi.number().integer().default(1),

    per_page: Joi.number().integer().default(100)

}).required()