import { RequestPayload } from "@decorators/index";
import { BillingService } from "@modules/billing/billing.service";
import { PlatformRepository } from "@modules/platform/repo";
import { PlatformService } from "@modules/platform/service";
import { Controller, Patch, Post, UseInterceptors } from "@nestjs/common";
import { response } from "@utils/response";
import { get_billings_validator } from "@validators/billing";
import { update_patform_rates_validator } from "@validators/platform";
import { SuperAdminAuthInterceptor } from "src/interceptors/super-admin-auth";

@Controller('superadmin/platform')
@UseInterceptors(SuperAdminAuthInterceptor)
export class PlatformManagementController {

    constructor(
        private platform_service: PlatformService,
        private billing_service: BillingService
    ){}

    @Post('/billing')
    async get_platform_billing_history(
        @RequestPayload({
            validator: get_billings_validator
        })
        payload: any
    ){

        const result = await this.billing_service.get_billing_history( payload );

        return response({
            status: true,
            statusCode: 200,
            data: {
                result
            }
        })

    }

    @Patch('/rate')
    async update_platform_rate(

        @RequestPayload({
            validator: update_patform_rates_validator
        })
        payload: any

    ){

        const updated_rate = await this.platform_service.update_platform_rate( payload );
        
        return response({
            status: true,
            statusCode: 200,
            data: {
                updated_rate
            }
        })

    }

}