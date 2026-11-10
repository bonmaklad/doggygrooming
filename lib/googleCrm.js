import { buildCrm } from "./crm";
import { getCalendarClient, getCalendarConfig, getPeopleClient } from "./googleCalendar";

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

const readContacts = async () => {
  const people = getPeopleClient();
  let pageToken;
  const contacts = [];
  do {
    const response = await people.people.connections.list({
      resourceName: "people/me", pageSize: 1000, pageToken,
      personFields: "names,emailAddresses,phoneNumbers,memberships,metadata",
    });
    contacts.push(...(response.data.connections || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  const group = process.env.GOOGLE_CONTACT_GROUP;
  return group ? contacts.filter((contact) => contact.memberships?.some((membership) => membership.contactGroupMembership?.contactGroupResourceName === group)) : contacts;
};

export const loadGoogleCrm = async () => {
  const { timeZone } = getCalendarConfig();
  const [events, contacts] = await Promise.allSettled([readCalendarEvents(), readContacts()]);
  if (events.status === "rejected") throw events.reason;
  return {
    ...buildCrm({ events: events.value, contacts: contacts.status === "fulfilled" ? contacts.value : [], timeZone }),
    contactsConnected: contacts.status === "fulfilled",
    warnings: contacts.status === "rejected" ? ["Google Contacts could not be loaded. Calendar customers are shown. Enable the People API and reconnect Google with contacts.readonly access, then refresh."] : [],
    syncedAt: new Date().toISOString(),
  };
};
