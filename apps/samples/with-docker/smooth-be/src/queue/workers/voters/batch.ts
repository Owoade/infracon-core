import { VotersService } from "@modules/election/voters/service";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { VOTERS_AUTH_EMAIL_BATCH_QUEUE } from "@queue/config";
import { Job } from "bull";

@Processor(VOTERS_AUTH_EMAIL_BATCH_QUEUE)
export class VoterAuthEmailBatchWorker {

    private logger = new Logger(VoterAuthEmailBatchWorker.name);

    constructor(
        private voter_service: VotersService
    ){
        this.logger.debug("VOTERS_AUTH_EMAIL_BATCH_QUEUE WORKER INIT")
    }

    @Process()
    async process( job: Job<VoterAuthEmailBatchOperationPayload> ){

        await this.voter_service.send_batched_voters_credentials(
            job.data.election_id,
            job.data.batch_no,
            job.data.job_id
        )

    }

}

export interface VoterAuthEmailBatchOperationPayload {
    election_id: number,
    batch_no: number,
    job_id: string
}