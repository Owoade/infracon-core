import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { SmoothTicketRepository } from "./repo";
import { 
    EventPurchaseData,
    GenerateTicketPdf,
    InitiatePayment,
    SmoothTicketAttendeeInterface,
    SmoothTicketEventInterface, 
    SmoothTicketInterface, 
    SmoothTicketPaymentInterface,
    ValidateAttendee
} from "./type";
import * as moment from "moment";
import * as crypto from "crypto";
import slugify from "slugify";
import { StorageService } from "@modules/core/storage/storage.service";
import { PaymentSercvice } from "@modules/core/payment/payment.service";
import { payment_metadata_repo } from "@utils/payment-metadata";
import { Transaction } from "sequelize";
import db from "@db/postgres";
import { Cron } from "@nestjs/schedule";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { SMOOTH_TICKET_PURCHASE_QUEUE } from "@queue/config";
import { EmailService } from "@modules/core/email/email.service";
import { ticket_purchase_email_template } from "@modules/core/email/template/ticket-purchas";
import { format_currency, format_currency_without_symbol } from "@utils/format_currency";
import { redis_client } from "@cache/index";
import * as QRCode from "qrcode";
import * as fs from 'fs'; 
import * as PDFDocument from "pdfkit"

import { capitalize_first_letter } from "@utils/capitalize_first_letter";
import { setTimeout } from 'timers/promises';
import { Response } from "express";
import * as EventEmitter from "events";

@Injectable()
export class SmoothTicketService {
  constructor(
    private repo: SmoothTicketRepository,
    private storage_service: StorageService,
    private payment_service: PaymentSercvice,
    @InjectQueue(SMOOTH_TICKET_PURCHASE_QUEUE)
    private ticket_purchase_queue: Queue,
    private email_service: EmailService,
  ) {}

  // ----------------------------
  // Event Methods
  // ----------------------------

  async create_event(payload: SmoothTicketEventInterface) {
    payload.slug = slugify(payload.name.replace(/\b[Ee]lections?\b/g, ''), {
      strict: true,
      lower: true,
      replacement: '-',
      trim: true,
    });

    const existing_event = await this.repo.get_single_event(
      { slug: payload.slug },
      ['slug'],
    );
    if (existing_event) {
      const variable = crypto.randomInt(1000, 9999);
      payload.slug += variable;
    }

    if (!moment(payload.start_date).isBefore(payload.end_date)) {
      throw new BadRequestException('start_date must be before end_date');
    }

    const new_event = await this.repo.create_event(payload);
    return new_event;
  }

  async update_event(
    update: Partial<SmoothTicketEventInterface>,
    filter: Partial<SmoothTicketEventInterface>,
  ) {
    const event = await this.repo.get_single_event(filter, ['image']);

    delete update.slug;

    if (!event) throw new NotFoundException('Event not found');

    if (update.image.id !== event.image.id) {
      await this.storage_service.delete_file(event.image.id);
    }

    if (!moment(update.start_date).isBefore(update.end_date)) {
      throw new BadRequestException('start_date must be before end_date');
    }

    const updated_event = await this.repo.update_event(update, filter);

    return updated_event;
  }

  // ----------------------------
  // Ticket Methods
  // ----------------------------

  async create_ticket(payload: SmoothTicketInterface) {
    // Optional: ensure the ticket name is unique per event
    const existing_ticket = await this.repo.get_tickets(
      { name: payload.name, event_id: payload.event_id },
      ['name'],
    );

    if (existing_ticket.length > 0)
      throw new BadRequestException(
        'Ticket with this name already exists for the event',
      );
    
    if (!payload.admits)
      payload.admits = 1

    payload.commission = 0;
    payload.flat_fee = 0;

    const new_ticket = await this.repo.create_ticket(payload);
    return new_ticket;
  }

  async update_ticket(
    update: Partial<SmoothTicketInterface>,
    filter: Partial<SmoothTicketInterface>,
  ) {
    const updated_ticket = await this.repo.update_ticket(update, filter);

    return updated_ticket?.toJSON();
  }

