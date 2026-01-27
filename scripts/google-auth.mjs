import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { google } from "googleapis";

const defaultSecretPath = path.join(process.cwd(), "client_secret.json");
const secretPath = process.argv[2] || defaultSecretPath;
const redirectUri =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";
const scopes = ["https://www.googleapis.com/auth/calendar"];

const loadClientConfig = async () => {
  const raw = await fs.readFile(secretPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.web || parsed.installed;
};

const promptForCode = () =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Paste the code from the URL here: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

const main = async () => {
  const config = await loadClientConfig();
  if (!config?.client_id || !config?.client_secret) {
    throw new Error(
      "client_id/client_secret missing. Make sure client_secret.json contains OAuth credentials."
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  console.log("Open this URL in your browser:");
  console.log(authUrl);
  console.log("");
  console.log("After approving, you will be redirected to the redirect URI.");
  console.log("Copy the `code` parameter from the URL and paste it here.");

  const code = await promptForCode();
  const { tokens } = await oAuth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.warn(
      "No refresh_token returned. Try removing previous approvals or ensure prompt=consent."
    );
  }

  console.log("");
  console.log("Refresh token:");
  console.log(tokens.refresh_token || "");
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
