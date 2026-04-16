import schema_type from "@utils/schema";

export const PaymentMetadataSchema = {
    id: schema_type.primary_key_uuid(),
    type: schema_type.string(),
    data: schema_type.jsonb(),
    createdAt: schema_type.date(),
    updatedAt: schema_type.date()
}