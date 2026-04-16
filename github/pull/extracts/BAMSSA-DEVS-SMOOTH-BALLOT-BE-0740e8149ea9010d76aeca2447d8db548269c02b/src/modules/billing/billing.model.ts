import db from "@db/postgres/index";
import { BILLING_TABLE_NAME, BillingSchema } from "@db/postgres/schema/billing";

export const BillingModel = db.define(BILLING_TABLE_NAME, BillingSchema, { timestamps: true });

export const BILLING_MODEL_PROVIDER = "BILLING_MODEL";

export const BillingModelProvider  = {
    provide: BILLING_MODEL_PROVIDER,
    useValue: BillingModel
}