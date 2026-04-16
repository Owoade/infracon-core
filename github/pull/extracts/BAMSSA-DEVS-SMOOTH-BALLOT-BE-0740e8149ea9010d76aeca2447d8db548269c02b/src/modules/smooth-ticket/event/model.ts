import db from "@db/postgres";
import { ATTENDEE_TABLE_NAME, AttendeeSchema } from "@db/postgres/schema/smooth-ticket/attendee";
import { EVENT_TABLE_NAME, EventSchema } from "@db/postgres/schema/smooth-ticket/event";
import { PAYMENT_TABLE_NAME, PaymentSchema } from "@db/postgres/schema/smooth-ticket/payments";
import { TICKET_TABLE_NAME, TicketSchema } from "@db/postgres/schema/smooth-ticket/ticket";

// ------------------------
export const SmoothTicketEventModel = db.define(
    EVENT_TABLE_NAME.table_name,
    EventSchema,
    {
        schema: EVENT_TABLE_NAME.schema,
        timestamps: true,
        createdAt: "created_at",
        updatedAt: 'updated_at'
    }
);

export const SMOOTH_TICKET_EVENT_MODEL_PROVIDER = 'SMOOTH_TICKET_EVENT_MODEL';

export const SmoothTicketEventModelProvider = {
    provide: SMOOTH_TICKET_EVENT_MODEL_PROVIDER,
    useValue: SmoothTicketEventModel
};

// ------------------------
// Ticket Model
// ------------------------
export const SmoothTicketModel = db.define(
    TICKET_TABLE_NAME.table_name,
    TicketSchema,
    {
        schema: TICKET_TABLE_NAME.schema,
        timestamps: false,
    }
);

export const SMOOTH_TICKET_TICKET_MODEL_PROVIDER = 'SMOOTH_TICKET_TICKET_MODEL';

export const SmoothTicketTicketModelProvider = {
    provide: SMOOTH_TICKET_TICKET_MODEL_PROVIDER,
    useValue: SmoothTicketModel
};

// ------------------------
// Attendee Model
// ------------------------
export const SmoothTicketAttendeeModel = db.define(
    ATTENDEE_TABLE_NAME.table_name,
    AttendeeSchema,
    {
        schema: ATTENDEE_TABLE_NAME.schema,
        timestamps: false,
    }
);

export const SMOOTH_TICKET_ATTENDEE_MODEL_PROVIDER = 'SMOOTH_TICKET_ATTENDEE_MODEL';

export const SmoothTicketAttendeeModelProvider = {
    provide: SMOOTH_TICKET_ATTENDEE_MODEL_PROVIDER,
    useValue: SmoothTicketAttendeeModel
};

// ------------------------
// Payment Model
// ------------------------
export const SmoothTicketPaymentModel = db.define(
    PAYMENT_TABLE_NAME.table_name,
    PaymentSchema,
    {
        schema: PAYMENT_TABLE_NAME.schema,
        timestamps: false,
    }
);

export const SMOOTH_TICKET_PAYMENT_MODEL_PROVIDER = 'SMOOTH_TICKET_PAYMENT_MODEL';

export const SmoothTicketPaymentModelProvider = {
    provide: SMOOTH_TICKET_PAYMENT_MODEL_PROVIDER,
    useValue: SmoothTicketPaymentModel
};

// SmoothTicketEventModel.hasMany(SmoothTicketModel, { foreignKey: "event_id"  })
// SmoothTicketModel.belongsTo(SmoothTicketEventModel)

// SmoothTicketPaymentModel.hasMany(SmoothTicketAttendeeModel)
// SmoothTicketAttendeeModel.belongsTo(SmoothTicketPaymentModel)

SmoothTicketEventModel.hasMany(SmoothTicketModel, {
    foreignKey: 'event_id',
    as: 'tickets'
})
  
SmoothTicketModel.belongsTo(SmoothTicketEventModel, {
    foreignKey: 'event_id',
    as: 'event'
})