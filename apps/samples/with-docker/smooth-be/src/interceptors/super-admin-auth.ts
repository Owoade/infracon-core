import { AuthenticationService } from "@modules/core/auth/auth.service";
import { users } from "@modules/super-admin/users";
import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";

@Injectable()
export class SuperAdminAuthInterceptor implements NestInterceptor {

    constructor(
        private auth_service: AuthenticationService
    ){}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {

        const response = context.switchToHttp().getResponse<Response>();

        const request = context.switchToHttp().getRequest<Request>();

        const auth_header = request.headers.authorization;

        if( !auth_header ) throw new BadRequestException("Authorization header not set");

        if( !auth_header.startsWith("Bearer") ) throw new BadRequestException("Authorization header value must start with `Bearer`");

        const [ type, token ] = auth_header.split(' ');

        const payload = await this.auth_service.verify_token( token ) as any;

        if( !payload ) throw new BadRequestException("Invalid token");

        const TOKEN_IS_NOT_FOR_SUPER_ADMIN = !payload.email || !users.map( _ => _.email.toLowerCase() ).includes( payload.email.toLowerCase());

        if( TOKEN_IS_NOT_FOR_SUPER_ADMIN )
            throw new ForbiddenException('Token is invalid for super admin');

        return next.handle();

    }
}