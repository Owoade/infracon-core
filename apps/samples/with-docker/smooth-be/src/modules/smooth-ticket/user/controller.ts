import { Controller, Post } from "@nestjs/common";
import { SmoothTicketUserService } from "./service";
import { RequestPayload } from "@decorators/index";
import { change_password_with_otp_validator, initiate_password_update_validator, user_sign_in_validator, user_sign_up_validator } from "@validators/user";
import { SmoothTicketUserInterface } from "./type";
import { otp_validator } from "@validators/utils";

@Controller('ticket/user')
export class SmoothTicketUserController {
    constructor(
        private service: SmoothTicketUserService
    ){}

    @Post('/auth/sign-up')
    async signup(
        @RequestPayload({
            validator: user_sign_up_validator
        })
        payload: SmoothTicketUserInterface
    ){

        await this.service.signup( payload );

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

            await this.service.verify_signup_otp(payload.otp);

        return {
            status: true,
            statusCode: 201,
            message: "Success"
        }

    }

    @Post("/auth/login")
    async login(
        @RequestPayload({
            validator: user_sign_in_validator
        })
        payload: { email: string, password: string }
    ){

        const token = await this.service.login( payload );

        return {
            status: true,
            statusCode: 200,
            data: {
                token
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

        await this.service.change_password( payload.email );

        return {
            status: true,
            statusCode: 200,
            message: `Check your inbox at ${payload.email} We've just sent you an otp.`
        }

    }

     @Post("/auth/change-password/")
        async change_password(
            @RequestPayload({
                validator: change_password_with_otp_validator
            })
            payload: { password: string, otp: string }
        ){
    
            await this.service.verify_change_password_otp( payload.password, payload.otp )
    
            return {
                status: true,
                statusCode: 200,
                message: "Password changed"
            }
    
        }
    
}
