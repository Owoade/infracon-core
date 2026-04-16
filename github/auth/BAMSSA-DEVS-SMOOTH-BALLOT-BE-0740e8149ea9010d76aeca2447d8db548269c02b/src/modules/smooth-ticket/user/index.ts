import { Module } from "@nestjs/common";
import { SmoothTicketUserController } from "./controller";
import { SmoothTicketUserModelProvider } from "./model";
import { SmoothTicketUserRepository } from "./repo";
import { EmailService } from "@modules/core/email/email.service";
import { SmoothTicketUserService } from "./service";
import { EmailServiceModule } from "@modules/core/email";

@Module({
    imports: [EmailServiceModule],
    controllers: [SmoothTicketUserController],
    providers: [SmoothTicketUserModelProvider, SmoothTicketUserRepository, EmailService, SmoothTicketUserService],
    exports: [SmoothTicketUserRepository, SmoothTicketUserModelProvider, SmoothTicketUserService],
})
export class SmoothTIcketUserModule {}