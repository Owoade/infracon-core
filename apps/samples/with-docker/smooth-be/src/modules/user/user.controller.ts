import { Controller, Get, Patch, Post, UseInterceptors } from "@nestjs/common";
import { UserService } from "./user.service";
import { RequestPayload, User } from "@decorators/index";
import { change_password_validator, initiate_password_update_validator, update_user_validator, user_sign_in_validator, user_sign_up_validator } from "@validators/user";
import { UpdateUser, UserModelInterface } from "./type";
import { id_validator, otp_validator } from "@validators/utils";
import { UserAuthInterceptor } from "src/interceptors/auth";

@Controller('user')
export class UserController {

    constructor(
        private user_service: UserService
    ){}
    
    @Post('/auth/sign-up')
    async sign_in(
        @RequestPayload({
            validator: user_sign_up_validator
        })
        payload: UserModelInterface
    ){

        await this.user_service.sign_up( payload );

        return {
            statusCode: 200,
            status: true,
            message: `Check your inbox at ${payload.email} We've just sent you an otp.`
        }

    }

    @Post('/auth/sign-up/verify')
    async verify_sign_up(
        @RequestPayload({
            validator: otp_validator
        })
        payload: { otp: string }
    ){

        const response = await this.user_service.verify_signup(payload.otp);

        return {
            status: true,
            statusCode: 201,
            data: {
                ...response
            }
        }

    }

    @Post("/auth/login")
    async login(
        @RequestPayload({
            validator: user_sign_in_validator
        })
        payload: { email: string, password: string }
    ){

        const response = await this.user_service.login( payload.email, payload.password );

        return {
            status: true,
            statusCode: 200,
            data: {
                ...response
            }
        }

    }

    @Post("/auth/forgot-password/init")
    async initiate_password_update(
        @RequestPayload({
            validator: initiate_password_update_validator
        })
        payload: { email: string }
    ){

        await this.user_service.initiate_password_update( payload.email );

        return {
            status: true,
            statusCode: 200,
            message: `Check your inbox at ${payload.email} We've just sent you an otp.`
        }

    }

    @Post("/auth/forgot-password/verify")
    async verify_password_update_otp(
        @RequestPayload({
            validator: otp_validator
        })
        payload: { otp: string }
    ){

        const session_id = await this.user_service.verify_password_update_otp( payload.otp )

        return {
            status: true,
            statusCode: 200,
            data: {
                session_id
            }
        }

    }

    @Post("/auth/forgot-password/")
    async change_password(
        @RequestPayload({
            validator: change_password_validator
        })
        payload: { password: string, session_id: string }
    ){

        await this.user_service.change_password( payload )

        return {
            status: true,
            statusCode: 200,
            message: "Password changed"
        }

    }

    @Get('/')
    @UseInterceptors(UserAuthInterceptor)
    async get_user(
        @User()
        _user: UserModelInterface
    ){

        const user = await this.user_service.get_user( _user.id );

        return {
            status: true,
            statusCode: 200,
            data: {
                user
            }
        }

    }

    @Patch('/')
    @UseInterceptors(UserAuthInterceptor)
    async update_user(

        @RequestPayload({
            validator: update_user_validator,
            type: "body"
        })
        payload: UpdateUser,

        @User()
        user: UserModelInterface
    ){

        const updated_user = await this.user_service.update_user(payload, user.id);

        return {
            status: true,
            statusCode: 200,
            data: {
                updated_user
            }
        }
    }

    

}