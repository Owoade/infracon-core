import { BadRequestException, Controller, NotFoundException, Post } from "@nestjs/common";
import { SuperAdminService } from "../service";
import { RequestPayload } from "@decorators/index";
import { id_validator, id_validator_string } from "@validators/utils";
import { response } from "@utils/response";
import { AuthenticationService } from "@modules/core/auth/auth.service";
import { users } from "../users";
import { EmailService } from "@modules/core/email/email.service";
import { redis_client } from "@cache/index";

@Controller('superadmin')
export class SuperAdminController {

    constructor(
        private service: SuperAdminService,
        private auth_service: AuthenticationService,
        private email_service: EmailService
    ){}

    @Post('/auth/login')
    async login( 
        @RequestPayload({
            validator: id_validator_string('email')
        })
        payload: { email: string }
    ){

        const { email } = payload;

        await this.service.login( email )

        return response({
            status: true,
            statusCode: 200,
            data: {},
            message: "OTP sent"
        })

    }

    @Post('/auth/verify')
    async verify( 
        @RequestPayload({
            validator: id_validator('otp')
        })
        payload: { otp: string }
    ){

        const token = await this.service.verify_otp( payload.otp )

        return response({
            status: true,
            statusCode: 200,
            data: {
                token
            }
        })

    }
}