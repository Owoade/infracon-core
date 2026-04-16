import { PLUNK_SECRET_KEY, PLUNK_SECRET_KEY_TWO, WEBMAIL_PASSWORD } from "@env/index";
import Plunk from "@plunk/node";

const plunk_service = new Plunk( PLUNK_SECRET_KEY );

const plunk_service_two = new Plunk( PLUNK_SECRET_KEY_TWO );

export const EMAIL_SERVICE_PROVIDER = 'EMAIL_SERVICE_PROVIDER';

export const SECOND_EMAIL_SERVICE_PROVIDER = 'SECOND_EMAIL_SERVICE_PROVIDER';

export const EmailServiceProvider = {
    provide: EMAIL_SERVICE_PROVIDER,
    useValue: plunk_service
}

export const SecondEmailServiceProvider = {
    provide: SECOND_EMAIL_SERVICE_PROVIDER,
    useValue: plunk_service_two
}

const MAIL_CONFIG = {
    host: "mail.privateemail.com",
    secureConnection: false,
    port: 465,
    auth: {
        user: "hello@smoothballot.com", // generated ethereal user
        pass: WEBMAIL_PASSWORD // generated ethereal password
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
    }
}

export default MAIL_CONFIG