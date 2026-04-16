import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    BadRequestException,
    ForbiddenException,
  } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { AuthenticationService } from '@modules/core/auth/auth.service';
import { UserRepository } from '@modules/user/user.repo';
import { redis_client } from '@cache/index';

@Injectable()
export class UserAuthInterceptor implements NestInterceptor {
    constructor(
       private user_repo: UserRepository,
       private auth_service: AuthenticationService
       
    ){}
    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {

        const response = context.switchToHttp().getResponse<Response>();

        const request = context.switchToHttp().getRequest<Request>();

        if( request.url.includes("whitelist") ) return next.handle(); 

        const auth_header = request.headers.authorization;

        if( !auth_header ) throw new BadRequestException("Authorization header not set");

        if( !auth_header.startsWith("Bearer") ) throw new BadRequestException("Authorization header value must start with `Bearer`");

        const [ type, token ] = auth_header.split(' ');

        const payload = await this.auth_service.verify_token( token ) as any;

        if( !payload ) throw new BadRequestException("Invalid token");

        const cached_user = await redis_client.get(`user-${payload.id}`);

        let user;

        if( cached_user ) user = JSON.parse( cached_user );

        else user = await this.user_repo.get_user_by_id( payload.id );

        if(!user) throw new ForbiddenException("This operation is beyond the scope of your privilege");

        await redis_client.set(`user-${payload.id}`, JSON.stringify(user))

        response.locals.user = user;
        
        return next.handle();
        
    }
}