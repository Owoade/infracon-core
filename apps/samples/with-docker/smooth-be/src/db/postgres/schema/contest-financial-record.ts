import schema_type from "@utils/schema";

export const ContestFinancialRecordSchema = {

    id: schema_type.primary_key(),

    total_income: schema_type.decimal(10,2),

    amount_due_for_payout: schema_type.decimal(10,2),

    total_votes: schema_type.int(),

    UserId: schema_type.int(),

    ContestId: schema_type.int(),

    createdAt: schema_type.date(),

    updatedAt: schema_type.date()

}

export const CONTEST_FINANCIAL_RECORD_TABLE_NAME = "ContestFinancialRecords";