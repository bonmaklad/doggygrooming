import { google } from "googleapis";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID,
  GOOGLE_TIMEZONE,
  GOOGLE_REDIRECT_URI,
} = process.env;

export const getCalendarConfig = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing Google OAuth credentials. Check .env.local.");
  }
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Missing GOOGLE_CALENDAR_ID. Check .env.local.");
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    refreshToken: GOOGLE_REFRESH_TOKEN,
    calendarId: GOOGLE_CALENDAR_ID,
    timeZone: GOOGLE_TIMEZONE || "Pacific/Auckland",
    redirectUri: GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
  };
};

export const getCalendarClient = () => {
  const { clientId, clientSecret, refreshToken, redirectUri } = getCalendarConfig();
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oAuth2Client });
};
