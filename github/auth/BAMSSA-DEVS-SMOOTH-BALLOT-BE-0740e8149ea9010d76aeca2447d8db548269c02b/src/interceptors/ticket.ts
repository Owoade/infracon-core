
import { redis_client } from "@cache/index";
import { SmoothTicketUserRepository } from "@modules/smooth-ticket/user/repo";
import { SmoothTicketUserService } from "@modules/smooth-ticket/user/service";
import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";

@Injectable()
export class SmoothTicketUserAuthInterceptor implements NestInterceptor {

    constructor(
        private service: SmoothTicketUserService,
        private repo: SmoothTicketUserRepository
    ){}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {

        const response = context.switchToHttp().getResponse<Response>();

        const request = context.switchToHttp().getRequest<Request>();

        if( request.url.includes("whitelist") ) return next.handle(); 

        const auth_header = request.headers.authorization;

        if( !auth_header ) throw new BadRequestException("Authorization header not set");

        if( !auth_header.startsWith("Bearer") ) throw new BadRequestException("Authorization header value must start with `Bearer`");

        const [ type, token ] = auth_header.split(' ');

        const payload = await this.service.verify_token( token ) as any;

        if( !payload ) throw new BadRequestException("Invalid token");

        const cached_user = await redis_client.get(`ticket_user-${payload.id}`);
        
        let user;

        if( cached_user ) user = JSON.parse( cached_user );

        else user = await this.repo.get_user( {id: payload.id });

        if(!user) throw new ForbiddenException("This operation is beyond the scope of your privilege");

        await redis_client.set(`ticket_user-${payload.id}`, JSON.stringify(user))

        response.locals.user = user;

        return next.handle();

    }
}