import { UserRepository } from "@modules/user/user.repo";
import { Module, forwardRef } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import RedisProvider from "@cache/index";
import { EmailServiceModule } from "../email";
import { AuthenticationService } from "./auth.service";
import { UserModule } from "@modules/user";
import { LogQueue } from "src/queue/config";

@Module({
    imports: [forwardRef(() => UserModule), EmailServiceModule, LogQueue],
    providers: [RedisProvider, UserRepository,AuthenticationService],
    exports: [AuthenticationService]
})
export class AuthModule{}