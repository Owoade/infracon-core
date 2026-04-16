import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SmoothTicketUserRepository } from "./repo";
import { SmoothTicketUserInterface } from "./type";
import { TOKEN_PASSPHRASE } from "@env/index";
import * as OTP from "otp-generator";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { redis_client } from "@cache/index";
import { EmailService } from "@modules/core/email/email.service";

@Injectable()
export class SmoothTicketUserService {
    constructor(
        private repo: SmoothTicketUserRepository,
        private email_service: EmailService
    ){}

    async signup( payload: SmoothTicketUserInterface ){

        payload.email = payload.email.toLowerCase()
        const existing_user = await this.repo.get_user({
            email: payload.email
        }, ['email'])

        if( existing_user )
            return new BadRequestException('User exists')

        const otp = this.generate_otp();

        payload.password = this.hash_password( payload.password );

        Promise.all([
            redis_client.setex(otp, 300,JSON.stringify(payload)),
            this.email_service.send_otp({
                name: payload.name.split(" ")[0],
                email: payload.email,
                otp,
                product: "ticket"
            })
        
        ])

    }

    async login(payload: Pick<SmoothTicketUserInterface, "email" | "password">){

        payload.email = payload.email.toLowerCase()
        const existing_user = await this.repo.get_user({
            email: payload.email
        }, ['email', 'password', 'id'])

        if(!existing_user)
            throw new NotFoundException("User nor found")

        if(!bcrypt.compareSync(payload.password, existing_user.password)){
            throw new BadRequestException("Invalid password!")
        }

        const token = this.sign_token({ id: existing_user.id })

        return token;

    }

    async change_password( email: string ){

        const existing_user = await this.repo.get_user({
            email
        }, ['name'])

        if(!existing_user)
            throw new NotFoundException("User not found")

        const otp = this.generate_otp();
        Promise.all([
            redis_client.setex(otp, 300, email),
            this.email_service.send_otp({
                name: existing_user.name.split(" ")[0],
                email: email,
                otp,
                product: "ticket"
            })
        
        ])


    }

    async verify_change_password_otp(password: string, otp: string){
        const email = await redis_client.get(otp);

        if(!email)
            throw new BadRequestException('Invalid otp')

        const existing_user = await this.repo.get_user({
            email
        }, ['name'])

        if(!existing_user)
            throw new NotFoundException("User nor found")

        await this.repo.update_user(
            {
                password: this.hash_password(password)
            },
            {
                email
            }
        )

    }

    async verify_signup_otp(otp: string){
        
        const cached_user = await this.verify_otp(otp);
        if( !cached_user ) throw new BadRequestException("Otp is invalid");
        const user = JSON.parse( cached_user ) as SmoothTicketUserInterface;
        
        const existing_user = await this.repo.get_user({ email: user.email}, ['email']);
        if( existing_user ) throw new BadRequestException("User with this email exists");
       
        await this.repo.create_user(user);
        redis_client.del(otp )
    }

    async verify_otp( otp: string ){

        const otp_value = await redis_client.get(otp);

        return otp_value;

    }

    generate_otp(){

        const otp = OTP.generate(6, {
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            digits: true,
        });

        return otp;

    }

    hash_password( password: string ){
    
            const salt = bcrypt.genSaltSync(10);
    
            const hashed_password = bcrypt.hashSync(password, salt);
    
            return hashed_password;
    
    }

    async sign_token( payload: any ){
    
            const token = jwt.sign(payload, TOKEN_PASSPHRASE )
    
            return token;
    
        }
    
    async verify_token( token: string ){

        try{
            const decoded = jwt.verify( token, TOKEN_PASSPHRASE );

            return decoded;

        }catch(e){

            return false
        }

    }


}