  async initiate_payment(payload: InitiatePayment) {
    let payment = {} as SmoothTicketPaymentInterface;

    const event = await this.repo.get_single_event({
      slug: payload.slug,
    });

    if (!event) throw new NotFoundException('Event not found');

    let total_amount = 0;

    payment.user_id = event.user_id;
    payment.event_name = event.name;
    payment.event_id = event.id;
    payment.ticket_id = 0;
    payment.ticket_name = '';
    payment.ticket_amount = 0;
    payment.email = payload.email;
    payment.name = payload.name;
    payment.phone = payload.phone;
    payment.tickets = [];

    const group_ticket_validation_hash: Record<number, boolean> = {};

    for (let t of payload.tickets) {
      const ticket = await this.repo.get_single_ticket(
        { id: t.ticket_id, event_id: event.id },
        ['stock_count', 'name', 'price', 'admits', 'commission', 'flat_fee'],
      );

      if (!ticket) {
        throw new ForbiddenException('Invalid ticket');
      }

      if (ticket.stock_count == null) {
        continue;
      }

      const IS_GROUPED_TICKET = ticket.admits > 1;
      const GROUP_TICKET_HAS_NOT_BEEN_VALIDATED =
        IS_GROUPED_TICKET && !group_ticket_validation_hash[t.ticket_id];

      if (IS_GROUPED_TICKET) {
        if (GROUP_TICKET_HAS_NOT_BEEN_VALIDATED) {
          const group_members = payload.tickets.filter(
            (ti) => ti.ticket_id === t.ticket_id,
          ).length;
          if (group_members > ticket.admits)
            throw new ForbiddenException(
              `Ticket "${ticket.name}" allows ${ticket.admits} admission(s); ${group_members} submitted.`,
            );

          total_amount += parseFloat(ticket.price as any) + this.get_commission(ticket as any);
          group_ticket_validation_hash[t.ticket_id] = true;
        }
      } else total_amount += parseFloat(ticket.price as any) + this.get_commission(ticket as any);

      payment.tickets.push({
        email: t.email,
        name: t.name,
        ticket_id: t.ticket_id,
        ticket_name: ticket.name
      });
    }

    payment.total_amount = total_amount;

    const session_id = crypto.randomUUID();

    const PURCHASE_REDIS_KEY = `SMOOTH_TICKET_PURCHASE_${session_id}`;

    const callback_url_params = {
      session_id
    }

    if( event.community_link )
      (callback_url_params as any).community_link = event.community_link

    const params_to_string = (new URLSearchParams(callback_url_params)).toString()

    const paystack_payment = await this.payment_service.create_charge({
      email: payment.email,
      amount: (payment.total_amount * 100).toString(),
      callback_url: `https://ticket.smooth.africa/payment-success?${params_to_string}`,
    });

    const metadata = {
      type: 'ticket:purchase',
      payment,
    };

    if (paystack_payment.data.reference) {
      payment.reference = paystack_payment.data.reference;
      await payment_metadata_repo.create({
        id: paystack_payment.data.reference,
        data: metadata,
        type: 'ticket_purchase',
      });
    }

    redis_client.setex(
      PURCHASE_REDIS_KEY,
      86400,
      JSON.stringify({
        email: payment.email,
        slug: event.slug,
      }),
    );

    return paystack_payment;
  }

  async handle_payment(payload: SmoothTicketPaymentInterface) {
    await Promise.all([
      this.repo.create_ticket_purchase_log({
        _id: payload.reference,
        payload,
      }),
      this.ticket_purchase_queue.add(payload),
    ]);
  }

  async generate_scanner_key(
    filter: Pick<SmoothTicketEventInterface, 'user_id' | 'id'>,
  ) {
    const scanner_key = this.generate_access_code(6);
    const REDIS_KEY = `SCANNER_KEY/EVENT:${filter.id}`;
    await Promise.all([
      this.repo.update_event(
        {
          scanner_key,
        },
        filter,
      ),
      redis_client.del(REDIS_KEY),
    ]);
    return scanner_key;
  }

