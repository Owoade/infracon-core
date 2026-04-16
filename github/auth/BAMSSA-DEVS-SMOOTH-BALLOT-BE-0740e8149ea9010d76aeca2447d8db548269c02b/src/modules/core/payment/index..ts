import { WalletModule } from "@modules/wallet";
import { WalletService } from "@modules/wallet/wallet.service";
import { forwardRef, Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentSercvice } from "./payment.service";
import { ContestModule } from "@modules/contest";
import { SmoothTicketService } from "@modules/smooth-ticket/event/service";
import { SmoothTicketRepository } from "@modules/smooth-ticket/event/repo";
import { SmoothTicketEventModule } from "@modules/smooth-ticket/event";
import { StorageModule } from "../storage";
import { StorageService } from "../storage/storage.service";

@Module({
    exports: [PaymentModule],
    controllers: [PaymentController],
    providers: [PaymentModule, WalletService, PaymentSercvice],
    imports: [forwardRef(()=>WalletModule), ContestModule, forwardRef(()=>SmoothTicketEventModule)]
})
export class PaymentModule {}