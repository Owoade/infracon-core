import { redis_client } from "@cache/index";
import { ElectionRepository } from "@modules/election/election.repo";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { ACCREDITATION_FORM_QUEUE } from "src/queue/config";

@Processor(ACCREDITATION_FORM_QUEUE)
export class AccreditationFormWorker {

    private logger = new Logger(AccreditationFormWorker.name);

    constructor(
        private election_repo: ElectionRepository
    ){
        this.logger.debug("ACCREDITATION_FORM_QUEUE WORKER INIT")
    }

    @Process()
    async process( job: Job<AnalyzeVotersCreatedFromAccreditationForm> ){

        this.logger.log(`Starting job ${job.id} processing`);

        const { labels, voters_count, election_id } = job.data;

        const indexed_field = [];

        const fifty_percent_of_total_voters = Math.round(0.5 * voters_count);

        for( let label of labels ){

            const cardinality = await redis_client.scard(`${label}-${election_id}`);

            if( cardinality <= fifty_percent_of_total_voters )
                indexed_field.push( label );

        }

        if( indexed_field.length > 0 )
            await this.election_repo.update_election({ indexed_voters_attributes: indexed_field }, { id: election_id });

    }
}

export interface AnalyzeVotersCreatedFromAccreditationForm{
    labels: string[],
    election_id: number;
    voters_count: number;
}