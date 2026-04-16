import { Module } from "@nestjs/common";
import { EmailServiceProvider, SecondEmailServiceProvider } from "./config";
import { EmailService } from "./email.service";
import { LogQueue } from "src/queue/config";

@Module({
    providers: [EmailServiceProvider, SecondEmailServiceProvider, EmailService],
    exports: [EmailService]
})
export class EmailServiceModule {}