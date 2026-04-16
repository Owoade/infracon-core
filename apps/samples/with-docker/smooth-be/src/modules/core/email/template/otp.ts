import { capitalize_first_letter } from "@utils/capitalize_first_letter";

export function otp_template( name: string, otp: string, product?: string ){
    const logos = {
      "ticket": "https://res.cloudinary.com/dles2mycv/image/upload/v1768307547/streamline-color_tickets-flat_qr4tyj.png"
    }
    const logo = logos[product ?? ""] ?? "https://res.cloudinary.com/dles2mycv/image/upload/v1717850775/smooth-ballot-logo_2_mtiavw.png"
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <link
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
              src="${logo}"
              alt=""
            />

            <h3>OTP Verification</h3>
            <p class="mini-text">
              Hello ${capitalize_first_letter(name)},
              <br />
              <br />
              Here is your one-time OTP code:
            </p>
            <h2>${otp}</h2>
            <p class="stand-alone-text">
              Code expires in <strong>5 minutes</strong>. Please don’t share
              with anyone else.
            </p>
            <p class="stand-alone-text">
              If you didn't request this code, please ignore this message.
            </p>
          </center>
        </div>
      </body>
    </html>
  </head>
</html>

    `
}