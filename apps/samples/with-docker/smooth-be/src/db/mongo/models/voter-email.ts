import mongoose from "mongoose";

const VotersAuthEmailJobSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    payload:{
        type: Object,
        required: true
    },
    election_id: {
        type: Number,
        required: true
    },
    voter_id: {
        type: Number,
        required: true
    }
})

const VotersAuthEmailJob = mongoose.model("VotersAuthEmailJob", VotersAuthEmailJobSchema);

export default VotersAuthEmailJob;