import { DOG_SIZES, DOG_REBOOK_WEEKS, SERVICE_PRICES } from "./bookingConfig.js";

export const normalizeEmail = (value = "") => value.trim().toLowerCase();
export const normalizePhone = (value = "") => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0064")) return `64${digits.slice(4)}`;
  if (digits.startsWith("0")) return `64${digits.slice(1)}`;
  return digits;
};

export const localDateKey = (value, timeZone = "Pacific/Auckland") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const addCalendarDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const plainText = (value = "") => value
  .replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const readFields = (description) => {
  const fields = {};
  const lines = plainText(description).split(/\r?\n/).map((line) => line.trim());
  const pattern = /^(service|dog size|size|dog name|dog's name|owner|name|email|email address|phone|phone number|notes|price|amount paid|paid|breed|dog breed)\s*:\s*(.*)$/i;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    fields[match[1].toLowerCase()] = match[2] || (lines[i + 1] && !pattern.test(lines[i + 1]) ? lines[i + 1] : "");
    if (match[1].toLowerCase() === "notes") {
      // Website notes are last. Labels inside a customer's notes must never
      // override their actual identity, size or payment fields above.
      fields.notes = [match[2], ...lines.slice(i + 1)].filter(Boolean).join("\n");
      break;
    }
  }
  return fields;
};

const money = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = typeof value === "string" ? value.replace(/^(?:NZD\s*|NZ\$\s*|\$\s*)/i, "").replace(/,/g, "").trim() : value;
  if (cleaned === "" || !/^\d+(?:\.\d{1,2})?$/.test(String(cleaned))) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export const parseAppointment = (event) => {
  if (event.status === "cancelled" || !event.start?.dateTime || !event.end?.dateTime) return null;
  if (!Number.isFinite(Date.parse(event.start.dateTime)) || !Number.isFinite(Date.parse(event.end.dateTime))) return null;
  const fields = readFields(event.description);
  const meta = event.extendedProperties?.private || {};
  const attendees = event.attendees?.filter((person) => !person.organizer && !person.self && !person.resource) || [];
  const attendee = attendees.find((person) => person.email);
  const summary = event.summary || "";
  const service = meta.ccService ?? fields.service ?? Object.keys(SERVICE_PRICES).find((name) => summary.includes(name)) ?? "";
  const recognized = meta.ccBooking === "1" || fields["dog size"] || fields["dog name"] || fields["dog's name"] || service || attendee;
  if (!recognized) return null;
  const summaryDog = summary.split(/\s+—\s+/)[1]?.match(/^(.*?)\s*\((Small|Medium|Large)\)$/i);
  const rawSize = meta.ccDogSize ?? fields["dog size"] ?? fields.size ?? summaryDog?.[2] ?? "";
  const dogSize = DOG_SIZES.find((size) => rawSize.toLowerCase().startsWith(size.toLowerCase())) || "";
  const email = normalizeEmail(meta.ccEmail || fields.email || fields["email address"] || attendee?.email || "");
  const name = meta.ccOwner || fields.owner || fields.name || attendee?.displayName || summary.split(/\s+—\s+/)[2] || email || "Unnamed customer";
  return {
    id: event.id,
    calendarVersion: event.etag || "",
    name,
    email,
    phone: meta.ccPhone || fields.phone || fields["phone number"] || "",
    dogName: meta.ccDogName ?? fields["dog name"] ?? fields["dog's name"] ?? summaryDog?.[1] ?? "",
    dogSize,
    breed: meta.ccBreed ?? fields.breed ?? fields["dog breed"] ?? "",
    service,
    notes: meta.ccNotes ?? fields.notes ?? "",
    originalDetails: plainText(event.description || ""),
    start: event.start.dateTime,
    end: event.end.dateTime,
    htmlLink: event.htmlLink || "",
    amountPaid: money(meta.ccAmountPaid ?? fields["amount paid"] ?? fields.paid),
    quotedPrice: money(meta.ccQuotedPrice ?? fields.price),
    attendance: ["attended", "no-show"].includes(meta.ccAttendance) ? meta.ccAttendance : "unconfirmed",
    source: meta.ccSource === "admin" ? "Admin booking" : meta.ccBooking === "1" ? "Website booking" : "Google Calendar",
  };
};

