
export interface VoterAuthpayload {
    id?: number;
    email: string,
    password: string;
    election_date: string;
    election_start_time: string;
    election_end_time: string;
    voting_link: string;
    election_title: string,
    hide_result_link: boolean,
    has_sent_voters_auth_credential?: boolean;
}

export function voter_auth_template(payload: VoterAuthpayload ){

    const { email, password, election_title, election_date, election_end_time, election_start_time } = payload;

    const voting_link = `https://${payload.voting_link}`;

    const result_link = `https://${payload.voting_link}/results`;

    return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Modern HTML Email Template</title>

        <style type="text/css">
          body {
            margin: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont,
              "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans",
              "Helvetica Neue", sans-serif;
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

            <h3>${election_title.toUpperCase()}</h3>
            <p class="mini-text">
              This is to notify you that your accreditation process was successful. Below are your credentials to log in to the voters platform for the election, scheduled to come up on, ${election_date}, between
              ${election_start_time} and ${election_end_time}.
              <br />
              <br />
              Your login details
            </p>
            <p class="mini-text">
              <p> <strong>Email:</strong> <a href="#">${email}</a></p> 
              <p><strong>Password:</strong> ${password}</p> 
              <p><strong>Voting link:</strong> <a href="${voting_link}">${voting_link}</a></p> 
              ${ !payload.hide_result_link ? `<p><strong>Result link:</strong> <a href="${result_link}">${result_link}</a></p> ` : ""}
            </p>
            <div style="line-height: .6em; margin: 2em 0 2em 0;">
              <p>Thank you for choosing Smooth ballot</p>
              <span>The Smooth Team.</span>
            </div>
          </center>
        </div>
      </body>
    </html>

`;

}