  async authenticate_scanner_key(
    payload: Pick<SmoothTicketEventInterface, 'scanner_key' | 'id'>,
  ) {
    payload.scanner_key = payload.scanner_key.toUpperCase();
    const REDIS_KEY = `SCANNER_KEY/EVENT:${payload.id}`;
    let cached_value = await redis_client.get(REDIS_KEY);

    if (!cached_value) {
      const event = await this.repo.get_single_event(payload, [
        'id',
        'description',
        'name',
        'image',
        'start_date',
        'end_date',
        'scanner_key',
      ]);
      if (!event) throw new BadRequestException('Invalid scanner key');

      await redis_client.setex(REDIS_KEY, 3600, JSON.stringify(event));
      return event;
    }

    const event = (await JSON.parse(
      cached_value,
    )) as Partial<SmoothTicketEventInterface>;
    console.log(event);
    if (event.scanner_key !== payload.scanner_key) {
      await redis_client.del(REDIS_KEY);
      throw new BadRequestException('Invalid scanner key');
    }

    return event;
  }

  async validate_attendee(payload: ValidateAttendee) {
    payload.scanner_key = payload.scanner_key.toUpperCase();
    payload.access_code = payload.access_code.toUpperCase();
    const attendee = await this.repo.get_single_attendee(
      {
        event_id: payload.event_id,
        access_code: payload.access_code,
      },
      ['user_id', 'ticket_id', 'name', 'email'],
    );

    if (!attendee) throw new BadRequestException("Attendee doesn't exist");

    const ticket = await this.repo.get_single_ticket(
      {
        id: attendee.ticket_id,
      },
      ['name'],
    );

    await this.authenticate_scanner_key({
      scanner_key: payload.scanner_key,
      id: payload.event_id,
    });

    return {
      ticket_name: ticket.name,
      name: attendee.name,
      email: attendee.email,
    };
  }

  async get_guest_attendees(
    payload: Pick<SmoothTicketPaymentInterface, 'reference' | 'id'>,
  ) {
    const payment = await this.repo.get_single_payment(payload, [
      'guests',
      'email',
    ]);
    if (!payment) throw new BadRequestException('Invalid payment');

    if (!payment.guests?.length)
      throw new BadRequestException('This payment has no guest');

    const _guests = await this.repo.get_guest_tickets(
      payload.id,
      payment.email,
    );

    const guests = [];

    for (let _guest of _guests) {
      const guest = _guest.toJSON();
      const ticket = payment.guests.find(
        (_) => _.ticket_id === guest.ticket_id,
      );
      guests.push({
        id: guest.id,
        ticket_name: ticket.ticket_name,
        ticket_id: guest.ticket_id,
        amount_paid: ticket.amount_paid,
        email: guest.email,
        name: guest.name,
      });
    }

    return guests;
  }

  async add_guest_attendee(
    payment_info: Pick<SmoothTicketPaymentInterface, 'reference' | 'id'>,
    guests: Pick<SmoothTicketAttendeeInterface, 'email' | 'name' | 'id'>[],
  ) {
    const payment = await this.repo.get_single_payment(payment_info, [
      'id',
      'guests',
      'event_name',
    ]);
    if (!payment) throw new BadRequestException('Invalid payment');

    for (let guest of guests) {
      guest.email = guest.email.toLowerCase();
      const attendee = await this.repo.get_single_attendee(
        { payment_id: payment_info.id, id: guest.id },
        ['email'],
      );
      if (!attendee || attendee?.email !== '') continue;
      const updated_guest = await this.repo.update_guest_attendee(
        guest,
        guest.id,
      );
      if (updated_guest) {
        const ticket = payment.guests.find(
          (_) => _.ticket_id === updated_guest.ticket_id,
        );
        await this.email_service.send({
          sender: 'Smooth Events',
          to: guest.email,
          subject: 'Ticket Purchase Confirmed',
          body: ticket_purchase_email_template({
            qr_code: updated_guest.qr_code_image_url,
            name: updated_guest.name,
            ticket: ticket.ticket_name,
            amount: format_currency(ticket.amount_paid),
            access_code: updated_guest.access_code,
            event_name: payment.event_name,
          }),
        });
      }
    }
  }

