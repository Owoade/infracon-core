import { AuthenticationService } from "@modules/core/auth/auth.service";
import { VotersService } from "@modules/election/voters/service";
import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor, NotFoundException } from "@nestjs/common";
import { Request, Response } from "express";
import { Observable } from "rxjs";

@Injectable()
export class VoterAuthInterceptor implements NestInterceptor {

    constructor(
        private voter_service: VotersService,
        private auth_service: AuthenticationService
    ){}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {

        const response = context.switchToHttp().getResponse<Response>();

        const request = context.switchToHttp().getRequest<Request>();

        // console.log( request.cookies.token )

        if( !request.url.includes("action") ) return next.handle(); 

        const auth_header = request.headers.authorization;

        if( !auth_header ) throw new BadRequestException("Authorization header not set");

        if( !auth_header.startsWith("Bearer") ) throw new BadRequestException("Authorization header value must start with `Bearer`");

        const [ type, token ] = auth_header.split(' ');

        const payload = await this.auth_service.verify_token( token ) as any;

        if( !payload ) throw new BadRequestException("Invalid token");

        const cached_voter = await this.voter_service.get_voter_from_cache(payload.id);

        if( !cached_voter ) throw new NotFoundException('Voter not found');

        if( cached_voter.is_suspended ) throw new ForbiddenException('This account has been suspended');

        response.locals.voter = cached_voter;

        return next.handle();
        
    }

}