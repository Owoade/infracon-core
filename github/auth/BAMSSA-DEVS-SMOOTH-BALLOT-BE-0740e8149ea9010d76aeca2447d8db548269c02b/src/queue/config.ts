import { QUEUE_REDIS_HOST, QUEUE_REDIS_PASSWORD, QUEUE_REDIS_PORT, REDIS_URL } from "@env/index";
import { BullModule } from "@nestjs/bull";

// const connection = new Redis(QUEUE_REDIS_URL, { maxRetriesPerRequest: null });

const connection = {
    // host: QUEUE_REDIS_HOST,
    // port: QUEUE_REDIS_PORT,
    // password: QUEUE_REDIS_PASSWORD,
    // username: "default",
    // tls: {}
    port: 6379,
    maxRetriesPerRequest: null
    
  }

console.log( connection )

export const QueueModule = BullModule.forRoot({
  redis: connection
});

export const VOTERS_POPULATION_QUEUE = "VOTERS_POPULATION_QUEUE";

export const VotersPopulationQueueModule = BullModule.registerQueue({
  name: VOTERS_POPULATION_QUEUE,
})


export const VOTERS_AUTH_EMAIL_BATCH_QUEUE = "VOTERS_AUTH_EMAIL_BATCH_QUEUE";

export const VotersAuthEmailBatchQueue = BullModule.registerQueue({
  name: VOTERS_AUTH_EMAIL_BATCH_QUEUE,
})

export const VOTERS_AUTH_EMAIL_QUEUE = "VOTERS_AUTH_EMAIL_QUEUE";

export const VoterAuthEmailQueue = BullModule.registerQueue({
  name: VOTERS_AUTH_EMAIL_QUEUE
})


export const VOTE_QUEUE = "VOTERS_QUEUE";

export const VoteQueue = BullModule.registerQueue({
  name: VOTE_QUEUE,

})
export const ACCREDITATION_FORM_QUEUE = "ACCREDITATION_FORM_QUEUE";

export const AccreditationFormQueue = BullModule.registerQueue({
  name: ACCREDITATION_FORM_QUEUE
})

export const LOG_QUEUE = "LOG_QUEUE"

export const LogQueue = BullModule.registerQueue({
  name: LOG_QUEUE
})

export const EXPORT_RESULT_QUEUE = "EXPORT_RESULT_QUEUE"

export const ExportResultQueue = BullModule.registerQueue({
  name: EXPORT_RESULT_QUEUE
})
export const CONTEST_VOTE_QUEUE = "CONTEST_VOTE_QUEUE";

export const ContestVoteQueue = BullModule.registerQueue({
  name: CONTEST_VOTE_QUEUE
})

export const CONTEST_REVENUE_TRANSFER_QUEUE = "CONTEST_REVENUE_TRANSFER_QUEUE";

export const ContestRevenueTransferQueue = BullModule.registerQueue({
  name: CONTEST_REVENUE_TRANSFER_QUEUE
})

export const CONTEST_REVENUE_REPORT_GENERATION_QUEUE = "CONTEST_REVENUE_REPORT_GENERATION_QUEUE";

export const ContestReportGenerationQueue = BullModule.registerQueue({
  name: CONTEST_REVENUE_REPORT_GENERATION_QUEUE
})

export const SMOOTH_TICKET_PURCHASE_QUEUE = "SMOOTH_TICKET_PURCHASE_QUEUE";

export const SmoothTicketPurchaseQueue = BullModule.registerQueue({
  name: SMOOTH_TICKET_PURCHASE_QUEUE
})