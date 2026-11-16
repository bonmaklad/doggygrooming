import { DOG_SIZES, SERVICE_PRICES } from "./bookingConfig.js";
import { localDateKey, normalizeEmail, normalizePhone } from "./crm.js";
import { storeError, withRecordLock } from "./crmStore.js";
import { PAYMENT_METHODS } from "./crmConfig.js";

const unique = (items) => [...new Set(items.filter(Boolean))];
const text = (value, length = 120, multiline = false) => {
  if (typeof value !== "string" || value.length > length || (!multiline && /[\r\n]/.test(value))) throw storeError("Please check the details and text lengths.", 400);
  return value.trim();
};
export function validateSave(payload) {
  if (!payload || !/^[a-f0-9-]{36}$/i.test(payload.requestId || "") || typeof payload.recordRevision !== "string") throw storeError("Refresh and try saving again.", 400);
}
export function visitDetails(payload, appointment, timeZone, now = new Date()) {
  validateSave(payload);
  const dogName = text(payload.dogName);
  const breed = text(payload.breed || "");
  const notes = text(payload.notes || "", 4000, true);
  const dogSize = text(payload.dogSize || "");
  const service = text(payload.service || "");
  const amountPaid = payload.amountPaid === "" || payload.amountPaid === null ? null : Number(payload.amountPaid);
  const paymentMethod = text(payload.paymentMethod || "");
  const paymentDate = text(payload.paymentDate || "");
  const paymentReference = text(payload.paymentReference || "", 200);
  if ((dogSize && !DOG_SIZES.includes(dogSize)) || (service && !Object.hasOwn(SERVICE_PRICES, service)) ||
    !["unconfirmed", "attended", "no-show"].includes(payload.attendance) ||
    (amountPaid !== null && (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > 10000 || Math.abs(amountPaid * 100 - Math.round(amountPaid * 100)) > 0.00001)) ||
    (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) ||
    (paymentDate && (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || !Number.isFinite(Date.parse(paymentDate)) || new Date(paymentDate).toISOString().slice(0, 10) !== paymentDate || paymentDate > localDateKey(now, timeZone))) ||
    (amountPaid === null && (paymentMethod || paymentDate || paymentReference))) throw storeError("Check the payment amount, date, method, dog and service. Payment details require an amount.", 400);
  if (Date.parse(appointment.end) > now.getTime() && (amountPaid !== null || payload.attendance !== "unconfirmed")) throw storeError("Record attendance and payment after the appointment.", 400);
  return { dogName, dogSize, breed, service, notes, attendance: payload.attendance, amountPaid, paymentMethod, paymentDate, paymentReference };
}

export const clientRecord = (customer) => ({
  id: customer.id, contactResourceName: customer.contactResourceName || "", name: customer.name,
  email: customer.emails[0] || "", phone: customer.phones[0] || "", notes: customer.notes || "",
  emailAliases: customer.emailAliases || customer.emails, phoneAliases: customer.phoneAliases || customer.phones,
  contactSync: customer.contactSync || (customer.fromContacts ? "synced" : ""),
});

const editableValues = (values = [], replacement) => {
  // People field updates replace the complete list. Keep secondary values.
  const primary = values.findIndex((value) => value.metadata?.primary);
  const index = primary < 0 ? 0 : primary;
  const others = values.filter((_, position) => position !== index).map(({ value, type }) => ({ value, ...(type ? { type } : {}) }));
  return replacement ? [{ value: replacement, ...(values[index]?.type ? { type: values[index].type } : {}) }, ...others.filter((value) => value.value !== replacement)] : others;
};
export function contactChanges(person, profile) {
  return {
    etag: person.etag,
    metadata: { sources: (person.metadata?.sources || []).filter((source) => source.type === "CONTACT") },
    names: [{ unstructuredName: profile.name }],
    emailAddresses: editableValues(person.emailAddresses, profile.email),
    phoneNumbers: editableValues(person.phoneNumbers, profile.phone),
  };
}

