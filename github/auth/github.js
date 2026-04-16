import axios from "axios";
import jwt from "jsonwebtoken";
import fs from "fs";
import dotenv from "dotenv"

dotenv.configDotenv()

// ================= CONFIG =================
// const APP_ID = "2930353";
// const INSTALLATION_ID = "117520170";
const OWNER = "owoade"; // repo owner
const REPO = "SMOOTH-BALLOT-BE";  // repo name

// Fix newline issues if stored in .env
const formattedPrivateKey = fs.readFileSync("private-key.pem")

// ================= STEP 1: Generate JWT =================
function generateJWT() {
  return jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600, // 10 mins
      iss: APP_ID,
    },
    formattedPrivateKey,
    { algorithm: "RS256" }
  );
}

// ================= STEP 2: Get Installation Token =================
async function getInstallationToken() {
  // const jwtToken = generateJWT();

  // const res = await axios.post(
  //   `https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`,
  //   {},
  //   {
  //     headers: {
  //       Authorization: `Bearer ${jwtToken}`,
  //       Accept: "application/vnd.github+json",
  //     },
  //   }
  // );

  // return res.data.token;
  return process.env.GITHUB_PAT
}

// ================= STEP 3: Download Repo =================
async function downloadRepo(token) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/zipball`;

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const writer = fs.createWriteStream("repo.zip");

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function listRepositories(token) {
  console.log({token})
  const res = await axios.get(
    "https://api.github.com/user/repos",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        // Accept: "application/vnd.github+json",
      },
      params: {
        per_page: 100,
        sort: "pushed",
        direction: "desc"
      },
    }
  );

  // const repos = res.data.repositories;

  // console.log(`\n📦 Total repos: ${repos.length}\n`);

  // repos.forEach((repo, index) => {
  //   console.log(
  //     `${index + 1}. ${repo.full_name} | Private: ${repo.private}`
  //   );
  // });

  console.log(res.data)

  return res.data;
}

async function listOrganizations(token){
  const res = await axios.get(
    "https://api.github.com/organizations",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      }
    }
  )

  console.log(res.data)
}

// ================= RUN =================
(async () => {
  try {
    console.log("Getting installation token...");
    const token = await getInstallationToken();

    console.log("Downloading repo...");
    await downloadRepo(token);
    // await listRepositories(token)
    // await listOrganizations(token)


    console.log("✅ Repo downloaded as repo.zip");
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
})();