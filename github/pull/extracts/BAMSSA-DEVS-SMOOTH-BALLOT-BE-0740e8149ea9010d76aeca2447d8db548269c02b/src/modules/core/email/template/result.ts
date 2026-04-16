export interface SendResultPayload {
    email: string;
    name: string,
    election_title: string,
    result_link: string
}

export function result_template( payload: SendResultPayload ){
    const { name, election_title, result_link } = payload;
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Election Results Available</title>
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
          src="https://res.cloudinary.com/dles2mycv/image/upload/v1717850775/smooth-ballot-logo_2_mtiavw.png"
          alt="Smooth Ballot Logo"
        />
        <h3>Election Results Ready</h3>
        <p class="mini-text">
          Hello ${name},
          <br />
          <br />
          The results for ${election_title} election are now available. You can
          view the detailed results by clicking the link below:
        </p>
        <a href="${result_link}" class="button">View Results</a>
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