  async generate_ticket_pdf(
    payment_info: Pick<SmoothTicketPaymentInterface, 'reference' | 'id'>,
    response: Response,
    listener?: EventEmitter,
  ) {
    const payment = await this.repo.get_single_payment(payment_info, [
      'id',
      'guests',
      'name',
      'email',
      'ticket_name',
      'ticket_amount',
      'total_amount',
      'ticket_amount',
      'event_name',
      'created_at',
      'ticket_id',
      'event_id',
    ]);

    if (!payment) throw new BadRequestException('Invalid payment');

    const { attendees } = await this.repo.get_attendees(
      { payment_id: payment.id },
      1,
      100,
      ['email', 'name', 'access_code', 'qr_code_image_url', 'ticket_id'],
    );
    const GUEST_ATTENDEE_WITHOUT_DETAILS_EXIST =
      attendees.length > 1 &&
      attendees.some((a) => a.toJSON().email == '' || a.toJSON().name === '');

    if (GUEST_ATTENDEE_WITHOUT_DETAILS_EXIST)
      return response.end("All guest attendees' details must be filled");

    const ticket_hash = {
      [payment.ticket_id]: payment.ticket_name,
      // Generate other hash values from guest array
      ...payment.guests.reduce(
        (v, g) => {
          v[g.ticket_id] = g.ticket_name;
          return v;
        },
        {} as Record<string, any>,
      ),
    };

    console.log({ ticket_hash });

    await this.download_qr_codes(
      attendees.map((a) => ({
        qr_code_image_url: a.toJSON().qr_code_image_url,
        access_code: a.toJSON().access_code,
        event_id: payment.event_id,
      })),
    );

    const ticket_purchase_data: EventPurchaseData = {
      output: response,
      event_name: capitalize_first_letter(payment.event_name),
      customer_email: payment.email,
      customer_name: capitalize_first_letter(payment.name),
      purchases: [
        `1 x ${payment.ticket_name} = N${format_currency_without_symbol(payment.ticket_amount)}`,
        ...payment.guests.map(
          (g) =>
            `${g.count} x ${payment.ticket_name} = N${format_currency_without_symbol(g.count * g.amount_paid)}`,
        ),
      ],
      date: moment(payment.created_at).format('DD-MM-YYYY hh:mm'),
      total: `N${format_currency_without_symbol(payment.total_amount)}`,
      tickets: attendees.map((a) => ({
        name: capitalize_first_letter(a.toJSON().name),
        email: a.toJSON().email,
        type: capitalize_first_letter(
          ticket_hash[a.toJSON().ticket_id],
        ).replace(/^tickets?$/i, ''),
        access_code: a.toJSON().access_code,
      })),
    };

    this.generate_pdf(ticket_purchase_data, listener);
  }

  async download_qr_codes(
    payload: Pick<
      SmoothTicketAttendeeInterface,
      'qr_code_image_url' | 'access_code' | 'event_id'
    >[],
  ) {
    console.log(payload);
    for (let q of payload) {
      if (fs.existsSync(`${q.access_code}.png`)) continue;
      console.log(q.qr_code_image_url);
      await QRCode.toFile(
        `${q.access_code}.png`,
        `https://api.smoothballot.com/ticket/validate/${q.event_id}/${q.access_code}`,
        {
          width: 200,
          margin: 2,
        },
      );
    }
  }

