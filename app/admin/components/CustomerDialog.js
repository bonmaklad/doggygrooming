"use client";

import { useState } from "react";
import { FaArrowRight, FaPaw } from "react-icons/fa";
import { DOG_SIZES, SERVICE_PRICES } from "../../../lib/bookingConfig";
import { PAYMENT_METHODS } from "../../../lib/crmConfig";
import { useCrm } from "./CrmProvider";
import { ContactLinks, StatusBadge } from "./CrmViews";
import Modal from "./Modal";
import { formatDate, formatMoney, formatTime, initials } from "./format";

export default function CustomerDialog({ customer, onClose }) {
  const { data, rebook, refresh, setNotice, error: refreshError } = useCrm();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canSave = data.sheetsConnected && !refreshError;
  const begin = (kind, values) => { setError(""); setEdit({ ...values, kind, requestId: crypto.randomUUID(), customerId: customer.id }); };
  const startEdit = (appointment) => begin("visit", { ...appointment, amountPaid: appointment.amountPaid ?? "" });
  const editContact = () => begin("client", { name: customer.name, email: customer.emails[0] || "", phone: customer.phones[0] || "", notes: customer.notes, recordRevision: customer.recordRevision, contactVersion: customer.contactVersion });
  const editDog = (dog) => begin("dog", { dogId: dog?.id || "", name: dog?.name || "", size: dog?.size || "", breed: dog?.breed || "", notes: dog?.notes || "", recordRevision: dog?.recordRevision || "" });
  const update = (key, value) => setEdit((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const url = edit.kind === "visit" ? `/api/admin/appointments/${encodeURIComponent(edit.id)}` : edit.kind === "client" ? "/api/admin/clients" : "/api/admin/dogs";
      const response = await fetch(url, { method: edit.kind === "dog" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setEdit(null); setNotice(body.warning || (edit.kind === "client" ? "Customer details saved and synced to Google Contacts." : edit.kind === "dog" ? "Dog profile saved." : "Appointment record saved.")); await refresh();
    } catch (failure) { setError(failure.message || "Couldn't save the record. Please try again."); }
    finally { setBusy(false); }
  };
  const sizeField = (key) => <label>Dog size<select value={edit[key]} onChange={(event) => update(key, event.target.value)}><option value="">Not recorded</option>{DOG_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>;
  return <Modal title={customer.name} eyebrow="CLIENT PROFILE" onClose={onClose} busy={busy} wide>
    <div className="crm-profile-contact"><span className="crm-owner-avatar crm-avatar-large" aria-hidden="true">{initials(customer.name)}</span><div><ContactLinks customer={customer} />{customer.emails.slice(1).map((email) => <a className="crm-block crm-text-link" key={email} href={`mailto:${email}`}>{email}</a>)}{customer.phones.slice(1).map((phone) => <a className="crm-block crm-text-link" key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>)}<small>{customer.contactSync === "pending" ? "Google Contacts sync needs retry" : customer.fromContacts ? "Linked to Google Contacts" : "From Google Calendar"}</small></div><button className="crm-button crm-small" onClick={() => rebook(customer, customer.dogs.length === 1 ? customer.dogs[0] : null)}>Rebook<FaArrowRight /></button></div>
    <div className="crm-row-actions"><button className="crm-text-button" disabled={!canSave || busy} onClick={editContact}>Edit contact</button><button className="crm-text-button" disabled={!canSave || busy} onClick={() => editDog(null)}>Add dog</button></div>
    {customer.notes && <p className="crm-preserve-lines">{customer.notes}</p>}
    {customer.contactSync === "pending" && <p role="status" className="crm-warning">The latest details are saved in Sheets. Open Edit contact and save again to retry Google Contacts.</p>}
    <div className="crm-profile-stats"><div><strong>{customer.pastBookings}</strong><span>Past bookings</span></div><div><strong>{customer.confirmedVisits}</strong><span>Confirmed attended</span></div><div><strong>{customer.paidBookingCount ? formatMoney(customer.totalPaid) : "—"}</strong><span>Recorded payments</span></div></div>
    {edit ? <form className="crm-form crm-edit-record" onSubmit={save}>
      <h3>{edit.kind === "client" ? "Edit customer contact" : edit.kind === "dog" ? (edit.dogId ? "Edit dog profile" : "Add a dog") : "Update appointment record"}</h3>
      <p>{edit.kind === "client" ? "Name, email and phone sync to Google Contacts. Staff notes stay in the records spreadsheet." : edit.kind === "dog" ? "Dog details are saved for future visits and rebooking reminders." : `${formatDate(edit.start, data.timeZone)} · Internal details only. This won’t reschedule the appointment.`}</p>
      <fieldset disabled={busy || !canSave}><div className="crm-form-grid">
        {edit.kind === "client" ? <>
          <label>Customer name<input required value={edit.name} maxLength={120} onChange={(event) => update("name", event.target.value)} /></label>
          <label>Email<input type="email" value={edit.email} maxLength={254} onChange={(event) => update("email", event.target.value)} /></label>
          <label>Phone<input type="tel" value={edit.phone} maxLength={50} onChange={(event) => update("phone", event.target.value)} /></label>
        </> : <>
          <label>Dog’s name<input required={edit.kind === "dog"} value={edit.kind === "dog" ? edit.name : edit.dogName} maxLength={120} onChange={(event) => update(edit.kind === "dog" ? "name" : "dogName", event.target.value)} /></label>
          {sizeField(edit.kind === "dog" ? "size" : "dogSize")}
          <label>Breed<input value={edit.breed || ""} maxLength={120} onChange={(event) => update("breed", event.target.value)} /></label>
        </>}
        {edit.kind === "visit" && <>
          <label>Service<select value={edit.service} onChange={(event) => update("service", event.target.value)}><option value="">Not recorded</option>{Object.keys(SERVICE_PRICES).map((service) => <option key={service}>{service}</option>)}</select></label>
          {Date.parse(edit.end) <= Date.now() && <>
            <label>Attendance<select value={edit.attendance} onChange={(event) => update("attendance", event.target.value)}><option value="unconfirmed">Not confirmed</option><option value="attended">Attended</option><option value="no-show">No-show</option></select></label>
            <label>Total amount paid (NZD)<input type="number" min="0" max="10000" step="0.01" placeholder="Not recorded" value={edit.amountPaid} onChange={(event) => update("amountPaid", event.target.value)} /><small>Leave blank if unknown. Enter 0 for a free visit. This records payment; it does not charge the customer.</small></label>
            <label>Payment method<select value={edit.paymentMethod || ""} onChange={(event) => update("paymentMethod", event.target.value)}><option value="">Not recorded</option>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
            <label>Payment date<input type="date" max={data.today} value={edit.paymentDate || ""} onChange={(event) => update("paymentDate", event.target.value)} /></label>
            <label>Payment reference<input value={edit.paymentReference || ""} maxLength={200} onChange={(event) => update("paymentReference", event.target.value)} /><small>A receipt or bank reference, never card or bank account details.</small></label>
          </>}
        </>}
        <label className="crm-field-wide">{edit.kind === "client" ? "Staff notes" : "Grooming notes"}<textarea rows={3} value={edit.notes || ""} maxLength={4000} onChange={(event) => update("notes", event.target.value)} /></label>
      </div>{error && <p role="alert" className="crm-error">{error}</p>}<div className="crm-dialog-actions"><button type="button" className="crm-button crm-secondary crm-small" onClick={() => setEdit(null)}>Cancel</button><button className="crm-button crm-small">{busy ? "Saving…" : edit.kind === "client" ? "Save & sync contact" : "Save record"}</button></div></fieldset>
      {!canSave && <p role="alert" className="crm-error">Refresh your Google records before saving.</p>}
    </form> : <>
      <div className="crm-profile-section"><h3>The dogs</h3>{customer.dogs.length ? <div className="crm-dog-cards">{customer.dogs.map((dog) => <article key={dog.id} className="crm-dog-card"><div className="crm-dog-card-title"><FaPaw /><strong>{dog.name || "Name not recorded"}</strong><StatusBadge status={dog.status} /></div><p>{dog.size || "Size not recorded"}{dog.breed ? ` · ${dog.breed}` : ""}{dog.interval ? ` · Rebook every ${dog.interval} weeks` : ""}</p><dl><div><dt>Last groom</dt><dd>{formatDate(dog.lastBooking?.start, data.timeZone)}</dd></div><div><dt>{dog.nextBooking ? "Next booking" : "Next due"}</dt><dd>{formatDate(dog.nextBooking?.start || dog.dueDate, data.timeZone)}</dd></div></dl>{dog.notes && <p className="crm-preserve-lines">{dog.notes}</p>}<div className="crm-row-actions"><button className="crm-button crm-secondary crm-small" onClick={() => rebook(customer, dog)}>Rebook {dog.name || "dog"}</button><button className="crm-text-button" disabled={!canSave} onClick={() => editDog(dog)}>Edit dog</button></div></article>)}</div> : <p>No dog details yet. Add a dog to keep their details ready for booking.</p>}</div>
      <div className="crm-profile-section"><h3>Appointments & visit history</h3><p className="crm-help">Past bookings don’t prove attendance or payment. Confirm these in each record. Prices marked “quoted” aren’t counted as payments.</p>{customer.history.length ? <ol className="crm-history">{customer.history.map((appointment) => {
        const future = Date.parse(appointment.end) > Date.now();
        return <li key={appointment.id}><div className="crm-history-dot" /><div className="crm-history-content"><div className="crm-history-heading"><strong>{appointment.service || "Grooming appointment"}</strong><span className={`crm-badge ${future ? "crm-status-booked" : appointment.attendance === "no-show" ? "crm-status-overdue" : ""}`}>{future ? "Upcoming" : appointment.attendance === "attended" ? "Attended" : appointment.attendance === "no-show" ? "No-show" : "Past booking"}</span></div><p>{formatDate(appointment.start, data.timeZone)} · {formatTime(appointment.start, data.timeZone)} · {appointment.dogName || "Unnamed dog"} · {appointment.dogSize || "Size unknown"}</p><div className="crm-history-money"><span>{appointment.amountPaid !== null ? `${formatMoney(appointment.amountPaid)} paid` : "Payment not recorded"}</span>{appointment.quotedPrice !== null && <span>{formatMoney(appointment.quotedPrice)} quoted</span>}</div>{(appointment.paymentMethod || appointment.paymentDate || appointment.paymentReference) && <p>{[appointment.paymentMethod, appointment.paymentDate && formatDate(appointment.paymentDate, data.timeZone), appointment.paymentReference].filter(Boolean).join(" · ")}</p>}{appointment.notes && <p className="crm-preserve-lines">{appointment.notes}</p>}{appointment.originalDetails && <details className="crm-original-details"><summary>Original booking form details</summary><p className="crm-preserve-lines">{appointment.originalDetails}</p></details>}<div className="crm-row-actions"><button className="crm-text-button" disabled={!canSave} onClick={() => startEdit(appointment)}>Update record</button>{appointment.htmlLink && <a className="crm-text-link" href={appointment.htmlLink} target="_blank" rel="noreferrer">Open in Calendar ↗</a>}<small>{appointment.source}</small></div></div></li>;
      })}</ol> : <p>No booking history found for this contact.</p>}</div>
    </>}
  </Modal>;
}
