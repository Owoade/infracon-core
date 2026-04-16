import { StorageModule } from '@modules/core/storage';
import { forwardRef, Module } from '@nestjs/common';
import { ContestService } from './service';
import { ContestRepository } from './repo';
import {
  ContestantModelProvider,
  ContestFinancialRecordModelProvider,
  ContestModelProvider,
  ContestOrganizerProfileModelProvider,
  ContestPaymentModelProvider,
  ContestPayoutModelProvider,
  ContestVoteModelProvider,
  ContestVoteRefundModelProvider,
  ContestVoterModelProvider,
} from './model';
import { ContestController } from './controller';
import { AuthModule } from '@modules/core/auth';
import { UserModule } from '@modules/user';
import { PaymentModule } from '@modules/core/payment/index.';
import { PaymentSercvice } from '@modules/core/payment/payment.service';
import { ContestReportGenerationQueue, ContestRevenueTransferQueue, ContestVoteQueue } from '@queue/config';
import { WalletModule } from '@modules/wallet';
import { EmailServiceModule } from '@modules/core/email';
import { JobModule } from '@modules/core/job';

@Module({
  imports: [
    StorageModule,
    AuthModule,
    forwardRef(() => UserModule),
    forwardRef(() => PaymentModule),
    ContestVoteQueue,
    forwardRef(() => WalletModule),
    EmailServiceModule,
    ContestRevenueTransferQueue,
    forwardRef(()=>UserModule),
    ContestReportGenerationQueue,
    JobModule
  ],
  providers: [
    ContestService,
    ContestRepository,
    ContestModelProvider,
    ContestantModelProvider,
    ContestModelProvider,
    PaymentSercvice,
    ContestOrganizerProfileModelProvider,
    ContestFinancialRecordModelProvider,
    ContestVoterModelProvider,
    ContestVoteModelProvider,
    ContestPaymentModelProvider,
    ContestVoteRefundModelProvider,
    ContestPayoutModelProvider
  ],
  controllers: [ContestController],
  exports: [ContestService, ContestRepository],
})
export class ContestModule {}
