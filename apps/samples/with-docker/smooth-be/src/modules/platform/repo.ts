import { InferedSchemaType } from "@utils/schema";
import { PlatformModelInterface } from "./type";
import { Transaction } from "sequelize";
import { Inject, Injectable } from "@nestjs/common";
import { PLATFORM_MODEL_PROVIDER } from "./model";

@Injectable()
export class PlatformRepository {

    constructor(
        @Inject(PLATFORM_MODEL_PROVIDER)
        private platform_model: InferedSchemaType<PlatformModelInterface>
    ){}

    async get_platform(){

        const platform = await this.platform_model.findOne();

        return platform?.toJSON();

    }

    async update_platform_rate( payload: Partial<Pick<PlatformModelInterface, 'price_per_month' | 'price_per_voter'>> ){

       const updated_platform = await this.platform_model.update( payload, { where: { id: 1 }, returning: true });

       return (updated_platform?.[1]?.[0])?.toJSON();

    }

   async increament_platform_income( by: number, transaction?: Transaction ){

        await this.platform_model.increment('income', { by, ...( transaction ? { transaction }: {}), where: { id: 1 } });

   }
}