export interface SendContestPaymenttMail {
    name: string;
    contest_name: string;
    vote_time: string;
    no_of_votes_paid_for: number;
    amount_paid: string

}
export function contest_payment_template(payload: SendContestPaymenttMail ) {
  return `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vote Confirmation</title>

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
          alt="Smooth Ballot Logo"
        />

        <h3>🎉 Someone Just Voted!</h3>
 
        <p class="mini-text">
          A new vote has been successfully recorded in your contest,
          <strong>${ payload.contest_name }</strong>, hosted on SmoothBallot.
        </p>

        <!-- <p class="mini-text">
          If you did not participate in this contest or believe this was an
          error, please contact us immediately at
          <a href="mailto:support@smoothballot.com">support@smoothballot.com</a
          >.
        </p> -->
        <div class="details">
          <p><strong>Voter:</strong> ${ payload.name }</p>
          <p><strong>Vote Time:</strong> ${ payload.vote_time }</p>
          <p><strong>No of Votes Paid For:</strong> ${ payload.no_of_votes_paid_for }</p>
          <p><strong>Amount Paid:</strong> ${ payload.amount_paid }</p>
        </div>
        <div style="line-height: 0.6em; margin: 2em 0 2em 0">
          <p>Thank you for choosing Smooth Ballot</p>
          <span>The Smooth Team.</span>
        </div>
      </center>
    </div>
  </body>
</html>

`;
}
