"use client";

import { useMemo, useState } from "react";
import { FaArrowRight, FaCalendarAlt, FaCheck, FaClock, FaEnvelope, FaPaw, FaPhone, FaSearch, FaUsers } from "react-icons/fa";
import { localDateKey } from "../../../lib/crm";
import { useCrm } from "./CrmProvider";
import { formatDate, formatMoney, formatTime, initials, monthsSince } from "./format";

const statusLabels = { overdue: "Overdue", "this-month": "Due this month", later: "Coming up", booked: "Booked in", "needs-details": "Needs details" };
export function StatusBadge({ status }) { return <span className={`crm-badge crm-status-${status}`}>{status === "booked" && <FaCheck />}{statusLabels[status] || status}</span>; }

function SearchField({ value, onChange }) {
  return <label className="crm-search"><FaSearch /><span className="crm-sr-only">Search clients, dogs, email or phone</span><input type="search" placeholder="Search clients, dogs, email or phone…" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

const matches = (customer, query, dog = null) => [customer.name, ...customer.emails, ...customer.phones, ...(dog ? [dog.name, dog.size] : customer.dogs.flatMap((item) => [item.name, item.size]))].join(" ").toLowerCase().includes(query.toLowerCase().trim());

export function ContactLinks({ customer }) {
  return <div className="crm-contact-links">{customer.emails[0] ? <a href={`mailto:${customer.emails[0]}`}><FaEnvelope />{customer.emails[0]}</a> : <span>No email recorded</span>}{customer.phones[0] ? <a href={`tel:${customer.phones[0].replace(/[^+\d]/g, "")}`}><FaPhone />{customer.phones[0]}</a> : <span>No phone recorded</span>}</div>;
}

function EmptyState({ title, children }) {
  return <div className="crm-empty"><span className="crm-empty-icon"><FaPaw /></span><h3>{title}</h3><p>{children}</p></div>;
}

function PageHeading({ eyebrow, title, children, aside }) {
  return <div className="crm-page-heading"><div><div className="crm-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{children}</p></div>{aside}</div>;
}

export function DueView() {
  const { data, rebook, openCustomer } = useCrm();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("needs-rebooking");
  const [month, setMonth] = useState("");
  const rows = useMemo(() => data.customers.flatMap((customer) => customer.dogs.map((dog) => ({ customer, dog }))).sort((a, b) => (a.dog.dueDate || "9999").localeCompare(b.dog.dueDate || "9999") || a.customer.name.localeCompare(b.customer.name)), [data]);
  const counts = { overdue: rows.filter(({ dog }) => dog.status === "overdue").length, "this-month": rows.filter(({ dog }) => dog.status === "this-month").length, booked: rows.filter(({ dog }) => dog.status === "booked").length, "needs-details": rows.filter(({ dog }) => dog.status === "needs-details").length };
  const visible = rows.filter(({ customer, dog }) => {
    const statusMatches = filter === "all" || (filter === "needs-rebooking" ? ["overdue", "this-month"].includes(dog.status) : dog.status === filter);
    return statusMatches && matches(customer, query, dog) && (!month || dog.dueDate?.startsWith(month));
  });
  const tabs = [{ key: "needs-rebooking", label: "Needs rebooking", count: counts.overdue + counts["this-month"] }, { key: "overdue", label: "Overdue", count: counts.overdue }, { key: "this-month", label: "This month", count: counts["this-month"] }, { key: "later", label: "Later" }, { key: "booked", label: "Booked in", count: counts.booked }, { key: "needs-details", label: "Needs details", count: counts["needs-details"] }, { key: "all", label: "All dogs", count: rows.length }];
  return <>
    <PageHeading eyebrow="A LITTLE FOLLOW-UP GOES A LONG WAY" title="Time for a fresh trim." aside={<span className="crm-month-label"><FaCalendarAlt />{formatDate(data.today, data.timeZone, { month: "long", day: undefined, year: "numeric" })}</span>}>Your grooming follow-ups, with the dogs who need you soonest first.</PageHeading>
    <div className="crm-stats">
      <button onClick={() => { setFilter("overdue"); setMonth(""); }} className="crm-stat crm-stat-peach"><span className="crm-stat-icon"><FaClock /></span><span><small>Overdue a little care</small><strong>{counts.overdue}</strong><span>Ready for a follow-up</span></span></button>
      <button onClick={() => { setFilter("this-month"); setMonth(""); }} className="crm-stat crm-stat-blue"><span className="crm-stat-icon"><FaPaw /></span><span><small>Due this month</small><strong>{counts["this-month"]}</strong><span>Coming due from today</span></span></button>
      <button onClick={() => { setFilter("booked"); setMonth(""); }} className="crm-stat crm-stat-sage"><span className="crm-stat-icon"><FaCheck /></span><span><small>Already booked in</small><strong>{counts.booked}</strong><span>A next appointment is set</span></span></button>
    </div>
    <section className="crm-panel"><div className="crm-panel-title"><div><h2>The follow-up list</h2><p>Small · 6 months &nbsp; Medium · 4 months &nbsp; Large · 3 months</p></div><span className="crm-count">{visible.length} dog{visible.length === 1 ? "" : "s"}</span></div>
      <div className="crm-tabs" role="group" aria-label="Filter due status">{tabs.map((tab) => <button key={tab.key} className={filter === tab.key ? "is-active" : ""} aria-pressed={filter === tab.key} onClick={() => setFilter(tab.key)}>{tab.label}{tab.count !== undefined && <span>{tab.count}</span>}</button>)}</div>
      <div className="crm-toolbar"><SearchField value={query} onChange={setQuery} /><label className="crm-month-filter">Due in <input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setFilter("all"); }} />{month && <button onClick={() => setMonth("")} aria-label="Clear month filter">×</button>}</label></div>
      {visible.length ? <div className="crm-followup-list">{visible.map(({ customer, dog }) => <article key={dog.id} className="crm-followup-row">
        <div className={`crm-pet-avatar crm-pet-${dog.size.toLowerCase()}`} aria-hidden="true"><FaPaw /></div>
        <div className="crm-client-cell"><button className="crm-name-button" onClick={() => openCustomer(customer)}>{dog.name || "Dog name not recorded"}</button><span>{customer.name} · {dog.size || "Size needed"}{dog.interval ? ` · Every ${dog.interval} months` : ""}</span><ContactLinks customer={customer} /></div>
        <div className="crm-due-cell"><StatusBadge status={dog.status} /><strong>{dog.status === "booked" ? formatDate(dog.nextBooking.start, data.timeZone) : dog.dueDate ? formatDate(dog.dueDate, data.timeZone) : "Add the missing details"}</strong><span>{monthsSince(dog.lastBooking ? localDateKey(dog.lastBooking.start, data.timeZone) : null, data.today)}</span></div>
        <button className={`crm-button ${dog.status === "booked" ? "crm-secondary" : ""} crm-small`} onClick={() => dog.status === "booked" ? openCustomer(customer) : rebook(customer, dog)}>{dog.status === "booked" ? "View booking" : "Rebook"}<FaArrowRight /></button>
      </article>)}</div> : <EmptyState title={rows.length ? "All clear here." : "Your follow-ups will appear here."}>{rows.length ? "No dogs match this view. Try another filter or month." : "Once Google has past bookings with a dog size, we’ll work out when each dog is due back."}</EmptyState>}
    </section><p className="crm-help">Due dates use the last past booking, excluding recorded no-shows. A future booking for that dog takes it out of the follow-up queue.</p>
  </>;
}

