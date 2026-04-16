import express from "express";
import dotenv from "dotenv";
import {
  getRepos,
  getBranches,
  downloadRepoZip
} from "./github.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Step 1: Redirect user to GitHub App install page
app.get("/auth/github", (req, res) => {
  const url = `https://github.com/apps/INFRACON/installations/new`;
  res.redirect(url);
});

// Step 2: GitHub redirects here after installation
app.get("/auth/github/callback", async (req, res) => {
  const { installation_id } = req.query;
  console.log(req.query, req.body)
  if (!installation_id) {
    return res.status(400).send("Missing installation_id");
  }

  res.send({
    message: "GitHub App installed successfully",
    installation_id,
  });
});

// Step 3: Get repos
app.get("/repos/:installationId", async (req, res) => {
  try {
    const repos = await getRepos(req.params.installationId);
    res.json(repos);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to fetch repos");
  }
});

// Step 4: Get branches
app.get("/branches/:installationId/:owner/:repo/:branch", async (req, res) => {
  try {
    const { installationId, owner, repo } = req.params;

    const branches = await getBranches(
      installationId,
      owner,
      repo
    );

    res.json(branches);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to fetch branches");
  }
});

app.get("/repo/download/:installationId/:owner/:repo/:branch", async (req, res)=>{
  console.log("in controller")
  const { installationId, owner, repo, branch } = req.params;
  const value = downloadRepoZip(installationId, owner, repo, branch)
  res.send(value)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});