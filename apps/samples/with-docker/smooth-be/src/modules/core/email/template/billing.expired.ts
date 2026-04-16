export interface BillingExpiredNoticePayload {
    first_name: string;
    election_title: string;
    email: string;
}

export function billing_expiry_notice( payload: BillingExpiredNoticePayload ){

    const { first_name, election_title} = payload;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Modern HTML Email Template</title>

    <style type="text/css">
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue",
          sans-serif;
        font-size: 12px;
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

      .center-2 {
        color: #727586;
        margin-top: 2em;
      }

      .center-2 span {
        color: #a6abb5;
      }

      h2 {
        color: #01356f;
      }
      img {
        width: 100px;
        margin: 1em 0;
      }
    </style>
  </head>

  <body>
    <div class="wrapper">
      <center class="center-1">
        <img
          src="https://res.cloudinary.com/dles2mycv/image/upload/v1717850775/smooth-ballot-logo_2_mtiavw.png"
          alt=""
        />

        <h3>ELECTION SUBSCRIPTION EXPIRATION NOTICE</h3>
        <p>Dear ${first_name},</p>
        <p class="mini-text">
          We regret to inform you that your subscription for the
          ${election_title} election has expired.
        </p>
        <p class="mini-text">
          To avoid any interruption, please note that your election services
          will be disabled in <br />
          <strong>24 hours</strong> unless your subscription is renewed. Click
          <a href="">here</a> to learn how to renew your subscription.
        </p>
        <p class="mini-text">
          If you have any questions or need assistance, please don't hesitate to
          contact our support team.
        </p>
        <div style="line-height: 0.6em; margin: 2em 0 2em 0">
          <p>Thank you for choosing Smooth ballot</p>
          <span>The Smooth Team.</span>
        </div>
      </center>
    </div>
  </body>
</html>

      
`
}