import { Module, forwardRef } from '@nestjs/common';
import { ElectionController } from './election.controller';
import { AuthModule } from '@modules/core/auth';
import { UserModule } from '@modules/user';
import { ElectionRepository } from './election.repo';
import { ElectionService } from './election.service';
import { ElectionPostModelProvider } from './models/election-post.model';
import { ElectionModelProvider } from './models/election.model';
import {
  AccreditationFormModelProvider,
  AccreditationFormQuestionProvider,
} from './models/accreditation-form';
import { CandidateModelProvider } from './models/candidate';
import { VotersModelProvider } from './models/voter.model';
import { StorageModule } from '@modules/core/storage';
import { StorageService } from '@modules/core/storage/storage.service';
import { JobModule } from '@modules/core/job';
import { JobRepository } from '@modules/core/job/job.repo';
import {
  VoterAuthEmailQueue,
  VotersPopulationQueueModule,
  VoteQueue,
  AccreditationFormQueue,
  LogQueue,
  ExportResultQueue,
  VotersAuthEmailBatchQueue
} from 'src/queue/config';
import { JobModelProvider } from '@modules/core/job/job.model';
import { BillingModule } from '@modules/billing';
import { BillingRepository } from '@modules/billing/billing.repo';
import { ElectionAuthInterceptor } from 'src/interceptors/election';
import { VotersRepository } from './voters/repo';
import { VotersService } from './voters/service';
import { VoterController } from './voters/cotroller';
import { VoteModelProvider, VoteProfileModel, VoteProfileModelProvider } from './models/vote';
import { EmailServiceModule } from '@modules/core/email';
import { EmailService } from '@modules/core/email/email.service';

@Module({
  imports: [
    UserModule,
    AuthModule,
    StorageModule,
    JobModule,
    VotersPopulationQueueModule,
    VoterAuthEmailQueue,
    AccreditationFormQueue,
    ExportResultQueue,
    VoteQueue,
    LogQueue,
    EmailServiceModule,
    VotersAuthEmailBatchQueue,
    forwardRef(() => BillingModule),
  ],
  controllers: [ElectionController, VoterController],
  providers: [
    ElectionRepository,
    ElectionService,
    ElectionPostModelProvider,
    ElectionModelProvider,
    CandidateModelProvider,
    AccreditationFormModelProvider,
    AccreditationFormQuestionProvider,
    VotersModelProvider,
    StorageService,
    JobRepository, 
    JobModelProvider,
    BillingRepository,
    VotersRepository,
    VotersService,
    VoteProfileModelProvider,
    VoteModelProvider,
    // EmailService
  ],
  exports: [
    ElectionRepository,
    ElectionModelProvider,
    ElectionPostModelProvider,
    CandidateModelProvider,
    AccreditationFormModelProvider,
    AccreditationFormModelProvider,
    AccreditationFormQuestionProvider,
    VotersModelProvider,
    ElectionService,
    VotersRepository,
    VotersService
  ],
})
export class ElectionModule {}
