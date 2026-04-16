import { ContestService } from "@modules/contest/service";
import { ContestVoteModelInterface, ProcessContestRevenueTransfer } from "@modules/contest/type";
import { Process, Processor } from "@nestjs/bull";
import { CONTEST_REVENUE_TRANSFER_QUEUE } from "@queue/config";
import { Job } from "bull";

@Processor(CONTEST_REVENUE_TRANSFER_QUEUE)
export default class ContestRevenueTransferWorker {

    constructor(
        private contest_service: ContestService
    ){}

    @Process()
    async process( job: Job<ProcessContestRevenueTransfer> ){

        await this.contest_service.process_contest_revenue_transfer(job.data)

    }

}