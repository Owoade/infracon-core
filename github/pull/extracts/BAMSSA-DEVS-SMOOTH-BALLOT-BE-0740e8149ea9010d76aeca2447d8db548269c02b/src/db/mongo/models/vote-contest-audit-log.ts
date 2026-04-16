import { ProcessContestVote } from "@modules/contest/type";
import * as mongoose from "mongoose";

const VoteContestAuditLogSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },

    slug: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    votes: {
        type: Number,
        required: true
    },
    ContestantId: {
        type: Number,
        required: true
    },
    contest_id: {
        type: Number,
        required: true
    },
    session_id: {
        type: String,
        required: true
    },

    rate: {
        type: Number,
        required: true
    },

    amount_paid: {
        type: Number,
        required: true
    },

    UserId: {
        type: Number,
        required: true
    },

    ContestId: {
        type: Number,
        required: true
    }

}, { timestamps: true })

const VoteContestAuditLog = mongoose.model("VoteContestAuditLog", VoteContestAuditLogSchema ) as mongoose.Model<ProcessContestVote>;

export default VoteContestAuditLog
