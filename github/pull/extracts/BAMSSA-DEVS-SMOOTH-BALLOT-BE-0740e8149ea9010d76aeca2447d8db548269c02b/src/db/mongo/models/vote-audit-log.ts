import { VoteAuditLogModelInterface } from "@modules/election/type";
import * as mongoose from "mongoose";

const VoteAuditLogSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    payload: {
        type: Object,
        required: true
    },
    ElectionId: {
        type: Number,
        required: true
    }
}, { timestamps: true });

const VoteAuditLog = mongoose.model('VoteAuditLog', VoteAuditLogSchema) as mongoose.Model<VoteAuditLogModelInterface>;

export default VoteAuditLog;