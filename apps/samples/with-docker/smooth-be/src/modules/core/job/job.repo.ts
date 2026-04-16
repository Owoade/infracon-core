import { Inject, Injectable } from "@nestjs/common";
import { InferedSchemaType } from "@utils/schema";
import { JobModelInterface } from "./type";
import { JOB_MODEL_PROVIDER } from "./job.model";
import { Transaction } from "sequelize";

@Injectable()
export class JobRepository {

    constructor(
        @Inject(JOB_MODEL_PROVIDER)
        private JobModel: InferedSchemaType<JobModelInterface>
    ){}

    async create( payload: JobModelInterface ){

        payload.status = "pending";

        const new_job = await this.JobModel.create( payload );

        return new_job.toJSON();

    }

    async update_job( id: number, update: Partial<JobModelInterface> ){

        const updated_job = await this.JobModel.update(update, { where: { id }, returning: true });

        console.log(updated_job)

        return updated_job?.[1]?.[0];

    }

    async get_most_recent_job( filter: Partial<JobModelInterface> ){

        const job = await this.JobModel.findOne({
            where: filter,
            order: [["createdAt", "DESC"]]
        });
        
        return job?.toJSON();

    }

    async delete_all_jobs( filter: Pick<JobModelInterface, "Userid" | "_election_id">, transaction: Transaction ){

        await this.JobModel.destroy({
            where: filter,
            transaction
        })
        
    }

}