  private generate_pdf(data: EventPurchaseData, listener?: EventEmitter) {
    const doc = new PDFDocument();

    if (listener) {
      const buffers: Buffer[] = [];
      doc.on('data', (data: Buffer) => buffers.push(data));
      doc.on('close', async () => {
        listener.emit('data', Buffer.concat(buffers));
      });
    }

    doc.pipe(data.output);

    // Set page background to whitesmoke
    doc.fillColor('#FFFFFF');
    // doc.fillColor('red');
    doc.rect(0, 0, doc.page.width, 70).fill();

    doc.image('ticket.png', 20, 20, { width: 30, height: 27 });
    // Optional: add text inside the rectangle
    doc.fillColor('#19365b').fontSize(20).text('SmoothTicket', 58, 27);
    doc.fontSize(12).text(data.date, doc.page.width - 150, 30, { width: 120 });

    doc.fillColor('#f0eef5');
    doc.rect(0, 70, doc.page.width, 30).fill();

    doc
      .fillColor('#1a3150')
      .font('font/Satoshi-Bold.otf')
      .fontSize(14)
      .text('Event Name: ', 23, 120);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(14)
      .text(data.event_name, 110, 120);

    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(14)
      .text("Customer's Name: ", 23, 145);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(14)
      .text(data.customer_name, 150, 145);

    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(14)
      .text("Customer's Email: ", 23, 170);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(14)
      .text(data.customer_email, 150, 170);

    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(14)
      .text('Tickets Purchased: ', 23, 195);

    doc.font('font/Satoshi-Regular.otf').fontSize(12).text(
      data.purchases.slice(0, 3).join(', '),
      // "1 * GOLD = N5,000, 2 * PLATINUM = N100,000, 4 * VVIP = N400,000",
      150,
      195,
    );

    let current_height = 195;

    if (data.purchases.length > 3) {
      current_height += 20;
      doc.font('font/Satoshi-Regular.otf').fontSize(12).text(
        data.purchases.slice(3).join(', '),
        // "1 * GOLD = N5,000, 2 * PLATINUM = N100,000, 4 * VVIP = N400,000",
        150,
        current_height,
      );
    }

    current_height += 25; // 220
    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(14)
      .text('Total: ', 23, current_height);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(14)
      .text(data.total, 70, current_height);

    current_height += 40; // 260
    doc.fillColor('#f0eef5');
    doc.rect(0, current_height, doc.page.width, 30).fill();

    let add_new_page_when_i_greater_than = 3;

    for (let i = 0; i < data.tickets.length; i++) {
      let ticket = data.tickets[i];

      if (add_new_page_when_i_greater_than === i) {
        doc.addPage();
        doc.fillColor('#f0eef5');
        doc.rect(0, 0, doc.page.width, 30).fill();
        current_height = 20;
        add_new_page_when_i_greater_than += 5;
      }

      if (i === 0)
        current_height += 45; // 305 * i
      else current_height += 20;

      doc
        .fillColor('#19365b')
        .font('font/Satoshi-Regular.otf')
        .fontSize(12)
        .text(`Ticket ${i + 1}`, 23, current_height);

      current_height += 20; // 325
      doc
        .fillColor('#1a3150')
        .font('font/Satoshi-Bold.otf')
        .fontSize(14)
        .text(ticket.name, 23, current_height);

      current_height += 20; // 345
      doc
        .fillColor('#747d8c')
        .font('font/Satoshi-Regular.otf')
        .fontSize(14)
        .text(ticket.email, 23, current_height);

      doc.fillColor('#f0eef5');
      current_height += 28; // 373
      doc.rect(23, current_height, 455, 1).fill();

      current_height += 10; // 380
      doc
        .fillColor('#2e7cd2')
        .font('font/Satoshi-Bold.otf')
        .fontSize(16)
        .text(`${ticket.type}`, 23, current_height);

      doc
        .fillColor('#747d8c')
        .font('font/Satoshi-Regular.otf')
        .fontSize(14)
        .text('Access Code: ', 335, current_height);

      doc
        .fillColor('#1a3150')
        .font('font/Satoshi-Bold.otf')
        .fontSize(14)
        .text(ticket.access_code, 425, current_height);

      doc.image(
        `${ticket.access_code}.png`,
        doc.page.width - 120,
        current_height - 80,
        {
          width: 110,
          height: 110,
        },
      );

      doc.fillColor('#f0eef5');
      current_height += 40;
      doc.rect(0, current_height, doc.page.width, 5).fill();
    }

    doc.fillColor('#f0eef5');
    doc.rect(0, current_height, doc.page.width, doc.page.height).fill();

    doc.end();
  }

