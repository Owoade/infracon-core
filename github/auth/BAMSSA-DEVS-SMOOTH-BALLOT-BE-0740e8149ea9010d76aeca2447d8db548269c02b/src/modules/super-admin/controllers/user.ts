import { RequestPayload, User } from "@decorators/index";
import { BillingRepository } from "@modules/billing/billing.repo";
import { BillingService } from "@modules/billing/billing.service";
import { CreateBillingBySuperAdmin } from "@modules/billing/type";
import { GetUsers, UserModelInterface } from "@modules/user/type";
import { UserRepository } from "@modules/user/user.repo";
import { Controller, Delete, Get, NotFoundException, Patch, Post, UseInterceptors } from "@nestjs/common";
import { response } from "@utils/response";
import { create_billing_by_super_admin_validator, get_billings_validator } from "@validators/billing";
import { get_users_validator } from "@validators/user";
import { id_validator } from "@validators/utils";
import { SuperAdminAuthInterceptor } from "src/interceptors/super-admin-auth";

@Controller('superadmin/user')
@UseInterceptors(SuperAdminAuthInterceptor)
export class UserManagementController {
    
    constructor(
        private user_repo: UserRepository,
        private billing_repo: BillingRepository,
        private billing_service: BillingService 
    ){}

    @Post('/')
    async get_user(

        @RequestPayload({
            validator: get_users_validator
        })
        payload: GetUsers 

    ){
        
        const { count, users } = await this.user_repo.get_users( payload, ['email', 'id', 'name'] );

        return response({
            status: true,
            statusCode: 200,
            data: {
                count,
                users
            }
        })
        
    }

    @Patch('/activity')
    async toggle_user_activity(

        @RequestPayload({
            validator: id_validator("UserId"),
            type: 'query'
        })
        payload: any

    ){

        const { UserId } = payload;

        const user = await this.user_repo.get_user_by_id( UserId, ['is_disabled'] );

        if( !user ) throw new NotFoundException('User not found');

        const updated_user = await this.user_repo.update_user_with_id( { is_disabled: !Boolean(user.is_disabled) }, UserId )

        delete (updated_user as any).password;

        return response({
            status: true,
            statusCode: 200,
            data: {
                updated_user
            }
        })

    }

    @Post('/billings')
    async get_billings(

        @RequestPayload({
            validator: get_billings_validator
        })
        payload: any

    ){

        const { filter , page, per_page } = payload;

        const get_billing_payload = {
            filter,
            page,
            per_page
        }

        const billings = await this.billing_repo.get_billings( get_billing_payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                billings
            }
        })
        
    }
    
    @Post('/billing')
    async create_billing(
        @RequestPayload({
            validator: create_billing_by_super_admin_validator
        })
        payload: CreateBillingBySuperAdmin
    ){

        const billing = await this.billing_service.create_billing_by_super_admin( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                billing
            }
        })

    }

    @Delete('/billing/:id')
    async delete_billing(
        @RequestPayload({
            validator: id_validator('id'),
            type: 'params'
        })
        payload: { id: number }
    ){

        const billing = await this.billing_service.delete_billing_super_admin( payload.id );

        return response({
            status: true,
            statusCode: 200,
            data: {
                billing
            }
        })

    }
    
}