import { Module, forwardRef } from '@nestjs/common';
import { BillingConroller } from './billing.controller';
import { BillingModelProvider } from './billing.model';
import { BillingRepository } from './billing.repo';
import { BillingService } from './billing.service';
import { WalletModule } from '@modules/wallet';
import { WalletRepository } from '@modules/wallet/wallet.repo';
import { UserModule } from '@modules/user';
import { UserRepository } from '@modules/user/user.repo';
import { UserModelProvider } from '@modules/user/user.model';
import { AuthModule } from '@modules/core/auth';
import { AuthenticationService } from '@modules/core/auth/auth.service';
import { EmailServiceProvider } from '@modules/core/email/config';
import RedisProvider from '@cache/index';
import { EmailServiceModule } from '@modules/core/email';
import { EmailService } from '@modules/core/email/email.service';
import { ElectionModule } from '@modules/election';
import { ElectionRepository } from '@modules/election/election.repo';
import { PlatformModule } from '@modules/platform';
import { LogQueue } from 'src/queue/config';
import { PlatformRepository } from '@modules/platform/repo';

@Module({
  controllers: [BillingConroller],
  imports: [ WalletModule, UserModule, AuthModule, EmailServiceModule, forwardRef(()=>ElectionModule), PlatformModule, LogQueue],
  providers: [
    BillingModelProvider,
    BillingRepository,
    BillingService,
    BillingModelProvider,
    WalletRepository,
    UserRepository,
    UserModelProvider,
    AuthenticationService,
    // EmailService,
    // EmailServiceProvider,
    RedisProvider,
    ElectionRepository,
    PlatformRepository
  ],
  exports: [BillingRepository, BillingModelProvider],
})
export class BillingModule {}