export const buildCrm = ({ contacts = [], events = [], profiles = [], dogProfiles = [], appointmentRecords = [], now = new Date(), timeZone = "Pacific/Auckland" }) => {
  const today = localDateKey(now, timeZone);
  const savedVisits = new Map(appointmentRecords.map((record) => [record.id, record]));
  const appointments = events.map(parseAppointment).filter(Boolean).map((appointment) => {
    const saved = savedVisits.get(appointment.id);
    const updates = saved ? Object.fromEntries(["dogName", "dogSize", "breed", "service", "notes", "attendance", "amountPaid", "paymentMethod", "paymentDate", "paymentReference"].map((key) => [key, saved[key]])) : {};
    return { ...appointment, paymentMethod: "", paymentDate: "", paymentReference: "", ...updates, recordRevision: saved?.revision || "" };
  });
  const calendarVisitIds = new Set(appointments.map((appointment) => appointment.id));
  // A removed Calendar event must not erase a historical payment from the CRM.
  for (const saved of appointmentRecords) {
    if (!calendarVisitIds.has(saved.id) && Number.isFinite(Date.parse(saved.start)) && Number.isFinite(Date.parse(saved.end)) && Date.parse(saved.end) <= now.getTime()) {
      appointments.push({ ...saved, calendarVersion: "", recordRevision: saved.revision, quotedPrice: null, htmlLink: "", originalDetails: "", calendarMissing: true, source: "Saved visit · no longer in Calendar" });
    }
  }
  const unrecognized = events.filter((event) => event.status !== "cancelled" && event.start && !parseAppointment(event)).map((event) => ({
    id: event.id, summary: event.summary || "Untitled event", start: event.start.dateTime || event.start.date, htmlLink: event.htmlLink || "",
  }));
  const records = [
    ...profiles.map((profile) => ({ sourceId: profile.id, name: profile.name,
      emails: [...new Set([profile.email, ...(profile.emailAliases || [])].filter(Boolean).map(normalizeEmail))],
      phones: [...new Set([profile.phone, ...(profile.phoneAliases || [])].filter(Boolean))], profile })),
    ...contacts.filter((contact) => !contact.metadata?.deleted).map((contact) => ({
      sourceId: contact.resourceName,
      name: contact.names?.[0]?.displayName || "",
      emails: [...(contact.emailAddresses || [])].sort((a, b) => Number(Boolean(b.metadata?.primary)) - Number(Boolean(a.metadata?.primary))).map((email) => normalizeEmail(email.value)).filter(Boolean),
      phones: [...(contact.phoneNumbers || [])].sort((a, b) => Number(Boolean(b.metadata?.primary)) - Number(Boolean(a.metadata?.primary))).map((phone) => phone.value).filter(Boolean),
      contact,
    })),
    ...appointments.map((appointment) => ({ sourceId: `event:${appointment.id}`, name: appointment.name,
      emails: [appointment.email].filter(Boolean), phones: [appointment.phone].filter(Boolean), appointment })),
  ];
  // Union by every email/phone, so a contact with several addresses joins its full history.
  // Never merge on a name alone: two owners can have the same name.
  const parents = records.map((_, index) => index);
  const root = (index) => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  const identities = new Map();
  records.forEach((record, index) => {
    const keys = [`source:${record.sourceId}`, ...(record.profile?.contactResourceName ? [`source:${record.profile.contactResourceName}`] : []), ...record.emails.map((email) => `email:${email}`), ...record.phones.map(normalizePhone).filter(Boolean).map((phone) => `phone:${phone}`)];
    keys.forEach((key) => {
      if (identities.has(key)) parents[root(index)] = root(identities.get(key));
      else identities.set(key, index);
    });
  });
  const groups = new Map();
  records.forEach((record, index) => { const key = root(index); groups.set(key, [...(groups.get(key) || []), record]); });
  const customers = [...groups.values()].map((group) => {
    const history = group.flatMap((record) => record.appointment ? [record.appointment] : []);
    // ISO strings may have different offsets. Sort by actual instants.
    history.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
    const contact = group.find((record) => record.contact);
    const profile = group.find((record) => record.profile)?.profile;
    const emailAliases = [...new Set(group.flatMap((record) => record.emails))];
    const phoneAliases = [...new Map(group.flatMap((record) => record.phones).map((phone) => [normalizePhone(phone), phone])).values()];
    const useContact = contact && profile?.contactSync !== "pending";
    const emails = profile ? (useContact ? contact.emails : [profile.email].filter(Boolean)) : emailAliases;
    const phones = profile ? (useContact ? contact.phones : [profile.phone].filter(Boolean)) : phoneAliases;
    const id = profile?.id || contact?.sourceId || [...emails].sort()[0] || phones.map(normalizePhone).sort()[0] || group[0].sourceId;
    const past = history.filter((item) => Date.parse(item.end) <= now.getTime() && item.attendance !== "no-show");
    const upcoming = history.filter((item) => Date.parse(item.end) > now.getTime()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const dogGroups = new Map();
    const savedDogs = dogProfiles.filter((dog) => dog.customerId === id);
    history.forEach((item) => {
      const saved = savedDogs.find((dog) => [dog.name, ...(dog.aliases || [])].some((name) => name.trim().toLowerCase() === item.dogName.trim().toLowerCase()));
      const key = saved?.id || item.dogName.trim().toLowerCase() || "__unknown__";
      dogGroups.set(key, [...(dogGroups.get(key) || []), item]);
    });
    savedDogs.forEach((dog) => { if (!dogGroups.has(dog.id)) dogGroups.set(dog.id, []); });
    const dogs = [...dogGroups.entries()].map(([key, bookings]) => {
      const saved = savedDogs.find((dog) => dog.id === key);
      const latest = bookings[0] || {};
      const name = saved?.name ?? latest.dogName ?? "";
      const last = bookings.find((item) => Date.parse(item.end) <= now.getTime() && item.attendance !== "no-show");
      const next = upcoming.find((item) => bookings.includes(item));
      const size = saved?.size ?? bookings.find((item) => item.dogSize)?.dogSize ?? "";
      const interval = DOG_REBOOK_WEEKS;
      const dueDate = last && interval && name.trim() ? addCalendarDays(localDateKey(last.start, timeZone), interval * 7) : null;
      return { id: saved?.id || `${id}:${key}`, name, size, breed: saved?.breed ?? bookings.find((item) => item.breed)?.breed ?? "",
        recordRevision: saved?.revision || "", aliases: saved?.aliases || [name],
        interval, lastBooking: last || null, nextBooking: next || null, dueDate,
        status: !name.trim() ? "needs-details" : next ? "booked" : !dueDate ? "needs-details" : dueDate < today ? "overdue" : dueDate.slice(0, 7) === today.slice(0, 7) ? "this-month" : "later",
        service: bookings.find((item) => item.service)?.service || "", notes: saved?.notes ?? latest.notes ?? "" };
    });
    const recorded = history.filter((item) => Date.parse(item.end) <= now.getTime() && item.amountPaid !== null);
    return { id, name: (useContact ? contact.name : profile?.name) || contact?.name || history[0]?.name || emails[0] || phones[0] || "Unnamed customer",
      recordRevision: profile?.revision || "", notes: profile?.notes || "", contactSync: profile?.contactSync || "",
      active: profile?.status !== "inactive",
      groomPrice: profile?.groomPrice ?? null,
      contactResourceName: contact?.sourceId || profile?.contactResourceName || "", contactVersion: contact?.contact?.etag || "",
      emailAliases, phoneAliases,
      emails, phones, fromContacts: Boolean(contact), dogs, history, upcoming,
      pastBookings: past.length, confirmedVisits: past.filter((item) => item.attendance === "attended").length,
      totalPaid: recorded.reduce((sum, item) => sum + Math.round(item.amountPaid * 100), 0) / 100, paidBookingCount: recorded.length,
      lastBooking: past[0] || null };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { customers, unrecognized, today, timeZone };
};

// All Due view filters and counts use the same active-customer list.
export const followUpRows = (customers) => customers.filter((customer) => customer.active !== false)
  .flatMap((customer) => customer.dogs.map((dog) => ({ customer, dog })))
  .sort((a, b) => (a.dog.dueDate || "9999").localeCompare(b.dog.dueDate || "9999") || a.customer.name.localeCompare(b.customer.name));
