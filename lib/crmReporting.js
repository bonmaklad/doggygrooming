import { addCalendarDays, localDateKey } from "./crm.js";
import { SERVICE_PRICES } from "./bookingConfig.js";

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function buildReport({ customers, startDate, endDate, timeZone, revenueBasis = "prices", now = new Date() }) {
  const today = localDateKey(now, timeZone);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return { error: "Choose a valid start and end date, with the start first." };
  if (endDate > today) return { error: "Choose an end date up to today. Reporting uses past appointments." };
  const dayCount = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
  if (dayCount > 3660) return { error: "Choose a date range of up to 10 years." };
  if (!["payments", "prices"].includes(revenueBasis)) return { error: "Choose a revenue basis." };
  const days = new Map(Array.from({ length: dayCount }, (_, index) => {
    const date = addCalendarDays(startDate, index);
    return [date, { date, cuts: 0, revenueCents: 0, revenueRecords: 0, missingRevenue: 0, unconfirmed: 0 }];
  }));
  const clients = new Set();
  const returning = new Set();
  const seen = new Set();
  for (const customer of customers) {
    const past = customer.history.filter((visit) => Date.parse(visit.end) <= now.getTime());
    const groomDates = past.filter((visit) => visit.attendance !== "no-show").map((visit) => localDateKey(visit.start, timeZone));
    const firstGroom = [...groomDates].sort()[0];
    for (const visit of past) {
      const date = localDateKey(visit.start, timeZone);
      const day = days.get(date);
      if (!day || seen.has(visit.id)) continue;
      seen.add(visit.id);
      const isGroom = visit.attendance !== "no-show";
      if (isGroom) {
        day.cuts++;
        clients.add(customer.id);
        if (firstGroom < date) returning.add(customer.id);
        if (visit.attendance !== "attended") day.unconfirmed++;
      }
      // Actual payments include recorded no-show charges. Estimates only price
      // grooms, using the service and size recorded against each appointment.
      const amount = revenueBasis === "payments" ? visit.amountPaid : isGroom ? customer.groomPrice ?? SERVICE_PRICES[visit.service]?.[visit.dogSize] : null;
      if (typeof amount === "number" && Number.isFinite(amount) && amount >= 0) {
        day.revenueCents += Math.round(amount * 100);
        day.revenueRecords++;
      } else if (isGroom) day.missingRevenue++;
    }
  }
  const daily = [...days.values()].map((day) => ({ ...day, revenue: day.revenueRecords ? day.revenueCents / 100 : day.missingRevenue ? null : 0 }));
  const sum = (key) => daily.reduce((total, day) => total + day[key], 0);
  return { daily, customers: clients.size, returningCustomers: returning.size, cuts: sum("cuts"),
    revenue: sum("revenueRecords") ? sum("revenueCents") / 100 : sum("missingRevenue") ? null : 0,
    revenueRecords: sum("revenueRecords"), missingRevenue: sum("missingRevenue"), unconfirmed: sum("unconfirmed"), revenueBasis,
  };
}
