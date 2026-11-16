import fs from "node:fs/promises";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { google } from "googleapis";

const repo = process.cwd();
const secretPath = process.argv[2] || path.join(repo, "client_secret.json");
const expectedEmail = "cutandcuddle01@gmail.com";
const redirectUri = "http://localhost:3001/oauth2callback";
const requiredScopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/drive.file",
];

if (!secretPath) throw new Error("Supply the downloaded OAuth client JSON file path.");
const raw = JSON.parse(await fs.readFile(secretPath, "utf8"));
const config = raw.web || raw.installed;
if (!config?.client_id?.startsWith("211915015937-") || !config?.client_secret) {
  throw new Error("The credentials must be from the new cutandcuddle project.");
}
const auth = new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
const state = crypto.randomBytes(32).toString("base64url");
const { codeVerifier, codeChallenge } = await auth.generateCodeVerifierAsync();
let processing = false;
let timer;

const server = http.createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const url = new URL(request.url, redirectUri);
  const send = (status, title, message) => {
    response.writeHead(status);
    response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:650px;margin:12vh auto;padding:24px;background:#f9f7f4;color:#3c3a38"><h1>${title}</h1><p>${message}</p></body></html>`);
  };
  if (url.pathname !== "/oauth2callback" || request.method !== "GET") return send(404, "Not found", "Use the Google connection link provided for this session.");
  if (url.searchParams.get("state") !== state) return send(400, "Connection not accepted", "This callback does not match the active connection session.");
  if (processing) return send(409, "Already processing", "The Google connection is already being checked.");
  if (url.searchParams.has("error")) return send(400, "Connection not approved", "Google access was not granted. Return to the connection link to try again.");
  const code = url.searchParams.get("code");
  if (!code) return send(400, "Missing approval", "Google did not return an authorisation code.");
  processing = true;
  try {
    const { tokens } = await auth.getToken({ code, codeVerifier, redirect_uri: redirectUri });
    if (!tokens.refresh_token || !tokens.id_token) throw new Error("Google did not issue the required offline access and account identity.");
    auth.setCredentials(tokens);
    const ticket = await auth.verifyIdToken({ idToken: tokens.id_token, audience: config.client_id });
    const identity = ticket.getPayload();
    if (!identity?.email_verified || identity.email?.toLowerCase() !== expectedEmail) {
      throw new Error("The authorised Google account is not cutandcuddle01@gmail.com. No credentials were saved.");
    }
    const granted = new Set((tokens.scope || "").split(" "));
    for (const scope of requiredScopes.filter(value => value.startsWith("https://"))) {
      if (!granted.has(scope)) throw new Error("A required Google permission was not granted. No credentials were saved.");
    }
    const calendar = google.calendar({ version: "v3", auth });
    const [entry, metadata, availability] = await Promise.all([
      calendar.calendarList.get({ calendarId: expectedEmail }),
      calendar.calendars.get({ calendarId: expectedEmail }),
      calendar.freebusy.query({ requestBody: { timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 7 * 86400000).toISOString(), timeZone: "Pacific/Auckland", items: [{ id: expectedEmail }] } }),
    ]);
    if (!["owner", "writer"].includes(entry.data.accessRole)) throw new Error("The connected account does not have write access to the grooming calendar.");
    if (metadata.data.id !== expectedEmail) throw new Error("Google returned an unexpected calendar.");
    if (!availability.data.calendars?.[expectedEmail] || availability.data.calendars[expectedEmail].errors?.length) throw new Error("Calendar availability could not be verified.");
    await google.people({ version: "v1", auth }).people.connections.list({ resourceName: "people/me", personFields: "names", pageSize: 1 });
    const refreshCheck = new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
    refreshCheck.setCredentials({ refresh_token: tokens.refresh_token });
    await refreshCheck.getAccessToken();
    const values = {
      GOOGLE_CLIENT_ID: config.client_id,
      GOOGLE_CLIENT_SECRET: config.client_secret,
      GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
      GOOGLE_REDIRECT_URI: redirectUri,
      GOOGLE_CALENDAR_ID: expectedEmail,
      GOOGLE_TIMEZONE: "Pacific/Auckland",
    };
    const existing = await fs.readFile(`${repo}/.env.google-connect`, "utf8").catch(() => "");
    const sheetLine = existing.match(/^GOOGLE_SPREADSHEET_ID=(.+)$/m);
    if (sheetLine) values.GOOGLE_SPREADSHEET_ID = JSON.parse(sheetLine[1]);
    const env = Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n";
    await fs.writeFile(`${repo}/.env.google-connect`, env, { mode: 0o600 });
    await fs.chmod(`${repo}/.env.google-connect`, 0o600);
    console.log(JSON.stringify({ result: "verified", authorisedAccount: identity.email, calendarId: metadata.data.id, calendarName: metadata.data.summary, accessRole: entry.data.accessRole, calendarTimeZone: metadata.data.timeZone, availabilityRead: true, contactsRead: true, grantedScopes: [...granted], refreshTokenVerified: true, credentialsFile: `${repo}/.env.google-connect` }));
    send(200, "Google services connected", "Verified cutandcuddle01@gmail.com, the grooming calendar and Google Contacts. The credentials for Calendar, Contacts and the app-created records spreadsheet are saved locally. The HIVE website still needs to be updated and checked.");
    clearTimeout(timer);
    server.close();
  } catch (error) {
    const googleError = error.response?.data?.error;
    const message = googleError ? "Google rejected a connection check. Check API activation and granted permissions." : error.message;
    console.error(JSON.stringify({ result: "failed", message, googleError: typeof googleError === "string" ? googleError : googleError?.status }));
    send(400, "Connection needs attention", "The account or calendar checks did not pass. No verified credentials were saved. Return to Codex for the check result.");
    clearTimeout(timer);
    server.close();
  }
});

server.listen(3001, "127.0.0.1", () => {
  console.log(auth.generateAuthUrl({ access_type: "offline", prompt: "consent", login_hint: expectedEmail, scope: requiredScopes, state, code_challenge: codeChallenge, code_challenge_method: "S256" }));
});
server.on("error", error => { console.error(error.code || "Callback server failed"); process.exitCode = 1; });
timer = setTimeout(() => { console.error("Connection session expired. Restart the helper to try again."); server.close(); }, 30 * 60 * 1000);
