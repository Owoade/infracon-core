
import { Processor, Process } from "@nestjs/bull";
import { Job } from "bullmq";
import { VOTERS_POPULATION_QUEUE } from "src/queue/config";
import * as papa from "papaparse";
import * as request from "request";
import * as crypto from "crypto";
import { JobRepository } from "@modules/core/job/job.repo";
import { VoterModelInterface } from "@modules/election/type";
import { StorageService } from "@modules/core/storage/storage.service";
import { Logger } from "@nestjs/common";
import { ElectionRepository } from "@modules/election/election.repo";
import { BillingRepository } from "@modules/billing/billing.repo";
import { ElectionService } from "@modules/election/election.service";
import { VotersRepository } from "@modules/election/voters/repo";
import { VotersService } from "@modules/election/voters/service";
import { redis_client } from "@cache/index";
import * as csv from "csvtojson";

@Processor(VOTERS_POPULATION_QUEUE)
export class VotersPopulationWorker {

    private logger = new Logger(VotersPopulationWorker.name);

    constructor(
        private storage_service: StorageService,
        private election_repository: ElectionRepository,
        private job_repository: JobRepository,
        private billing_repository: BillingRepository,
        private election_service: ElectionService,
        private voters_repo: VotersRepository,
        private voters_service: VotersService
    ) { 
        this.logger.debug("Voter population worker logged")
    }

