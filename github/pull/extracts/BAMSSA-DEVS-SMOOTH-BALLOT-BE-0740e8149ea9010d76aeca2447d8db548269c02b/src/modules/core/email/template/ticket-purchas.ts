export interface TicketPurchaseEmailPayload {
    /** Recipient's name */
    name: string;

    event_name: string;
  
    /** Ticket name or type */
    ticket: string;
  
    /** Formatted amount (e.g. ₦5,000 or 5000 NGN) */
    amount: string;
  
    /** Unique access code for entry/verification */
    access_code: string;
  
    /** Optional link to purchase guest tickets */
    guest_link?: string;

    qr_code: string
  }
  
export const ticket_purchase_email_template = (payload: TicketPurchaseEmailPayload) => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ticket Purchase Confirmed</title>
    <style type="text/css">
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue",
          sans-serif;
        font-size: 12px;
        background-color: #f0f1f5;
      }
      * {
        box-sizing: border-box;
      }
      .wrapper {
        background: #f0f1f5;
        padding: 1em 0;
        width: 100%;
        height: 100vh;
      }
      .center-1 {
        text-align: left;
        background-color: white;
        border-radius: 10px;
        max-width: 500px;
        margin: 1em auto;
        padding: 1em 1.5em;
        color: #1f1f1f;
      }
      .mini-text {
        margin: 0.6em 0;
      }
      .details p {
        margin: 0.4em 0;
      }
      h3 {
        color: #0654b0;
      }
      img {
        width: 30px;
        display: block;
        margin: 1em 0;
      }

      .qr {
         width: 120px;
      }

      .button {
        display: inline-block;
        padding: 10px 20px;
        margin-top: 1em;
        background-color: #01356f;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      }
    </style>
  </head>

  <body>
    <div class="wrapper">
      <center class="center-1">
        <img
          src="https://res.cloudinary.com/dles2mycv/image/upload/v1768307547/streamline-color_tickets-flat_qr4tyj.png"
          alt="Smooth Ballot Logo"
        />

        <h3>Ticket Purchase Confirmed</h3>

        <p class="mini-text">Hello ${payload.name.toUpperCase()},</p>

        <p class="mini-text">
          This email confirms your ticket purchase for 
          <strong>${payload.event_name}</strong>. Your ticket(s) are attached for your reference.
        </p>

        <div style="line-height: 0.6em; margin: 2em 0">
          <p>Thank you for choosing Smooth Ticket</p>
          <span>The Smooth Team.</span>
        </div>
      </center>
    </div>
  </body>
</html>
`;
