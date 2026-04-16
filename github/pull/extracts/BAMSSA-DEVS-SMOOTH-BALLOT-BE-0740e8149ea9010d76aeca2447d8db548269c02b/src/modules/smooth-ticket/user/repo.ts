import { Inject, Injectable } from "@nestjs/common";
import { SMOOTH_TICKET_USER_MODEL_PROVIDER } from "./model";
import { InferedSchemaType } from "@utils/schema";
import { SmoothTicketUserInterface } from "./type";

@Injectable()
export class SmoothTicketUserRepository {
    constructor(
        @Inject(SMOOTH_TICKET_USER_MODEL_PROVIDER)
        private SmoothTicketUserModel: InferedSchemaType<SmoothTicketUserInterface>
    ){}

    async create_user(payload: SmoothTicketUserInterface){
        const new_user = await this.SmoothTicketUserModel.create(payload)
        return new_user?.toJSON();
    }

    async get_user<T extends keyof SmoothTicketUserInterface>(filter: Partial<SmoothTicketUserInterface>, attributes?: T[]){
        const user = await this.SmoothTicketUserModel.findOne(
            {
                where: filter,
                ...(attributes ? { attributes } : {}),
            }
        )

        if( attributes ) return user?.toJSON() as Pick<SmoothTicketUserInterface, T>

        return user?.toJSON()
    }

    async update_user(
        update: Partial<SmoothTicketUserInterface>,
        filter: Partial<SmoothTicketUserInterface>
    ){
        const updated_user = await this.SmoothTicketUserModel.update(
            update,
            {
                where: filter,
                returning: true 
            }
        )

        return updated_user?.[1]?.[0];
    }
}