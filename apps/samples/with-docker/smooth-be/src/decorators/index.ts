import { BadRequestException, ExecutionContext, createParamDecorator } from '@nestjs/common';
import * as Joi from 'joi';

export const RequestPayload = createParamDecorator(function (data: {
  validator: Joi.ObjectSchema;
  type?: 'body' | 'query' | 'params';
}, ctx: ExecutionContext) {

    const request = ctx.switchToHttp().getRequest();

    const payload = data.type ? request[data.type] : request.body;

    const { error, value  } = data.validator.validate( payload );

    if (!request?.body && error) return console.error(error?.message);

    if( error ) throw new BadRequestException(error.message);

    return value;

});

export const User = createParamDecorator(function(data:unknown, ctx: ExecutionContext){

  const response = ctx.switchToHttp().getResponse();

  return response.locals.user;

})

export const Voter = createParamDecorator(function(data:unknown, ctx: ExecutionContext){

  const response = ctx.switchToHttp().getResponse();

  return response.locals.voter;

})


