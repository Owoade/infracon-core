import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from "crypto";
import { PAYSTACK_SECRET_KEY } from '@env/index';

export class PaystackSignatureValidationGuard implements CanActivate {

    canActivate(context: ExecutionContext): boolean  {

        const request = context.switchToHttp().getRequest<Request>();

        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(request.body)).digest('hex');

        return hash == request.headers['x-paystack-signature']
        
    }

}