import { POSTGRES_ENCRYPTION_SECRET, TOKEN_PASSPHRASE } from "@env/index";
import { UserRepository } from "@modules/user/user.repo";
import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import * as paseto from "paseto";
import * as bcrypt from "bcryptjs";
import { EmailService } from "../email/email.service";
import { Redis } from "ioredis";
import { REDIS_PROVIDER } from "@cache/index";
import { UserModelInterface } from "@modules/user/type";
import * as OTP from "otp-generator";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { Transaction } from "sequelize";
import { Queue } from "bull";
import { LogModelInterface } from "../gateway/logging/type";
import { InjectQueue } from "@nestjs/bull";
import { LOG_QUEUE } from "src/queue/config";

@Injectable()
export class AuthenticationService {

    constructor(
        private user_repo: UserRepository,
        private email_service: EmailService,
        @Inject(REDIS_PROVIDER)
        private redis_service: Redis,
        @InjectQueue(LOG_QUEUE)
        private log_queue: Queue<LogModelInterface>
    ){

        this.generate_otp = this.generate_otp.bind( this );
    
    }


    async user_signup( payload: UserModelInterface ){

        payload.email = payload.email.toLowerCase()

        const existing_user = await this.user_repo.get_user_by_email( payload.email );

        if( existing_user ) throw new BadRequestException("User with this email exists");

        payload.type = "USER";

        const otp = this.generate_otp();

        payload.password = this.hash_password( payload.password );

        Promise.all([

            this.redis_service.setex(otp, 300,JSON.stringify(payload)),

            this.email_service.send_otp({
                name: payload.name.split(" ")[0],
                email: payload.email,
                otp
            })
        
        ])

    }

    async user_login( email: string, password: string ){

        const existing_user = await this.user_repo.get_user_by_email( email.toLowerCase() );

        if( !existing_user ) throw new BadRequestException("User not found");

        const INVALID_PASSWORD = !this.compare_password(password, existing_user.password );

        if( INVALID_PASSWORD ) throw new BadRequestException("Invalid password");

        const token = await this.sign_token({ id: existing_user.id });

        delete existing_user.password;

        return {
            user: existing_user,
            token
        }

    }

    async initiate_user_password_update( email: string ){

        const existing_user = await this.user_repo.get_user_by_email( email );

        if( !existing_user ) throw new BadRequestException("This email doesn't exist for a registered user");

        const otp = this.generate_otp();

        await Promise.all([

            this.redis_service.setex(`${otp}-pu`, 300,existing_user.id ),

            this.email_service.send_otp({
                name: existing_user.name.split(" ")[0],
                email: existing_user.email,
                otp
            })
        
        ])
    }

    async verify_passoword_update_otp( otp: string ){

        const user_id = await this.verify_otp(`${otp}-pu`);

        if( !user_id ) throw new BadRequestException("Otp is invalid");

        const session_id = crypto.randomUUID();

        await Promise.all([
            this.redis_service.setex(session_id, 600, user_id),
            this.redis_service.del(`${otp}-pu`)
        ]);

        return session_id;

    }

    async change_password( payload: ChangeUserPassword ){

        const user_id = await this.redis_service.get( payload.session_id );

        if(!user_id) throw new BadRequestException("Session timed out");

        const hashed_password = this.hash_password( payload.password );

        await Promise.all([

            this.user_repo.update_user_with_id({ password: hashed_password },parseInt(user_id)),
            
            this.redis_service.del( payload.session_id ),

            this.log_queue.add({
                UserId: parseInt(user_id),
                description: "User changed their password",
                type: "auth"
            })

        ])

    }

    async verify_sign_up( otp: string, transaction?: Transaction ){

        const cached_user = await this.verify_otp(otp);

        if( !cached_user ) throw new BadRequestException("Otp is invalid");

        const user = JSON.parse( cached_user ) as UserModelInterface;

        const existing_user = await this.user_repo.get_user_by_email( user.email );

        console.log( existing_user );

        if( existing_user ) throw new BadRequestException("User with this email exists");
        
        const new_user = await this.user_repo.create(user, transaction);

        const [token] = await Promise.all([

          this.sign_token({ id: new_user.id }),

          this.redis_service.del(otp ),

          this.log_queue.add({
            UserId: new_user.id,
            type: "auth",
            description: "User created an account"
          })

        ]);

        delete new_user.password;

        return {
            token,
            user: new_user
        }

    }

    async verify_otp( otp: string ){

        const otp_value = await this.redis_service.get(otp);

        return otp_value;

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

    encrypt_string( string: string ){

        const iv = crypto.randomBytes(16);

        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(POSTGRES_ENCRYPTION_SECRET), iv);

        let encrypted = cipher.update(string);

        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    
    }

    decrypt_string(string: string) {

        let textParts = string.split(':');

        let iv = Buffer.from(textParts.shift(), 'hex');

        let encryptedText = Buffer.from(textParts.join(':'), 'hex');

        let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(POSTGRES_ENCRYPTION_SECRET), iv);

        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();

      }
    

    compare_password( password: string, hash: string ){
        return bcrypt.compareSync(password, hash);
    }
    
}

export interface ChangeUserPassword {
    password: string;
    session_id: string;
}
