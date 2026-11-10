"use client";

import { useState } from "react";
import { FaArrowRight, FaPaw } from "react-icons/fa";
import { DOG_REBOOK_MONTHS, SERVICE_PRICES } from "../../../lib/bookingConfig";
import { useCrm } from "./CrmProvider";
import { ContactLinks, StatusBadge } from "./CrmViews";
import Modal from "./Modal";
import { formatDate, formatMoney, formatTime, initials } from "./format";

export default function CustomerDialog({ customer, onClose }) {
  const { data, rebook, refresh, setNotice } = useCrm();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startEdit = (appointment) => { setError(""); setEdit({ ...appointment, amountPaid: appointment.amountPaid ?? "" }); };
  const update = (key, value) => setEdit((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/appointments/${encodeURIComponent(edit.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setEdit(null); setNotice("Appointment record saved."); await refresh();
    } catch (failure) { setError(failure.message || "Couldn't save the record. Please try again."); }
    finally { setBusy(false); }
  };
  return <Modal title={customer.name} eyebrow="CLIENT PROFILE" onClose={onClose} busy={busy} wide>
    <div className="crm-profile-contact"><span className="crm-owner-avatar crm-avatar-large" aria-hidden="true">{initials(customer.name)}</span><div><ContactLinks customer={customer} />{customer.emails.slice(1).map((email) => <a className="crm-block crm-text-link" key={email} href={`mailto:${email}`}>{email}</a>)}{customer.phones.slice(1).map((phone) => <a className="crm-block crm-text-link" key={phone} href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>)}<small>{customer.fromContacts ? "Linked to Google Contacts" : "From Google Calendar"}</small></div><button className="crm-button crm-small" onClick={() => rebook(customer, customer.dogs.length === 1 ? customer.dogs[0] : null)}>Rebook<FaArrowRight /></button></div>
    <div className="crm-profile-stats"><div><strong>{customer.pastBookings}</strong><span>Past bookings</span></div><div><strong>{customer.confirmedVisits}</strong><span>Confirmed attended</span></div><div><strong>{customer.paidBookingCount ? formatMoney(customer.totalPaid) : "—"}</strong><span>Recorded payments</span></div></div>
    {edit ? <form className="crm-form crm-edit-record" onSubmit={save}><h3>Update appointment record</h3><p>{formatDate(edit.start, data.timeZone)} · Internal details only. This won’t reschedule the appointment.</p><fieldset disabled={busy}><div className="crm-form-grid"><label>Dog’s name<input value={edit.dogName} maxLength={120} onChange={(event) => update("dogName", event.target.value)} /></label><label>Dog size<select value={edit.dogSize} onChange={(event) => update("dogSize", event.target.value)}><option value="">Not recorded</option>{Object.keys(DOG_REBOOK_MONTHS).map((size) => <option key={size}>{size}</option>)}</select></label><label>Service<select value={edit.service} onChange={(event) => update("service", event.target.value)}><option value="">Not recorded</option>{Object.keys(SERVICE_PRICES).map((service) => <option key={service}>{service}</option>)}</select></label>{Date.parse(edit.end) <= Date.now() && <><label>Attendance<select value={edit.attendance} onChange={(event) => update("attendance", event.target.value)}><option value="unconfirmed">Not confirmed</option><option value="attended">Attended</option><option value="no-show">No-show</option></select></label><label>Amount paid (NZD)<input type="number" min="0" max="10000" step="0.01" placeholder="Not recorded" value={edit.amountPaid} onChange={(event) => update("amountPaid", event.target.value)} /><small>Leave blank if unknown. Enter 0 for a free visit.</small></label></>}</div>{error && <p role="alert" className="crm-error">{error}</p>}<div className="crm-dialog-actions"><button type="button" className="crm-button crm-secondary crm-small" onClick={() => setEdit(null)}>Cancel</button><button className="crm-button crm-small">{busy ? "Saving…" : "Save record"}</button></div></fieldset></form> : <>
      <div className="crm-profile-section"><h3>The dogs</h3>{customer.dogs.length ? <div className="crm-dog-cards">{customer.dogs.map((dog) => <article key={dog.id} className="crm-dog-card"><div className="crm-dog-card-title"><FaPaw /><strong>{dog.name || "Name not recorded"}</strong><StatusBadge status={dog.status} /></div><p>{dog.size || "Size not recorded"}{dog.breed ? ` · ${dog.breed}` : ""}{dog.interval ? ` · Rebook every ${dog.interval} months` : ""}</p><dl><div><dt>Last groom</dt><dd>{formatDate(dog.lastBooking?.start, data.timeZone)}</dd></div><div><dt>{dog.nextBooking ? "Next booking" : "Next due"}</dt><dd>{formatDate(dog.nextBooking?.start || dog.dueDate, data.timeZone)}</dd></div></dl>{dog.notes && <p className="crm-preserve-lines">{dog.notes}</p>}<div className="crm-row-actions"><button className="crm-button crm-secondary crm-small" onClick={() => rebook(customer, dog)}>Rebook {dog.name || "dog"}</button>{dog.lastBooking && <button className="crm-text-button" onClick={() => startEdit(dog.lastBooking)}>Update details</button>}</div></article>)}</div> : <p>No dog details yet. Add them when you book the first groom.</p>}</div>
      <div className="crm-profile-section"><h3>Appointments & visit history</h3><p className="crm-help">Past bookings don’t prove attendance or payment. Confirm these in each record. Prices marked “quoted” aren’t counted as payments.</p>{customer.history.length ? <ol className="crm-history">{customer.history.map((appointment) => {
        const future = Date.parse(appointment.end) > Date.now();
        return <li key={appointment.id}><div className="crm-history-dot" /><div className="crm-history-content"><div className="crm-history-heading"><strong>{appointment.service || "Grooming appointment"}</strong><span className={`crm-badge ${future ? "crm-status-booked" : appointment.attendance === "no-show" ? "crm-status-overdue" : ""}`}>{future ? "Upcoming" : appointment.attendance === "attended" ? "Attended" : appointment.attendance === "no-show" ? "No-show" : "Past booking"}</span></div><p>{formatDate(appointment.start, data.timeZone)} · {formatTime(appointment.start, data.timeZone)} · {appointment.dogName || "Unnamed dog"} · {appointment.dogSize || "Size unknown"}</p><div className="crm-history-money"><span>{appointment.amountPaid !== null ? `${formatMoney(appointment.amountPaid)} paid` : "Payment not recorded"}</span>{appointment.quotedPrice !== null && <span>{formatMoney(appointment.quotedPrice)} quoted</span>}</div>{appointment.notes && <p className="crm-preserve-lines">{appointment.notes}</p>}{appointment.originalDetails && <details className="crm-original-details"><summary>Original booking form details</summary><p className="crm-preserve-lines">{appointment.originalDetails}</p></details>}<div className="crm-row-actions"><button className="crm-text-button" onClick={() => startEdit(appointment)}>Update record</button>{appointment.htmlLink && <a className="crm-text-link" href={appointment.htmlLink} target="_blank" rel="noreferrer">Open in Calendar ↗</a>}<small>{appointment.source}</small></div></div></li>;
      })}</ol> : <p>No booking history found for this contact.</p>}</div>
    </>}
  </Modal>;
}
