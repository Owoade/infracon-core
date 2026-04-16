import db from "@db/postgres";
import { PaymentMetadataSchema } from "@db/postgres/schema/payment-metadata";
import { InferedSchemaType } from "./schema";
import { Sequelize } from "sequelize";

interface PaymentMetadataModelInterface {
    id: string,
    type: string,
    data: Record<string, any>
}

const PaymentMedadataModel = db.define(
    "PaymentMetadata",
    PaymentMetadataSchema
) as InferedSchemaType<PaymentMetadataModelInterface>

export const payment_metadata_repo = {
    async create(payload: PaymentMetadataModelInterface){
        const data = await PaymentMedadataModel.create(payload)
        return data?.toJSON()
    },

    async get(id: string){
        const data = await PaymentMedadataModel.findOne({
            where: {
                id
            }
        })
        return data?.toJSON()
    },

    async delete(id: string){
        await PaymentMedadataModel.destroy({
            where: {
                id
            }
        })
    },

    async get_by_session_id( session_id: string  ){
        const result = await PaymentMedadataModel.findOne({
            where: Sequelize.where(
                Sequelize.literal(`"data"->>'session_id'`),
              session_id
            ),
        });
        return result?.toJSON();
    }
}

