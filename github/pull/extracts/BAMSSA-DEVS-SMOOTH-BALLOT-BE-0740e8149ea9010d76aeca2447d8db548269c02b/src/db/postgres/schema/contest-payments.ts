import schema_type from "@utils/schema";

export const ContestPaymentSchema = {

    id: schema_type.primary_key(),

    name: schema_type.string(),

    email: schema_type.string(),

    ContestId: schema_type.int(),

    amount_paid: schema_type.string(),

    session_id: schema_type.string(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_PAYMENT_TABLE_NAME = "ContestPayments";