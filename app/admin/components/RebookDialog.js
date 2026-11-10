"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaEnvelope } from "react-icons/fa";
import { SERVICE_PRICES, DOG_REBOOK_MONTHS, BOOKING_SLOT_SUMMARY } from "../../../lib/bookingConfig";
import Modal from "./Modal";
import { formatDate, formatMoney } from "./format";

export default function RebookDialog({ customer, dog, onClose, onBooked }) {
  const last = dog?.lastBooking || dog?.nextBooking;
  const initialService = dog?.service || "";
  const [form, setForm] = useState({
    name: customer.name, email: customer.emails[0] || "", phone: customer.phones[0] || "",
    dogName: dog?.name || "", dogSize: dog?.size || "", service: initialService,
    notes: dog?.notes || "", quotedPrice: last?.quotedPrice ?? last?.amountPaid ?? SERVICE_PRICES[initialService]?.[dog?.size] ?? "",
  });
  const [requestId] = useState(() => crypto.randomUUID());
  const [days, setDays] = useState([]);
  const [timeZone, setTimeZone] = useState("Pacific/Auckland");
  const [month, setMonth] = useState("");
  const [dayKey, setDayKey] = useState("");
  const [slot, setSlot] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dogId, setDogId] = useState(dog?.id || "");
  const loadAvailability = useCallback(async () => {
    setAvailabilityLoading(true); setAvailabilityError(""); setSlot(null);
    try {
      const response = await fetch("/api/availability", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDays(body.slots); setTimeZone(body.timeZone);
      setMonth((current) => body.slots.some((day) => day.dateKey.startsWith(current)) && current ? current : body.slots[0]?.dateKey.slice(0, 7) || "");
      setDayKey("");
    } catch (failure) { setDays([]); setAvailabilityError(failure.message || "Couldn't load available slots."); }
    finally { setAvailabilityLoading(false); }
  }, []);
  useEffect(() => { loadAvailability(); }, [loadAvailability]);
  const months = [...new Set(days.map((day) => day.dateKey.slice(0, 7)))];
  const byDate = useMemo(() => new Map(days.map((day) => [day.dateKey, day])), [days]);
  const selectedDay = byDate.get(dayKey);
  const calendarDays = useMemo(() => {
    if (!month) return [];
    const [year, monthNumber] = month.split("-").map(Number);
    const leading = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
  }, [month]);
  const update = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "service" || key === "dogSize") next.quotedPrice = SERVICE_PRICES[next.service]?.[next.dogSize] ?? "";
    return next;
  });
  const chooseDog = (id) => {
    setDogId(id);
    const selected = customer.dogs.find((item) => item.id === id);
    const previous = selected?.lastBooking || selected?.nextBooking;
    setForm((current) => ({ ...current, dogName: selected?.name || "", dogSize: selected?.size || "", service: selected?.service || "", notes: selected?.notes || "", quotedPrice: previous?.quotedPrice ?? previous?.amountPaid ?? SERVICE_PRICES[selected?.service]?.[selected?.size] ?? "" }));
  };
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (!slot) { setError("Choose an available date and time first."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, start: slot.start, end: slot.end, requestId }) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) await loadAvailability();
        throw new Error(body.error);
      }
      await onBooked();
    } catch (failure) { setError(failure.message || "Couldn't confirm this booking. Please try again."); setBusy(false); }
  };
  return <Modal title="A spot for a fresh groom." eyebrow="REBOOK A CLIENT" onClose={onClose} busy={busy} wide>
    <p className="crm-dialog-intro">Choose the dog, check the details and pick a free slot. We’ll use the same Google Calendar confirmation as a website booking.</p>
    <form className="crm-form" onSubmit={submit}><fieldset disabled={busy}>
      {customer.dogs.length > 1 && <label>Which dog?<select value={dogId} onChange={(event) => chooseDog(event.target.value)}><option value="">Another dog / enter details</option>{customer.dogs.map((item) => <option key={item.id} value={item.id}>{item.name || "Unnamed dog"} · {item.size || "Size needed"}</option>)}</select></label>}
      <div className="crm-form-grid"><label>Owner’s name<input required maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" /></label><label>Dog’s name<input required maxLength={120} value={form.dogName} onChange={(event) => update("dogName", event.target.value)} /></label><label>Email for confirmation<input required type="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" /></label><label>Phone<input type="tel" maxLength={50} value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" /></label><label>Dog size<select required value={form.dogSize} onChange={(event) => update("dogSize", event.target.value)}><option value="">Choose size</option>{Object.entries(DOG_REBOOK_MONTHS).map(([size, interval]) => <option key={size} value={size}>{size} · Every {interval} months</option>)}</select></label><label>Service<select required value={form.service} onChange={(event) => update("service", event.target.value)}><option value="">Choose service</option>{Object.keys(SERVICE_PRICES).map((service) => <option key={service}>{service}</option>)}</select></label></div>
      <label>Quoted price (NZD)<input required type="number" min="0" max="10000" step="0.01" value={form.quotedPrice} onChange={(event) => update("quotedPrice", event.target.value)} /><small>A quote for this booking. Record the amount paid after the visit.</small></label>
      <label>Notes for this appointment<textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      <div className="crm-booking-calendar"><h3><FaCalendarAlt />Choose a free slot</h3><p>{BOOKING_SLOT_SUMMARY} · {timeZone}</p>
        {availabilityLoading ? <p role="status">Checking the calendar…</p> : availabilityError ? <div role="alert" className="crm-error"><p>{availabilityError}</p><button type="button" className="crm-button crm-secondary crm-small" onClick={loadAvailability}>Try again</button></div> : !days.length ? <p>No free slots are available in the next 13 weeks. Please check Google Calendar.</p> : <>
          <div className="crm-calendar-heading"><button type="button" className="crm-icon-button" disabled={months.indexOf(month) <= 0} onClick={() => setMonth(months[months.indexOf(month) - 1])} aria-label="Previous month"><FaChevronLeft /></button><strong>{formatDate(`${month}-01`, timeZone, { month: "long", year: "numeric", day: undefined })}</strong><button type="button" className="crm-icon-button" disabled={months.indexOf(month) >= months.length - 1} onClick={() => setMonth(months[months.indexOf(month) + 1])} aria-label="Next month"><FaChevronRight /></button></div>
          <div className="crm-calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day} className="crm-weekday">{day}</span>)}{calendarDays.map((date, index) => date ? <button type="button" key={date} disabled={!byDate.has(date)} className={date === dayKey ? "is-selected" : ""} aria-pressed={date === dayKey} aria-label={formatDate(date, timeZone, { weekday: "long" })} onClick={() => { setDayKey(date); setSlot(null); }}>{Number(date.slice(-2))}</button> : <span key={`blank-${index}`} />)}</div>
          {selectedDay && <div className="crm-slot-picker"><strong>{formatDate(dayKey, timeZone)} · Available times</strong><div>{selectedDay.slots.map((item) => <button type="button" key={item.start} className={`crm-button crm-secondary ${slot?.start === item.start ? "is-selected" : ""}`} aria-pressed={slot?.start === item.start} onClick={() => setSlot(item)}>{item.label}</button>)}</div></div>}
        </>}
      </div>
      {slot && <div className="crm-booking-summary"><FaEnvelope /><span><strong>{formatDate(slot.start, timeZone)} · {slot.label} · {formatMoney(Number(form.quotedPrice) || 0)}</strong><small>Confirmation will be sent to {form.email || "the customer’s email"}.</small></span></div>}
      {error && <p role="alert" className="crm-error">{error}</p>}
      <div className="crm-dialog-actions"><button type="button" className="crm-button crm-secondary" onClick={onClose}>Cancel</button><button className="crm-button" disabled={!slot || availabilityLoading || Boolean(availabilityError)}>{busy ? "Confirming…" : "Book & send confirmation"}</button></div>
    </fieldset></form>
  </Modal>;
}