export function ClientsView() {
  const { data, openCustomer, rebook } = useCrm();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const visible = data.customers.filter((customer) => matches(customer, query) && (filter === "all" || filter === "past" && customer.pastBookings > 0 || filter === "contacts" && !customer.history.length)).sort((a, b) => sort === "visits" ? b.pastBookings - a.pastBookings : sort === "last" ? Date.parse(b.lastBooking?.start || "1970-01-01") - Date.parse(a.lastBooking?.start || "1970-01-01") : a.name.localeCompare(b.name));
  return <>
    <PageHeading eyebrow="FAMILIAR FACES, HAPPY PAWS" title="Your little client book.">Contacts, dogs and every recorded appointment, together in one place.</PageHeading>
    <div className="crm-client-summary"><FaUsers /><strong>{data.customers.length} clients</strong><span>{data.customers.filter((customer) => customer.fromContacts).length} linked to Google Contacts</span><span>{data.customers.reduce((total, customer) => total + customer.pastBookings, 0)} past bookings</span></div>
    <section className="crm-panel"><div className="crm-panel-title"><h2>All clients</h2><span className="crm-count">{visible.length} shown</span></div>
      <div className="crm-toolbar"><SearchField value={query} onChange={setQuery} /><label className="crm-filter-select"><span className="crm-sr-only">Client filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All clients</option><option value="past">With past bookings</option><option value="contacts">Contacts without bookings</option></select></label><label className="crm-filter-select"><span className="crm-sr-only">Sort clients</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="last">Most recent visit</option><option value="visits">Most past bookings</option></select></label></div>
      {visible.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Client & contact</th><th>Dogs</th><th>Past bookings</th><th>Last groom</th><th>Recorded payments</th><th><span className="crm-sr-only">Actions</span></th></tr></thead><tbody>{visible.map((customer) => <tr key={customer.id}>
        <td><div className="crm-owner-cell"><span className="crm-owner-avatar" aria-hidden="true">{initials(customer.name)}</span><div><button className="crm-name-button" onClick={() => openCustomer(customer)}>{customer.name}</button><ContactLinks customer={customer} /></div></div></td>
        <td>{customer.dogs.length ? customer.dogs.map((dog) => <div key={dog.id} className="crm-table-dog"><FaPaw /><span>{dog.name || "Unnamed dog"}<small>{dog.size || "Size needed"}</small></span></div>) : <span className="crm-muted">No dog recorded</span>}</td>
        <td><strong>{customer.pastBookings}</strong><small className="crm-block">{customer.confirmedVisits} confirmed attended</small></td><td>{formatDate(customer.lastBooking?.start, data.timeZone)}</td>
        <td>{customer.paidBookingCount ? <><strong>{formatMoney(customer.totalPaid)}</strong><small className="crm-block">{customer.paidBookingCount} payment{customer.paidBookingCount === 1 ? "" : "s"} recorded</small></> : <span className="crm-muted">Not recorded</span>}</td>
        <td><div className="crm-row-actions"><button className="crm-button crm-secondary crm-small" onClick={() => openCustomer(customer)}>Details</button><button className="crm-button crm-small" onClick={() => rebook(customer, customer.dogs.length === 1 ? customer.dogs[0] : null)}>Rebook</button></div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No clients to show yet.">Try another search, or refresh after connecting your Google contacts and calendar.</EmptyState>}
    </section>
    {data.unrecognized.length > 0 && <details className="crm-review"><summary>{data.unrecognized.length} calendar event{data.unrecognized.length === 1 ? "" : "s"} need a look</summary><p>These events have no recognised customer booking details. They aren’t included in visit counts or due dates. Add the customer email and dog details to the calendar description to include a grooming appointment.</p><ul>{data.unrecognized.map((event) => <li key={event.id}><span>{formatDate(event.start, data.timeZone)} · {event.summary}</span>{event.htmlLink && <a className="crm-text-link" href={event.htmlLink} target="_blank" rel="noreferrer">Open in Google Calendar ↗</a>}</li>)}</ul></details>}
    <p className="crm-help">Google Contacts are linked by email or phone. Historical prices and attendance are shown only where recorded.</p>
  </>;
}

export function UpcomingView() {
  const { data, openCustomer, rebook } = useCrm();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("30");
  const all = data.customers.flatMap((customer) => customer.upcoming.map((appointment) => ({ customer, appointment }))).sort((a, b) => Date.parse(a.appointment.start) - Date.parse(b.appointment.start));
  const limit = range === "all" ? null : new Date(Date.parse(`${data.today}T00:00:00Z`) + Number(range) * 86400000).toISOString().slice(0, 10);
  const visible = all.filter(({ customer, appointment }) => matches(customer, query, { name: appointment.dogName, size: appointment.dogSize }) && (!limit || localDateKey(appointment.start, data.timeZone) <= limit));
  const groups = new Map();
  visible.forEach((row) => { const date = localDateKey(row.appointment.start, data.timeZone); groups.set(date, [...(groups.get(date) || []), row]); });
  return <>
    <PageHeading eyebrow="ON THE CALENDAR" title="Good things coming up.">A clear view of who’s coming in, and everything you need before they arrive.</PageHeading>
    <section className="crm-panel"><div className="crm-panel-title"><div><h2>Upcoming appointments</h2><p>Appointments are shown in {data.timeZone}.</p></div><span className="crm-count">{visible.length} appointment{visible.length === 1 ? "" : "s"}</span></div><div className="crm-toolbar"><SearchField value={query} onChange={setQuery} /><label className="crm-filter-select"><span className="crm-sr-only">Appointment date range</span><select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">Next 30 days</option><option value="90">Next 90 days</option><option value="all">All upcoming (2 years)</option></select></label></div>
      {groups.size ? <div className="crm-agenda">{[...groups].map(([date, rows]) => <section key={date} className="crm-agenda-day"><h3>{date === data.today ? "Today" : formatDate(date, data.timeZone, { weekday: "long", year: undefined })}<span>{rows.length} booked</span></h3>{rows.map(({ customer, appointment }) => <article key={appointment.id} className="crm-agenda-row"><div className="crm-agenda-time"><strong>{formatTime(appointment.start, data.timeZone)}</strong><span>to {formatTime(appointment.end, data.timeZone)}</span></div><div className="crm-client-cell"><button className="crm-name-button" onClick={() => openCustomer(customer)}>{appointment.dogName || "Unnamed dog"} <span className="crm-inline-muted">with {customer.name}</span></button><span>{appointment.service || "Service not recorded"} · {appointment.dogSize || "Size not recorded"}{appointment.quotedPrice !== null ? ` · ${formatMoney(appointment.quotedPrice)} quoted` : ""}</span><ContactLinks customer={customer} />{appointment.notes && <p className="crm-agenda-notes">{appointment.notes}</p>}</div><div className="crm-row-actions"><button className="crm-button crm-secondary crm-small" onClick={() => openCustomer(customer)}>Client details</button>{appointment.htmlLink && <a className="crm-text-link" href={appointment.htmlLink} target="_blank" rel="noreferrer">View in Calendar ↗</a>}</div></article>)}</section>)}</div> : <EmptyState title="A little room in the diary.">No appointments match this view. Rebook a client from their profile or the follow-up list.</EmptyState>}
    </section>
    <div className="crm-bottom-note"><FaCalendarAlt /><p>Need to bring someone back in? Open <a href="/admin/due" className="crm-text-link">Due for a groom</a> to choose a client and a free slot.</p></div>
  </>;
}
