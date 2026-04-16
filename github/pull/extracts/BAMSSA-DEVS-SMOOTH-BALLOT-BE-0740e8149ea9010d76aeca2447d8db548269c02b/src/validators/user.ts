import * as Joi from "joi";

export const user_sign_up_validator = Joi.object({

    email: Joi.string().email().required(),

    password: Joi.string().min(8).required(),

    name: Joi.string().min(6) .required()   
    
}).required()

export const user_sign_in_validator = Joi.object({
    
    email: Joi.string().email().required(),

    password: Joi.string().min(8).required()

}).required()

export const initiate_password_update_validator = Joi.object({
    
    email: Joi.string().email().required(),
    
}).required()

export const change_password_validator = Joi.object({
    
    password: Joi.string().min(8).required(),

    session_id: Joi.string().uuid().required()
    
}).required()

export const change_password_with_otp_validator = Joi.object({
    
    password: Joi.string().min(8).required(),

    otp: Joi.number().required()
    
}).required()

export const get_users_validator = Joi.object({

    page: Joi.number().default(1),

    per_page: Joi.number().default(50),

    search: Joi.string()
    
}).required()

export const update_user_validator = Joi.object({

    photo: Joi.object({
        id: Joi.string().required(),
        link: Joi.string().uri().required()
    }),

    password: Joi.object({
        old: Joi.string().required(),
        new: Joi.string().min(8).required()
    }),

    name: Joi.string()

}).required()