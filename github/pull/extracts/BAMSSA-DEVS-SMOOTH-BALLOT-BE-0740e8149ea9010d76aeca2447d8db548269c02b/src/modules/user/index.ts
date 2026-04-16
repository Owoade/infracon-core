import { Module, forwardRef } from "@nestjs/common";
import { UserController } from "./user.controller";
import { USER_MODEL_PROVIDER, UserModelProvider } from "./user.model";
import { UserRepository } from "./user.repo";
import { UserService } from "./user.service";
import { AuthModule } from "@modules/core/auth";
import { AuthenticationService } from "@modules/core/auth/auth.service";
import { EmailServiceModule } from "@modules/core/email";
import RedisProvider, { REDIS_PROVIDER } from "@cache/index";
import { EMAIL_SERVICE_PROVIDER, EmailServiceProvider } from "@modules/core/email/config";
import { PaymentModule } from "@modules/core/payment/index.";
import { WalletModule } from "@modules/wallet";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { WalletRepository } from "@modules/wallet/wallet.repo";
import { LogQueue } from "src/queue/config";

@Module({
    imports: [ forwardRef(() => AuthModule), EmailServiceModule, WalletModule, LogQueue],
    controllers: [UserController],
    providers: [UserModelProvider, UserService, AuthenticationService, RedisProvider, EmailServiceProvider, PaymentSercvice, WalletRepository, UserRepository],
    exports: [UserRepository, UserService, REDIS_PROVIDER, EMAIL_SERVICE_PROVIDER, USER_MODEL_PROVIDER]
})
export class UserModule {}