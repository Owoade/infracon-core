import { EmailService } from "@modules/core/email/email.service";
import { voter_auth_template, VoterAuthpayload } from "@modules/core/email/template/voters-auth";
import { JobRepository } from "@modules/core/job/job.repo";
import { VotersRepository } from "@modules/election/voters/repo";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import axios from "axios";
import { Job } from "bull";
import { VOTERS_AUTH_EMAIL_QUEUE } from "src/queue/config";

@Processor(VOTERS_AUTH_EMAIL_QUEUE)
export class VoterAuthEmailWorker {

    private logger = new Logger(VoterAuthEmailWorker.name);

    constructor(
        private voters_repo: VotersRepository,
        private email_service: EmailService
    ){
        this.logger.debug("Voting worker initialized")
    }

    @Process()
    async process( job: Job<VoterAuthEmailOperationPayload> ){

        this.logger.log(`Starting job ${job.id} processing`);

        const { payload, job_id } = job.data;

        await this.email_service.send_voters_auth(payload);

        await this.voters_repo.delete_voters_auth_email_job(job_id);

        this.logger.log(`Sent id: ${job.data.payload.id} email: ${job.data.payload.email}`)


    }
    
}

export interface VoterAuthEmailOperationPayload {
    election_id: number;
    job_id?: string;
    payload: VoterAuthpayload
}