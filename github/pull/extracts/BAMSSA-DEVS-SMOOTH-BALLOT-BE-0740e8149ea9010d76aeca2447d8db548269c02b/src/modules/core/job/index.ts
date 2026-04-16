import { Module } from "@nestjs/common";
import { JobRepository } from "./job.repo";
import { JobModelProvider } from "./job.model";

@Module({
    exports: [JobRepository],
    providers: [JobModelProvider, JobRepository]
})
export class JobModule{}