import { forwardRef, Module } from "@nestjs/common";
import { SmoothTicketController } from "./controller";
import { SmoothTicketAttendeeModelProvider, SmoothTicketEventModelProvider, SmoothTicketPaymentModelProvider, SmoothTicketTicketModelProvider } from "./model";
import { SmoothTicketRepository } from "./repo";
import { StorageService } from "@modules/core/storage/storage.service";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { StorageModule } from "@modules/core/storage";
import { PaymentModule } from "@modules/core/payment/index.";
import { SmoothTicketUserService } from "../user/service";
import { SmoothTIcketUserModule } from "../user";
import { SmoothTicketUserRepository } from "../user/repo";
import { SmoothTicketService } from "./service";
import { SmoothTicketPurchaseQueue } from "@queue/config";
import { EmailService } from "@modules/core/email/email.service";

@Module({
    controllers: [SmoothTicketController],
    providers: [
        SmoothTicketEventModelProvider, 
        SmoothTicketTicketModelProvider, 
        SmoothTicketPaymentModelProvider, 
        SmoothTicketAttendeeModelProvider,
        SmoothTicketRepository,
        SmoothTicketUserRepository,
        SmoothTicketService,
        StorageService,
        PaymentSercvice,
        EmailService
    ],
    imports: [
        StorageModule,
        forwardRef(()=>PaymentModule),
        SmoothTIcketUserModule,
        SmoothTicketPurchaseQueue
    ],
    exports: [SmoothTicketService]
})
export class SmoothTicketEventModule{}