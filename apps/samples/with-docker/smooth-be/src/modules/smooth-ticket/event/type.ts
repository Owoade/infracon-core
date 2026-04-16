import { Response } from "express";

export interface SmoothTicketEventInterface {
    id: number;
    user_id: number,
    name: string;
    slug: string;
    description: string;
    scanner_key: string;
    image?: {
        link: string,
        id: string
    };
    community_link: string,
    start_date: string;
    end_date: string;
    location: {
        venue: string,
        address: string,
        city: string,
        state: string
    };
    created_at: string
}

export interface SmoothTicketInterface {
    id: number;
    user_id: number,
    event_id?: number | null;
    name: string;
    description: string;
    price?: number | null;
    max_per_mail?: number | null;
    stock_count?: number | null;
    admits: number,
    commission: number,
    flat_fee: number
}

export interface SmoothTicketAttendeeInterface {
    id?: number;
    user_id: number,
    name: string;
    email: string;
    phone: string;
    access_code: string; 
    event_id?: number | null;
    ticket_id?: number | null;
    payment_id?: number | null;
    qr_code_image_url?: string;
 }

export interface SmoothTicketPaymentInterface {
    id: number;
    reference?: string;
    user_id: number,
    event_name?: string | null;
    event_id?: number | null;
    ticket_id?: number | null;
    ticket_name: string;
    ticket_amount?: number | null;
    amount?: number | null;
    total_amount: number;
    email: string;
    name: string;
    phone: string;
    created_at: string;
    guests?: {
        ticket_id: number | null;
        ticket_name: string;
        amount_paid: number
        count: number
    }[];
    tickets: {
        email: string,
        name: string,
        ticket_id: number,
        ticket_name: string
    }[]
}

export interface InitiatePayment {
    slug: string;
    ticket_id: number;
    name: string;
    email: string;
    phone: string;
    tickets: {
        email: string,
        name: string,
        ticket_id: number
    }[]
}

export interface TicketPurchaseLogModelInterface {
    _id: string,
    payload: SmoothTicketPaymentInterface
}


export interface ValidateAttendee {
    access_code: string,
    scanner_key: string,
    event_id: number
}

export interface EventPurchaseData {
    output: NodeJS.WritableStream;
    event_name: string;
    customer_name: string;
    customer_email: string;
    purchases: string[];
    date: string;
    total: string;
    tickets: {
      name: string;
      email: string;
      type: string;
      access_code: string;
    }[];
  }

  export interface GenerateTicketPdf {
    event_name: string;      // e.g., "SUYA NIGHT LAUTECH"
    name: string;            // purchaser's name, e.g., "Owoade Anuoluwapo"
    ticket_name: string;     // ticket type, e.g., "PLATINUM"
    access_code: string;     // unique access code, e.g., "ASCF89"
    date_purchased: string;  // purchase timestamp, e.g., "2026-02-13 10:15 AM"
  }