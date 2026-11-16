import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../lib/crmReporting.js";

const now = new Date("2026-11-17T05:00:00Z");
const visit = (id, date, changes = {}) => ({ id, start: `${date}T00:00:00Z`, end: `${date}T02:00:00Z`, service: "Full Groom", dogSize: "Small", attendance: "attended", amountPaid: null, ...changes });
const report = (customers, changes = {}) => buildReport({ customers, startDate: "2026-11-01", endDate: "2026-11-17", timeZone: "Pacific/Auckland", now, ...changes });

test("estimates use customer prices before standard prices, reconcile daily and exclude no-shows/future visits", () => {
  const result = report([
    { id: "old", active: false, groomPrice: 75.25, history: [visit("past", "2026-09-01"), visit("a", "2026-11-02"), visit("b", "2026-11-03", { attendance: "unconfirmed" }), visit("no", "2026-11-04", { attendance: "no-show", amountPaid: 20 }), visit("future", "2026-11-18")] },
    { id: "new", history: [visit("c", "2026-11-03", { dogSize: "Large" }), visit("d", "2026-11-03", { service: "Basic Trim", dogSize: "Medium" })] },
  ]);
  assert.equal(result.cuts, 4);
  assert.equal(result.customers, 2);
  assert.equal(result.returningCustomers, 1);
  assert.equal(result.revenue, 345.5);
  assert.equal(result.unconfirmed, 1);
  assert.equal(result.daily.length, 17);
  assert.equal(result.daily.find((day) => day.date === "2026-11-03").revenue, 270.25);
  assert.equal(result.daily.reduce((sum, day) => sum + day.revenueCents, 0), 34550);
  assert.equal(result.daily.reduce((sum, day) => sum + day.cuts, 0), result.cuts);
});

test("a customer returning later within the period counts once; same-day multiple dogs do not", () => {
  const result = report([{ id: "a", history: [visit("a1", "2026-11-01"), visit("a2", "2026-11-01"), visit("a3", "2026-11-05")] }, { id: "b", history: [visit("b1", "2026-11-01"), visit("b2", "2026-11-01")] }]);
  assert.equal(result.customers, 2);
  assert.equal(result.returningCustomers, 1);
  assert.equal(result.cuts, 5);
});

test("unknown prices are not zero, custom prices fill missing service details, and explicit free grooms stay zero", () => {
  const unknown = { id: "a", history: [visit("a", "2026-11-02", { dogSize: "", service: "" })] };
  assert.equal(report([unknown]).revenue, null);
  assert.equal(report([unknown]).missingRevenue, 1);
  assert.equal(report([unknown]).daily.find((day) => day.date === "2026-11-02").revenue, null);
  assert.equal(report([{ ...unknown, groomPrice: 66 }]).revenue, 66);
  assert.equal(report([{ ...unknown, groomPrice: 0 }]).revenue, 0);
  const partial = report([unknown, { id: "b", history: [visit("b", "2026-11-02")] }]);
  assert.equal(partial.revenue, 90);
  assert.equal(partial.missingRevenue, 1);
});

test("recorded payments stay separate from estimates, preserve cents and include no-show payments", () => {
  const customers = [{ id: "a", groomPrice: 999, history: [visit("unknown", "2026-11-01"), visit("free", "2026-11-02", { amountPaid: 0 }), visit("paid", "2026-11-02", { amountPaid: 12.1 }), visit("no", "2026-11-03", { attendance: "no-show", amountPaid: 20.2 })] }];
  const result = report(customers, { revenueBasis: "payments" });
  assert.equal(result.revenue, 32.3);
  assert.equal(result.revenueRecords, 3);
  assert.equal(result.missingRevenue, 1);
  assert.equal(result.cuts, 3);
});

test("Auckland date boundaries are inclusive and duplicate appointments are not counted twice", () => {
  const a = visit("a", "2026-10-31", { start: "2026-10-31T11:00:00Z", end: "2026-10-31T13:00:00Z" });
  const b = visit("b", "2026-11-01", { start: "2026-11-01T11:00:00Z", end: "2026-11-01T13:00:00Z" });
  const result = report([{ id: "a", history: [a, a, b] }], { startDate: "2026-11-01", endDate: "2026-11-01" });
  assert.equal(result.cuts, 1);
  assert.equal(result.daily.length, 1);
  assert.equal(result.revenue, 90);
});

test("empty periods and invalid date ranges are explicit", () => {
  const result = report([]);
  assert.equal(result.cuts, 0);
  assert.equal(result.customers, 0);
  assert.equal(result.revenue, 0);
  for (const range of [{ startDate: "2026-11-18" }, { endDate: "2026-11-18" }, { startDate: "2026-02-30" }, { endDate: "" }, { startDate: "2000-01-01" }]) assert.ok(report([], range).error);
});