export async function saveClient({ payload, customer, store, people, readContacts, contactGroup }) {
  validateSave(payload);
  const name = text(payload.name);
  const email = normalizeEmail(text(payload.email, 254));
  const phone = text(payload.phone, 50);
  const notes = text(payload.notes || "", 4000, true);
  if (!name || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (phone && !/^\+?[\d\s().-]{6,50}$/.test(phone)) || (!email && !phone)) throw storeError("Enter a name and a valid email address or phone number.", 400);
  return withRecordLock("contacts:business-account", async () => {
    const current = (await store.read("Clients")).find((row) => row.id === customer.id);
    const pendingId = `${payload.requestId}:pending`;
    const syncedId = `${payload.requestId}:synced`;
    const retry = current && [pendingId, syncedId].includes(current.revision);
    if (retry && ["name", "email", "phone", "notes"].some((key) => current[key] !== ({ name, email, phone, notes })[key])) throw storeError("This save ID was used for different details. Refresh and try again.");
    if (current?.revision === syncedId) return { ok: true, customerId: customer.id, contactsSynced: true };
    let currentPerson;
    if (customer.contactResourceName && !retry) {
      currentPerson = (await people.people.get({ resourceName: customer.contactResourceName, personFields: "names,emailAddresses,phoneNumbers,metadata" })).data;
      if (payload.contactVersion && payload.contactVersion !== currentPerson.etag) throw storeError("Google Contacts changed elsewhere. Refresh before saving.");
    }
    const pending = retry ? current : await store.save("Clients", {
      ...clientRecord(customer), name, email, phone, notes, contactSync: "pending",
      emailAliases: unique([...(customer.emailAliases || []), ...customer.emails, email]),
      phoneAliases: unique([...(customer.phoneAliases || []), ...customer.phones, phone]),
    }, payload.recordRevision, pendingId);
    try {
      let resourceName = pending.contactResourceName;
      if (!resourceName) {
        // Locate an ambiguously completed create before retrying it.
        const contacts = await readContacts();
        const tagged = contacts.filter((contact) => contact.userDefined?.some((field) => field.key === "cutAndCuddleClientId" && field.value === customer.id));
        const matching = tagged.length ? tagged : contacts.filter((contact) =>
          contact.emailAddresses?.some((value) => pending.emailAliases.includes(normalizeEmail(value.value))) ||
          contact.phoneNumbers?.some((value) => pending.phoneAliases.some((alias) => normalizePhone(alias) === normalizePhone(value.value))));
        if (matching.length > 1) throw storeError("Multiple Google Contacts match this customer. Review them before syncing.");
        resourceName = matching[0]?.resourceName;
      }
      if (resourceName) {
        const person = currentPerson || (await people.people.get({ resourceName, personFields: "names,emailAddresses,phoneNumbers,metadata" })).data;
        await people.people.updateContact({ resourceName, updatePersonFields: "names,emailAddresses,phoneNumbers", requestBody: contactChanges(person, pending) }, { retry: false });
      } else {
        const { data: person } = await people.people.createContact({ personFields: "names,emailAddresses,phoneNumbers,metadata,userDefined", requestBody: {
          names: [{ unstructuredName: name }], emailAddresses: email ? [{ value: email }] : [], phoneNumbers: phone ? [{ value: phone }] : [],
          userDefined: [{ key: "cutAndCuddleClientId", value: customer.id }],
          ...(contactGroup ? { memberships: [{ contactGroupMembership: { contactGroupResourceName: contactGroup } }] } : {}),
        } }, { retry: false });
        resourceName = person.resourceName;
      }
      await store.save("Clients", { ...pending, contactResourceName: resourceName, contactSync: "synced" }, pending.revision, syncedId);
      return { ok: true, customerId: customer.id, contactsSynced: true };
    } catch {
      return { ok: true, customerId: customer.id, contactsSynced: false, warning: "Details saved in Sheets. Google Contacts did not finish syncing. Refresh, then open Edit contact and save again to retry." };
    }
  });
}

export async function saveDog({ payload, customer, store }) {
  validateSave(payload);
  const existing = customer.dogs.find((dog) => dog.id === (payload.dogId || `dog:${payload.requestId}`));
  if (payload.dogId && !existing) throw storeError("This dog could not be found. Refresh and try again.", 404);
  const name = text(payload.name);
  const size = text(payload.size || "");
  if (!name || (size && !DOG_SIZES.includes(size))) throw storeError("Enter the dog's name and a valid size.", 400);
  const aliases = unique([...(existing?.aliases || []), existing?.name, name]);
  const overlaps = (dog) => dog.id !== existing?.id && [dog.name, ...(dog.aliases || [])].some((other) => aliases.some((alias) => alias.toLowerCase() === other.toLowerCase()));
  if (customer.dogs.some(overlaps)) throw storeError("Another dog already uses this name. Choose a distinct name to keep their histories separate.", 400);
  if (!customer.recordRevision) {
    // Keep dog links stable if a Calendar customer later becomes a Contact.
    try { await store.save("Clients", clientRecord(customer), "", `${payload.requestId}:client`); }
    catch (error) { if (error.status !== 409) throw error; }
  }
  const saved = await store.save("Dogs", { id: existing?.id || `dog:${payload.requestId}`, customerId: customer.id, customerName: customer.name, name, size,
    breed: text(payload.breed || ""), notes: text(payload.notes || "", 4000, true), aliases,
  }, payload.recordRevision, payload.requestId);
  return { ok: true, dogId: saved.id };
}
