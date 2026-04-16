import db from "@db/postgres/index";
import { JOB_TABLE_NAME, JobSchema } from "@db/postgres/schema/job";

export const JobModel = db.define(JOB_TABLE_NAME, JobSchema, { timestamps: true });

export const JOB_MODEL_PROVIDER = "Jobs";

export const JobModelProvider = {
    provide: JOB_MODEL_PROVIDER,
    useValue: JobModel
}