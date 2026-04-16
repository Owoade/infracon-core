import { SmoothTicketService } from "@modules/smooth-ticket/event/service";
import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { SMOOTH_TICKET_PURCHASE_QUEUE } from "@queue/config";
import { Job } from "bull";

@Processor(SMOOTH_TICKET_PURCHASE_QUEUE)
export class SmoothTicketPurchaseWorker {
    private logger  = new Logger(SmoothTicketPurchaseWorker.name)

    constructor(
        private smooth_ticket_service: SmoothTicketService
    ){
        this.logger.debug("SMOOTH TICKET PURCHASE WORKER INITIATED");
    }

    @Process()
    async process(job: Job){
        return this.smooth_ticket_service.process_payment(job.data)
    }
}