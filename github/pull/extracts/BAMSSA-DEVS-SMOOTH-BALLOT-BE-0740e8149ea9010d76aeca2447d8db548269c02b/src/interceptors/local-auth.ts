import { LOCAL_AUTHENTICATION_KEY } from "@env/index";
import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class LocalAuthenticationKeyInterceptor implements NestInterceptor {

    constructor(){}

    intercept(context: ExecutionContext, next: CallHandler<any>): any {

        const request = context.switchToHttp().getRequest() as Request;

        const auth_header = request.headers.authorization;

        if( auth_header !== LOCAL_AUTHENTICATION_KEY )
            throw new BadRequestException('Invalid local auth key');

        return next.handle();
        
    }

}