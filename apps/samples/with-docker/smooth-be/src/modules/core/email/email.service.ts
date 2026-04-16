import { Inject, Injectable } from "@nestjs/common";
import Plunk from "@plunk/node";
import MAIL_CONFIG, { EMAIL_SERVICE_PROVIDER, SECOND_EMAIL_SERVICE_PROVIDER } from "./config";
import * as nodemailer from "nodemailer";
import { otp_template } from "./template/otp";
import { VoterAuthpayload, voter_auth_template } from "./template/voters-auth";
import { BillingWarningNoticePayload, billing_warning_notice } from "./template/billing.warning";
import { BillingExpiredNoticePayload, billing_expiry_notice } from "./template/billing.expired";
import { SubscriptionRenewedNoticePayload, subscription_renewed_notice } from "./template/subscription.renewed";
import { result_template, SendResultPayload } from "./template/result";
import { send_election_edit_notice, SendElectionEditReminderPayload } from "./template/reminder";
import { SendVoteAcknowledgementMail, vote_counted_template } from "./template/voted";

import axios from "axios";
import { ZEPTOMAIL_API_KEY } from "@env/index";

@Injectable()
export class EmailService {

    private brand_name = "Smooth ballot"

    constructor(
    ){}

    async send_via_node_mailer( payload: SendViaNodeMailer ){

        const mailer = nodemailer.createTransport(MAIL_CONFIG);

        try{

            return new Promise((res, rej)=>{

                mailer.sendMail(payload, (err)=>{
    
                    if(err) return console.error(err);
    
                    res(true)
    
                })
            })

        }

        catch(e){

            console.error(e);

        }

        
    }

    async send_otp( payload: SendOtp ){

        console.log("In email service block")

        await this.send(
            {
                sender: payload.product === "ticket" ? "Smooth Events" : "Smoothballot",
                to: payload.email,
                body: otp_template( payload.name, payload.otp, payload.product ),
                subject: "Your One-Time Pin",
            }
        )

    }

    async send_voters_auth( payload: VoterAuthpayload ){

        await this.send(
            {
                to: payload.email,
                body: voter_auth_template(payload),
                subject: "Voters Credentials",
            }
        )
        
    }

    async send_voters_auth_custom( payload: VoterAuthpayload, api_key: string ){

        await axios.post(
            "https://api.zeptomail.com/v1.1/email",
            {
                "from": {
                  "address": "noreply@smoothballot.com",
                  "name": "Smoothballot"
                },
                "to": [
                  {
                    "email_address": {
                      "address": payload.email,
                      "name": "SmoothBallot"
                    }
                  }
                ],
                "subject": "Voters Credentials",
                "htmlbody": voter_auth_template(payload)
            },
            {
                headers: {
                    "Authorization": ZEPTOMAIL_API_KEY
                }
            }
        )
        
    }

    async send_billing_reminder_notice( payload: BillingWarningNoticePayload ){

        await this.send(
            {
                to: payload.email,
                body: billing_warning_notice( payload ),
                subject: "Important: Your Election Subscription Expires in 3 Days",
            }
        )

    }

    async send_billing_expiry_notice( payload: BillingExpiredNoticePayload ){

        await this.send(
            {
                to: payload.email,
                body: billing_expiry_notice( payload ),
                subject: "Notice: Your Election Subscription Has Expired",
            }
        )

    }

    async send_subscription_renewal_notice( payload: SubscriptionRenewedNoticePayload ){

        await this.send(
            {
                to: payload.email,
                body: subscription_renewed_notice( payload ),
                subject: "Your Election Subscription Has Been Renewed",
            }
        )

    }

    async send_result( payload: SendResultPayload ){

        await this.send(
            {
                to: payload.email,
                body: result_template(payload),
                subject: `${payload.election_title} result is ready!`,
            }
        )
        
    }

    async send_election_notice_mail( payload: SendElectionEditReminderPayload ){

        await this.send(
            {
                to: payload.email,
                body: send_election_edit_notice(payload),
                subject: `Important Notice: Edit Restrictions for the Upcoming ${payload.election_name}!`,
            }
        )
        
    }

    async send_vote_acknowledgement_mail( payload: SendVoteAcknowledgementMail ){

        payload.election_name = payload.election_name.toUpperCase();
    
        await this.send(
            {
                to: payload.email,
                body: vote_counted_template(payload),
                subject: `Your Vote Has Been Counted! [${payload.election_name.toUpperCase()}]`,
            }
        )
    }

    async send( payload: SendEmail ){
        await axios.post(
            "https://api.zeptomail.com/v1.1/email",
            {
                "from": {
                  "address": "noreply@smoothballot.com",
                  "name": payload.sender ?? "Smoothballot"
                },
                "to": [
                  {
                    "email_address": {
                      "address": payload.to,
                      "name": "SmoothBallot"
                    }
                  }
                ],
                "subject": payload.subject,
                "htmlbody": payload.body,
                "attachments": payload.attachments
            },
            {
                headers: {
                    "Authorization": ZEPTOMAIL_API_KEY
                }
            }
        )
    }


}

interface SendEmail {
    sender?: string
    to: string,
    subject: string;
    body: string;
    attachments?: {
        name: string
        content: string,
        mime_type: string
    }[]
}

interface SendOtp {
    email: string;
    name: string;
    otp: string;
    product?: string
}

interface SendViaNodeMailer {
    to: string,
    subject: string,
    from: string,
    headers?: {
        References: string
    },
    html: string
}

type SendMailConfig = Partial<{
    use_nodemailer: boolean;
}>
