import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { users } from "./users";
import { EmailService } from "@modules/core/email/email.service";
import { AuthenticationService } from "@modules/core/auth/auth.service";
import { redis_client } from "@cache/index";
import { response } from "@utils/response";
import { UserService } from "@modules/user/user.service";
import { UserRepository } from "@modules/user/user.repo";
import { ElectionRepository } from "@modules/election/election.repo";
import { ElectionService } from "@modules/election/election.service";

@Injectable()
export class SuperAdminService {

    constructor(
        private email_service: EmailService,
        private auth_service: AuthenticationService,
        private user_repo: UserRepository,
        private election_repo: ElectionRepository,
        private election_service: ElectionService
    ){}

    async login( email: string ){

        console.log( this.auth_service )

        const user = users.find( user => user.email.toLowerCase() === email.toLowerCase() );

        if( !user ) 
            throw new NotFoundException('User not found');

        const otp = this.auth_service.generate_otp();

        await Promise.all([

            this.email_service.send_otp({
                otp,
                email,
                name: user.name
            }),
    
            redis_client.setex(otp, 300, email)

        ])
       
    }

    async verify_otp( otp: string ){

        const email = await this.auth_service.verify_otp( otp );

        if( !email ) throw new BadRequestException('Invalid OTP');

        const token = this.auth_service.sign_token({ email });

        await redis_client.del(otp);

        return token;

    }

    async send_result( election_id: number ){

        const election = await this.election_repo.get_one_election_by_filter({id: election_id}, ['UserId']);

        const user = await this.user_repo.get_user_by_id(election.UserId);

        const response = await this.election_service.send_result( election_id, user )

        return response;

    }   

}