import { google } from "googleapis";

export const getCalendarConfig = () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID,
    GOOGLE_TIMEZONE,
    GOOGLE_REDIRECT_URI,
  } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Missing Google OAuth credentials. Check the server .env file.");
  }
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Missing GOOGLE_CALENDAR_ID. Check the server .env file.");
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

export const getGoogleAuthClient = () => {
  const { clientId, clientSecret, refreshToken, redirectUri } = getCalendarConfig();
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
};

export const getCalendarClient = () =>
  google.calendar({ version: "v3", auth: getGoogleAuthClient() });

export const getPeopleClient = () =>
  google.people({ version: "v1", auth: getGoogleAuthClient() });
