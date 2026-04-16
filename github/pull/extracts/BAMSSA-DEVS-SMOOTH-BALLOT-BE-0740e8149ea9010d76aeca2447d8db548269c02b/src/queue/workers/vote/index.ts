import { CastVote, ProcessVote } from "@modules/election/type";
import { VotersService } from "@modules/election/voters/service";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { VOTE_QUEUE } from "src/queue/config";

@Processor(VOTE_QUEUE)
export class VoteWorker {

    private logger = new Logger( VoteWorker.name )

    constructor(
        private voter_service: VotersService
    ){
        this.logger.debug("Vote worker initialized")
    }

    @Process()
    async process( job: Job<ProcessVote> ){

        this.logger.debug("Processing job")
        this.logger.debug({message:"Queue Worker method"})

        return await this.voter_service.process_vote( job.data );

    }

}