  private generate_ticket_pdf2(payload: GenerateTicketPdf) {
    const doc = new PDFDocument({
      size: 'B7',
    });

    const file_stream = fs.createWriteStream(`${payload.access_code}.pdf`);
    doc.pipe(file_stream);
    doc.image('ticket.png', 86, 16, { width: 10, height: 10 });
    doc.fillColor('#19365b').fontSize(8).text('SmoothTicket', 100, 18);

    doc.font('font/Satoshi-Bold.otf').fontSize(8).text('Event Ticket', 100, 28);

    doc.font('font/Satoshi-Bold.otf').fontSize(8).text('Event Name: ', 15, 50);
    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(8)
      .text(payload.event_name, 65, 50);

    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(8)
      .text("Attendee's Name: ", 15, 65);

    doc.font('font/Satoshi-Regular.otf').fontSize(8).text(payload.name, 85, 65);

    doc.font('font/Satoshi-Bold.otf').fontSize(8).text('Ticket Type: ', 15, 80);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(8)
      .text(payload.ticket_name, 63, 80);

    doc.font('font/Satoshi-Bold.otf').fontSize(8).text('Access Code: ', 15, 95);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(8)
      .text(payload.access_code, 70, 95);

    doc
      .font('font/Satoshi-Bold.otf')
      .fontSize(8)
      .text('Date Purchased: ', 15, 110);

    doc
      .font('font/Satoshi-Regular.otf')
      .fontSize(8)
      .text(payload.date_purchased, 80, 110);

    doc.image(`${payload.access_code}.png`, 5, 125, {
      width: 240,
      height: 220,
    });

    doc.end();
  }

  async process_payment(payload: SmoothTicketPaymentInterface) {
    const existing_payment = await this.repo.get_single_payment(
      {
        reference: payload.reference,
      },
      ['id'],
    );

    if (existing_payment) {
      await this.repo.delete_ticket_purchase_log(payload.reference);
      return console.error('Transaction already processed');
    }

    const transaction = await db.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    });

    const payment_date = moment().format("YYYY-MM-DD hh:mm A")

    // create payment 
    // create attendees from ticket (access code and qr code)
    // send emails

    try {
      const payment = await this.repo.create_payment(payload);
      const attendees: SmoothTicketAttendeeInterface[] = []
      for ( let t of payload.tickets ){
        const access_code = this.generate_access_code();
        const qr_code_file_path = `${access_code}.png`;
        const attendee = await this.repo.create_attendee(
          {
            name: t.name,
            email: t.email,
            phone: "",
            ticket_id: t.ticket_id,
            payment_id: payment.toJSON().id,
            user_id: payload.user_id,
            event_id: payload.event_id,
            access_code: access_code,
            qr_code_image_url: "",
          },
          transaction,
        );
        await QRCode.toFile(
          qr_code_file_path,
          `https://api.smoothballot.com/ticket/validate/${payload.event_id}/${access_code}`,
          {
            width: 200,
            margin: 2,
          },
        );
        this.generate_ticket_pdf2({
          name: t.name.toUpperCase(),
          event_name: payload.event_name.toUpperCase(),
          access_code,
          date_purchased: payment_date,
          ticket_name: t.ticket_name.toUpperCase()
        })
        attendees.push(attendee.toJSON())
      }

      await transaction.commit();
      
      await setTimeout(3000)

      this.email_service.send({
        sender: 'Smooth Events',
        to: payload.email,
        subject: 'Ticket Purchase Confirmed',
        body: ticket_purchase_email_template({
          qr_code: "",
          name: payload.name.split(' ')[0],
          ticket: payload.ticket_name,
          amount: format_currency(payload.total_amount),
          access_code: "",
          event_name: payment.toJSON().event_name,
        }),
        attachments: attendees.map((a)=>({
          mime_type: "application/pdf",
          content: fs.readFileSync(`${a.access_code}.pdf`).toString('base64'),
          name: `SE-RECIEPT-${Date.now()}`,
        }))
      });

      await this.repo.delete_ticket_purchase_log(payload.reference);

    } catch (e: any) {
      console.error(e);
      transaction.rollback();
    }
  }

  @Cron('*/30 * * * *', { name: 'Stale payments Cron' })
  async process_stale_payments() {
    const stale_payents = await this.repo.get_stale_ticket_purchase_logs();
    for (let payment of stale_payents) {
      await this.process_payment(payment.payload);
    }
  }

  generate_access_code(len: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < len; i++) {
      const index = Math.floor(Math.random() * chars.length);
      code += chars[index];
    }

    return code;
  }

  get_commission(ticket: SmoothTicketInterface){
    return (ticket.price * (ticket.commission/100)) + ticket.flat_fee
  }
}
