import { forwardRef, Module } from "@nestjs/common";
import { ElectionManagementController } from "./controllers/election";
import { PlatformManagementController } from "./controllers/platform";
import { UserSessionController } from "./controllers/user-session";
import { UserManagementController } from "./controllers/user";
import { ElectionModule } from "@modules/election";
import { BillingModule } from "@modules/billing";
import { UserModule } from "@modules/user";
import { UserRepository } from "@modules/user/user.repo";
import { BillingRepository } from "@modules/billing/billing.repo";
import { BillingService } from "@modules/billing/billing.service";
import { PlatformModule } from "@modules/platform";
import { PlatformRepository } from "@modules/platform/repo";
import { WalletModule } from "@modules/wallet";
import { LogQueue } from "src/queue/config";
import { EmailServiceModule } from "@modules/core/email";
import { SuperAdminService } from "./service";
import { SuperAdminController } from "./controllers";
import { AuthModule } from "@modules/core/auth";
import { ClientsModule, Transport } from "@nestjs/microservices";
import * as path from "path";
import { PlatformService } from "@modules/platform/service";
import { VotersService } from "@modules/election/voters/service";
import { ContestManagementController } from "./controllers/contest";
import { ContestModule } from "@modules/contest";



@Module({
    imports: [
      ElectionModule, 
      AuthModule, 
      BillingModule, 
      UserModule, 
      PlatformModule, 
      WalletModule, 
      LogQueue, 
      EmailServiceModule,
      ContestModule,
      ClientsModule.register([
        {
          name: 'LOG_SERVICE',
          transport: Transport.GRPC,
          options: {
            package: 'logs',
            protoPath: path.join(__dirname, 'protos/logs.proto'),
            url: 'localhost:50051',
          },
        },
      ]), 

    ],
    controllers: [ElectionManagementController, PlatformManagementController, UserSessionController, UserManagementController, SuperAdminController, ContestManagementController],
    providers: [ UserRepository, BillingRepository, BillingService, SuperAdminService, PlatformService ],
})

export class SuperAdminModule {}