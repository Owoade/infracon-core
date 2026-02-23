import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`<a href="/auth/github">Login with GitHub</a>`);
});

// Step 1: Redirect user to GitHub for authorization
app.get("/auth/github", (req, res) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=read:user user:email`;
  res.redirect(redirectUrl);
});

// Step 2: GitHub redirects back with a code
app.get("/auth/github/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Code not provided");
  }

  try {
    // Step 3: Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return res.status(400).send("Failed to get access token");
    }

    // Optional: Get user info
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json({ accessToken, user: userResponse.data });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("GitHub OAuth failed");
  }
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});