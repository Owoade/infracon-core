import { RequestPayload } from "@decorators/index";
import { Controller, Get, Inject, OnModuleInit, Post, UseInterceptors } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { get_logs_validater } from "@validators/logging";
import { SuperAdminAuthInterceptor } from "src/interceptors/super-admin-auth";

@Controller('superadmin/user/session')
@UseInterceptors(SuperAdminAuthInterceptor)
export class UserSessionController implements OnModuleInit {

    private log_service;

    constructor(
        @Inject('LOG_SERVICE')
        private client: ClientGrpc
    ){}

    onModuleInit() {

        this.log_service = this.client.getService('LogService');

    }

    @Post('/')
    async get_logs(
        @RequestPayload({
            validator: get_logs_validater
        })
        payload: any
    ){

        const logs = await this.log_service.getLogs( payload ).toPromise();

        return logs;

    }


}