    @Process()
    async new_process( job: Job<VoterPopulationOperationPayload> ){

        const start_time = Date.now();

        let header = null;
        let email_index = null;
        let buffer = [];
        let repeating_values = {} as any;

        let voters_count = 0;

        csv().fromStream(request.get(job.data.csv_url) as any)
        .subscribe( async ( json )=>{

            this.logger.debug(`Buffer length: ${buffer.length}`);
            
            if (header === null) {

                header = Object.keys(json).map((_: string) => _.replace(/[\n\r\t\f\b\\'"]/g, ''));

                console.log( {header} )
                email_index = this.get_email_index(header);

                repeating_values = this.create_repeating_field_hash( header );

                if (email_index === -1) {
                    await this.job_repository.update_job(job.data.job_id, { status: "failed", cancellation_reason: "Email field not present in csv" });
                    return;
                }

            }

            const voter = await this.create_voter_object( header, Object.values(json), email_index, job.data.user_id, job.data.election_id, job.data.job_id, repeating_values );

            buffer.push(voter);

            console.log(buffer);

            voters_count += 1;

            if (buffer.length === 5) {

                const buffer_copy = buffer.slice();

                buffer = [];

                this.logger.debug(`Inserting ${buffer_copy.length} voters into database`);

                await Promise.all([
                    this.voters_repo.bulk_insert_voters(buffer_copy),
                    this.save_repeating_values_redis(repeating_values, job.data.election_id )
                ])
    
            }

        }, 
        async (e) => await this.error_callback(e, job),
        async ()=> await this.success_callback(job, email_index, voters_count, buffer, header, start_time))
        



    }

    async success_callback( job: Job<VoterPopulationOperationPayload>, email_index: number, voters_count: number, buffer: any[], header: string[], start_time: number ){

        this.logger.log("CSV parsing ended");

                const election_billing = await this.billing_repository.get_last_billing({ ElectionId: job.data.election_id, UserId: job.data.user_id })

                const CSV_VOTERS_EXCEEDS_VOTERS_IN_BILL = election_billing.no_of_voters < voters_count; 

                if( CSV_VOTERS_EXCEEDS_VOTERS_IN_BILL ){

                    await this.rollback_voters_population_process({
                        cancellation_reason: `Number of voters in CSV file exceeds number of voters in election bill. Voters in CSV: ${voters_count} Voters in election bill: ${election_billing.no_of_voters}`,
                        election_id: job.data.election_id,
                        file_id: job.data.file_id,
                        job_id: job.data.job_id,
                        user_id: job.data.user_id
                    })

                    return;

                }

                if (buffer.length > 0) {
                    this.logger.debug(`Inserting remaining ${buffer.length} voters into database`);
                    await this.voters_repo.bulk_insert_voters(buffer);
                }

                // await transaction.commit();
                delete header[email_index]

                this.logger.log(`Job ${job.id} completed in ${(Date.now() - start_time) / 1000} seconds`);

                await Promise.all([

                    this.job_repository.update_job(job.data.job_id, { status: "done" }),

                    this.save_repeating_fields_to_db(header, job.data.election_id, voters_count)

                ])

                await this.remove_repeating_fields_from_redis( header, job.data.election_id );

    }

    async error_callback( error: any, job: Job<VoterPopulationOperationPayload> ){

        this.logger.error(`Stream error: ${error.message}`);

        await this.rollback_voters_population_process({
            cancellation_reason: "Something went wrong",
            election_id: job.data.election_id,
            file_id: job.data.file_id,
            job_id: job.data.job_id,
            user_id: job.data.user_id
        })

    }

    // async process(job: Job<VoterPopulationOperationPayload>) {

    //     this.logger.log(`Starting job ${job.id} processing`);

    //     const start_time = Date.now();

    //     try {

    //         const parseStream = papa.parse(papa.NODE_STREAM_INPUT);
    //         const dataStream = request.get(job.data.csv_url).pipe(parseStream);;

    //         let header = null;
    //         let email_index = null;
    //         let buffer = [];
    //         let repeating_values = {} as any;

    //         let voters_count = 0;

    //         parseStream.on("data", async (chunk) => {

    //             this.logger.debug(`Buffer length: ${buffer.length}`);
    //             this.logger.debug(`Chunk received: ${chunk}`);

    //             if (header === null) {

    //                 header = chunk.map((_: string) => _.replace(/[\n\r\t\f\b\\'"]/g, ''));

    //                 console.log( {header} )
    //                 email_index = this.get_email_index(header);

    //                 repeating_values = this.create_repeating_field_hash( header );

    //                 if (email_index === -1) {
    //                     await this.job_repository.update_job(job.data.job_id, { status: "failed", cancellation_reason: "Email field not present in csv" });
    //                     dataStream.unpipe(parseStream);
    //                     dataStream.emit("close");
    //                     return;
    //                 }

    //                 return;
    //             }

    //             const voter = await this.create_voter_object(header, chunk, email_index, job.data.user_id, job.data.election_id, job.data.job_id, repeating_values);

    //             console.log( voter )
                
    //             buffer.push(voter);

    //             console.log(buffer);

    //             voters_count += 1;

    //             if (buffer.length === 5) {

    //                 const buffer_copy = buffer.slice();

    //                 buffer = [];

    //                 this.logger.debug(`Inserting ${buffer_copy.length} voters into database`);

    //                 await Promise.all([
    //                     this.voters_repo.bulk_insert_voters(buffer_copy),
    //                     this.save_repeating_values_redis(repeating_values, job.data.election_id )
    //                 ])
        
    //             }

    //         });

    //         parseStream.on('finish', ()=>{
    //             this.logger.debug("Finish event")
    //             console.log( buffer )
    //         })

    //         parseStream.on("end", async () => {

    //             this.logger.log("CSV parsing ended");

    //             const election_billing = await this.billing_repository.get_last_billing({ ElectionId: job.data.election_id, UserId: job.data.user_id })

    //             const CSV_VOTERS_EXCEEDS_VOTERS_IN_BILL = election_billing.no_of_voters < voters_count; 

    //             if( CSV_VOTERS_EXCEEDS_VOTERS_IN_BILL ){

    //                 await this.rollback_voters_population_process({
    //                     cancellation_reason: `Number of voters in CSV file exceeds number of voters in election bill. Voters in CSV: ${voters_count} Voters in election bill: ${election_billing.no_of_voters}`,
    //                     election_id: job.data.election_id,
    //                     file_id: job.data.file_id,
    //                     job_id: job.data.job_id,
    //                     user_id: job.data.user_id
    //                 })

    //                 return;

    //             }

    //             if (buffer.length > 0) {
    //                 this.logger.debug(`Inserting remaining ${buffer.length} voters into database`);
    //                 await this.voters_repo.bulk_insert_voters(buffer);
    //             }

    //             // await transaction.commit();
    //             delete header[email_index]

    //             this.logger.log(`Job ${job.id} completed in ${(Date.now() - start_time) / 1000} seconds`);

    //             await Promise.all([

    //                 this.job_repository.update_job(job.data.job_id, { status: "done" }),

    //                 this.save_repeating_fields_to_db(header, job.data.election_id, voters_count)

    //             ])

    //             await this.remove_repeating_fields_from_redis( header, job.data.election_id );

    //         });

    //         dataStream.on('error', async (error) => {

    //             this.logger.error(`Stream error: ${error.message}`);

    //             await this.rollback_voters_population_process({
    //                 cancellation_reason: "Something went wrong",
    //                 election_id: job.data.election_id,
    //                 file_id: job.data.file_id,
    //                 job_id: job.data.job_id,
    //                 user_id: job.data.user_id
    //             })
                
    //         });

    //     } catch (error) {

    //         this.logger.error(`Processing error: ${error.message}`);

    //         await this.rollback_voters_population_process({
    //             cancellation_reason: "Something went wrong",
    //             election_id: job.data.election_id,
    //             file_id: job.data.file_id,
    //             job_id: job.data.job_id,
    //             user_id: job.data.user_id
    //         })
            
    //     }
    // }

    private get_email_index(header: string[]) {
        const index = header.findIndex(field => ["email", "e-mail", "Email", "E-mail", "EMAIL", "E-MAIL"].includes(field));
        return index;
    }

    private async create_voter_object(headers: string[], data: string[], email_index: number, user_id: number, election_id: number, job_id: number, repeating_values: any ){

        const other_attributes = headers.filter((_, i) => i !== email_index);

        const other_data = data.filter((_, i) => i !== email_index);

        const unwanted_values = [ undefined, null, '', ]

        let object: any = {};

        for (let index in other_attributes) {

            object[other_attributes[index]] = other_data[index];

            const data_to_be_pushed = !unwanted_values.includes(other_data[index]) ? other_data[index] : Date.now().toString();

            repeating_values[other_attributes[index]].push(data_to_be_pushed);

        }

        const email = data[email_index].toLowerCase() ?? 'invalid@email.com';

        const previous_email_sent_count = await this.voters_service.get_voter_email_sent_count_from_redis( email, election_id );

        return {
            email,
            // password: this.voters_service.encrypt_voters_password("12345678"),
            password: this.voters_service.encrypt_voters_password(crypto.randomInt(199999, 999999).toString()),
            UserId: user_id,
            data: object,
            is_suspended: false,
            ElectionId: election_id,
            _job_id: job_id,
            email_sent: previous_email_sent_count
        };

    }

    private async save_repeating_values_redis( repeating_values: any, election_id: number ){

        console.log( repeating_values )

        const pairs = Object.entries(repeating_values);

        for( let [key, value] of pairs ){

            if( !value ) continue;

            try {
                await redis_client.sadd(`${key}-${election_id}`, value as any[]);
            }
            catch(e){
                console.log({
                    key,
                    value,
                    election_id
                })
                console.error(e)
                continue;
            }

        }

    }

    async save_repeating_fields_to_db( headers: string[], election_id: number, total_voters: number ){

        let hash = {} as any;

        for( let key of headers ){

            const cardinality = await redis_client.scard(`${key}-${election_id}`);

            hash[key] = cardinality;

        }

        const fifty_percent_of_total_voters = Math.round(0.5 * total_voters);

        const pairs = Object.entries(hash);

        console.log( pairs )

        const repeating_fields = pairs.filter( (_: any) => _[1] <= fifty_percent_of_total_voters && _[1] !== 0 ).map( _ => _[0] ).filter(Boolean)

        console.log({
            repeating_fields: pairs.filter( (_: any) => _[1] <= fifty_percent_of_total_voters && _[1] !== 0 ).map( _ => _[0] ),
            fifty_percent_of_total_voters
        })

        if( repeating_fields.length !== 0 ) 
            await this.election_repository.update_election({indexed_voters_attributes: repeating_fields }, { id: election_id })
        
    }

    private async rollback_voters_population_process( payload: RollbackVotersPopulationProcess ){

        const { job_id, file_id, election_id, cancellation_reason } = payload;

        const [_, __, ___, updated_election] = await Promise.all([
            this.storage_service.delete_file(file_id),
            this.job_repository.update_job(job_id, { status: "failed", cancellation_reason }),
            this.voters_repo.delete_voter({ _job_id: job_id }),
            this.election_repository.update_election({ voters_acquisition_channel: null, csv_file: null }, { id: election_id })
        ])

        await this.election_service.save_election_in_cache(payload.election_id, payload.user_id, updated_election.toJSON());
        
    }

    private async remove_repeating_fields_from_redis( fields: string[], election_id: number ){

        await Promise.all(
            fields.map( _ => redis_client.del(`${_}-${election_id}`))
        )

    }



    private create_repeating_field_hash( headers: string[] ){

        let hash = {} as any;

        for( let key of headers ){
             hash[key] = [];
        }

        return hash;

    }
}

export interface VoterPopulationOperationPayload {
    job_id: number;
    file_id: string;
    election_id: number;
    csv_url: string;
    user_id: number;
    csv_id: string;
}

interface RollbackVotersPopulationProcess {
    file_id: string;
    cancellation_reason: string;
    job_id: number;
    election_id: number;
    user_id: number;
}
