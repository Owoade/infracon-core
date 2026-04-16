import { Module, forwardRef } from "@nestjs/common";
import { WalletModelProvider, WalletTransactionModelProvider } from "./wallet.model";
import { WalletRepository } from "./wallet.repo";
import { WalletController } from "./wallet.controller";
import { UserModule } from "@modules/user";
import { AuthModule } from "@modules/core/auth";
import { LogQueue } from "src/queue/config";
import { PaymentModule } from "@modules/core/payment/index.";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { WalletService } from "./wallet.service";

@Module({
    imports: [forwardRef(()=> UserModule), AuthModule, LogQueue, forwardRef(()=>PaymentModule)],
    controllers: [WalletController],
    providers: [WalletTransactionModelProvider, WalletModelProvider, WalletRepository, PaymentSercvice, WalletService],
    exports: [WalletRepository, WalletModelProvider, WalletTransactionModelProvider]
})
export class WalletModule {}