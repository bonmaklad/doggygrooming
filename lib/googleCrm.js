import { buildCrm } from "./crm.js";
import { getCalendarClient, getCalendarConfig, getPeopleClient, getSheetsClient } from "./googleCalendar.js";
import { createCrmStore } from "./crmStore.js";

export const getCrmStore = () => createCrmStore(getSheetsClient(), process.env.GOOGLE_SPREADSHEET_ID);

export const readCalendarEvents = async () => {
  const { calendarId, timeZone } = getCalendarConfig();
  const calendar = getCalendarClient();
  const events = [];
  let pageToken;
  // Bound recurring expansion, while retaining all historical bookings.
  const timeMax = new Date();
  timeMax.setUTCFullYear(timeMax.getUTCFullYear() + 2);
  do {
    const response = await calendar.events.list({
      calendarId, timeZone, maxResults: 2500, singleEvents: true,
      showDeleted: false, orderBy: "startTime", timeMax: timeMax.toISOString(), pageToken,
    });
    events.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return events;
};

export const readContacts = async () => {
  const people = getPeopleClient();
  let pageToken;
  const contacts = [];
  do {
    const response = await people.people.connections.list({
      resourceName: "people/me", pageSize: 1000, pageToken,
      personFields: "names,emailAddresses,phoneNumbers,memberships,metadata,userDefined",
    });
    contacts.push(...(response.data.connections || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  const group = process.env.GOOGLE_CONTACT_GROUP;
  return group ? contacts.filter((contact) => contact.memberships?.some((membership) => membership.contactGroupMembership?.contactGroupResourceName === group)) : contacts;
};

export const loadGoogleCrm = async () => {
  const { calendarId, timeZone } = getCalendarConfig();
  const sheetsConfigured = Boolean(process.env.GOOGLE_SPREADSHEET_ID);
  const [events, contacts, records] = await Promise.allSettled([readCalendarEvents(), readContacts(), sheetsConfigured ? getCrmStore().readAll() : Promise.resolve({})]);
  if (events.status === "rejected") throw events.reason;
  // Do not substitute old Calendar payment amounts when the authoritative sheet
  // is unavailable; the admin must know those records could not be loaded.
  if (records.status === "rejected") throw records.reason;
  const stored = records.value;
  const warnings = contacts.status === "rejected" ? ["Google Contacts could not be loaded. Calendar and saved customers are shown. Enable the People API and reconnect Google with Contacts access, then refresh."] : [];
  if (!sheetsConfigured) warnings.push("Connect the records spreadsheet to save client details, dog profiles and payments.");
  return {
    ...buildCrm({ events: events.value, contacts: contacts.status === "fulfilled" ? contacts.value : [], ...stored, appointmentRecords: stored.appointmentRecords?.filter((record) => record.calendarId === calendarId), timeZone }),
    contactsConnected: contacts.status === "fulfilled",
    sheetsConnected: sheetsConfigured,
    spreadsheetUrl: sheetsConfigured ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}/edit` : null,
    warnings,
    syncedAt: new Date().toISOString(),
  };
};
