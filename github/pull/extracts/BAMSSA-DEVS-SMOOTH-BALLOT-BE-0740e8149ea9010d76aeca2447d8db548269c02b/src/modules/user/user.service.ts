import { AuthenticationService, ChangeUserPassword } from "@modules/core/auth/auth.service";
import { UserRepository } from "./user.repo";
import { UpdateUser, UserModelInterface } from "./type";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { WalletRepository } from "@modules/wallet/wallet.repo";
import db from "@db/postgres/index";
import { Transaction } from "sequelize";
import * as crypto from "crypto";
import { redis_client } from "@cache/index";
import { Queue } from "bull";
import { LogModelInterface } from "@modules/core/gateway/logging/type";
import { LOG_QUEUE } from "src/queue/config";
import { InjectQueue } from "@nestjs/bull";
import { NODE_ENV } from "@env/index";

@Injectable()
export class UserService {

    constructor(
        private auth_service: AuthenticationService,
        private wallet_repo: WalletRepository,
        private repo: UserRepository,
        @InjectQueue(LOG_QUEUE)
        private log_queue: Queue<LogModelInterface>
    ){}

    async sign_up( payload: UserModelInterface ){

        await this.auth_service.user_signup( payload );

    }

    async verify_signup( otp: string ){

        const transaction = await db.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
        })

        try {

            const response = await this.auth_service.verify_sign_up( otp, transaction );

            const { user } = response;

            
            await this.wallet_repo.create({
                UserId: user.id,
                account_balance: 0,
                account_name: user.name,
                account_number: crypto.randomInt(1000000000,1999999999).toString(),
                bank_name: "Smooth Bank",
                meta: { meta: "Smooth TM" }
            }, transaction )

            await transaction.commit();

            return response;

        }

        catch(e){

            console.error(e)

            await transaction.commit();

            throw new BadRequestException( e.message );

        }

        

    }

    async get_user_from_cache( user_id: number ){

        const cached_user = await redis_client.get(`user-${user_id}`);

        if( cached_user ) return JSON.parse( cached_user ) as UserModelInterface;

        const user = await this.repo.get_user_by_id( user_id );

        if( user ) await redis_client.setex(`user-${user_id}`, 3600, JSON.stringify(user));

        return user;

    }

    async login( email: string, password: string ){

        const response = await this.auth_service.user_login( email, password );

        this.log_queue.add({
            UserId: response.user.id,
            description: "User successfully logged in",
            type: "auth"
        })

        return response;

    }

    async initiate_password_update( email: string ){

        await this.auth_service.initiate_user_password_update( email );

    }

    async verify_password_update_otp( otp: string ){

        const session_id = await this.auth_service.verify_passoword_update_otp(otp);

        return session_id;

    }

    async change_password( payload: ChangeUserPassword ){

        const response = await this.auth_service.change_password( payload );

        return response;

    }

    async update_user( payload: UpdateUser, user_id: number ){

        const user = await this.repo.get_user_by_id( user_id, ['password']);

        if( !user ) throw new NotFoundException('User not found');

        const update = {} as Partial<UserModelInterface>;

        if( payload.password ){

            const password = payload.password;

            if( !this.auth_service.compare_password( password.old, user.password ))
                throw new ForbiddenException("Your old password is invalid");

            update.password = this.auth_service.hash_password( password.new );

        }

        if( payload.name) update.name = payload.name

        if( payload.photo ) update.photo = payload.photo;

        const updated_user = await this.repo.update_user_with_id( update, user_id );

        delete updated_user.toJSON().password;

        return updated_user;

    }

    async get_user( user_id: number ){

        const user = await this.repo.get_user_by_id( user_id );

        delete user.password;

        delete user.is_disabled;

        delete user.type;

        return user;

    }

}