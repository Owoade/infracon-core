import mongoose from "mongoose";

const VoterAuthEmailBatchJobSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    election_id: {
        type: Number,
        required: true
    },
    batch_no: {
        type: Number,
        required: true
    }
})

const VoterAuthEmailBatchJob = mongoose.model("VoterAuthEmailBatchJob", VoterAuthEmailBatchJobSchema);

export default VoterAuthEmailBatchJob;