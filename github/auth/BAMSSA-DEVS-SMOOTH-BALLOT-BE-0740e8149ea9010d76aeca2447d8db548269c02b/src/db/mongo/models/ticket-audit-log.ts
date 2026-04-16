import mongoose from "mongoose";

export const TicketPurchaseAuditLogSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    payload: {
        type: Object,
        required: true
    }
}, {timestamps: true})

const TicketPurchaseLog = mongoose.model(
    'TicketPurchase',
    TicketPurchaseAuditLogSchema
)

export default TicketPurchaseLog