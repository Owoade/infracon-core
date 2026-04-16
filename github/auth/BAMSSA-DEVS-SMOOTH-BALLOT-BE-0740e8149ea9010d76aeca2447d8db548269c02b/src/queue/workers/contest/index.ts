import { ContestService } from "@modules/contest/service";
import { ProcessContestVote } from "@modules/contest/type";
import { Process, Processor } from "@nestjs/bull";
import { CONTEST_VOTE_QUEUE } from "@queue/config";
import { Job } from "bull";

@Processor(CONTEST_VOTE_QUEUE)
export default class ContestVoteWorker {
    
    constructor(
        private contest_service: ContestService
    ){}

    @Process()
    async process( job: Job<ProcessContestVote> ){

        console.log("Called worker method")

        await this.contest_service.process_contest_vote( job.data );

    }
}