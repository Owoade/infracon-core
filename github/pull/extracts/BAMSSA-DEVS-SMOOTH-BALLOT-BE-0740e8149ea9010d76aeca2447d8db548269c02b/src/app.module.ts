import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from '@modules/user';
import { AuthModule } from '@modules/core/auth';
import { EmailServiceModule } from '@modules/core/email';
import { ElectionModule } from '@modules/election';
import { StorageModule } from '@modules/core/storage';
import { ContestReportGenerationQueue, ContestRevenueTransferQueue, ExportResultQueue, LogQueue, QueueModule, SmoothTicketPurchaseQueue, VoterAuthEmailQueue, VotersAuthEmailBatchQueue, VotersPopulationQueueModule } from './queue/config';
import { JobModule } from '@modules/core/job';
import { VotersPopulationWorker } from './queue/workers/voters';
import { VoterAuthEmailWorker } from './queue/workers/voters/email';
import { BillingModule } from '@modules/billing';
import { WalletModule } from '@modules/wallet';
import { PaymentModule } from '@modules/core/payment/index.';
import { ScheduleModule } from '@nestjs/schedule';
import { VoteWorker } from './queue/workers/vote';
import { PlatformModule } from '@modules/platform';
import { SuperAdminModule } from '@modules/super-admin';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as path from 'path';
import { ExportResultWorker } from './queue/workers/results';
import { AccreditationFormWorker } from './queue/workers/accreditation_form';
import { ContestModule } from '@modules/contest';
import ContestVoteWorker from '@queue/workers/contest';
import { VoterAuthEmailBatchWorker } from '@queue/workers/voters/batch';
import ContestRevenueTransferWorker from '@queue/workers/contest/transfer';
import ContestRevenueReportWorker from '@queue/workers/contest/report';
import { SmoothTIcketUserModule } from '@modules/smooth-ticket/user';
import { SmoothTicketEventModule } from '@modules/smooth-ticket/event';
import { SmoothTicketPurchaseWorker } from '@queue/workers/smooth-ticket/purchase';

@Module({
  imports: [
    UserModule,
    AuthModule,
    ElectionModule,
    StorageModule,
    QueueModule,
    VotersPopulationQueueModule,
    JobModule,
    VoterAuthEmailQueue,
    LogQueue,
    ExportResultQueue,
    EmailServiceModule,
    BillingModule,
    WalletModule,
    PaymentModule,
    PlatformModule,
    ScheduleModule.forRoot(),
    SuperAdminModule,
    ContestModule,
    VotersAuthEmailBatchQueue,
    ContestRevenueTransferQueue,
    ContestReportGenerationQueue,
    SmoothTIcketUserModule,
    SmoothTicketEventModule,
    SmoothTicketPurchaseQueue
  ],
  controllers: [AppController],
  providers: [AppService, VotersPopulationWorker, VoterAuthEmailWorker, VoteWorker, ExportResultWorker, AccreditationFormWorker, ContestVoteWorker, VoterAuthEmailBatchWorker, ContestRevenueTransferWorker, ContestRevenueReportWorker, SmoothTicketPurchaseWorker],
})
export class AppModule {}
