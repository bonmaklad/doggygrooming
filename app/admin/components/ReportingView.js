"use client";

import { useMemo, useState } from "react";
import { FaChartBar, FaUsers, FaRedoAlt, FaDollarSign } from "react-icons/fa";
import { addCalendarDays } from "../../../lib/crm";
import { buildReport } from "../../../lib/crmReporting";
import { useCrm } from "./CrmProvider";
import { formatDate, formatMoney } from "./format";

const revenueValue = (value) => value === null ? "Not recorded" : formatMoney(value);

function DailyChart({ days, metric, label, money, selected, onSelect, timeZone }) {
  const max = Math.max(1, ...days.map((day) => day[metric] || 0));
  const top = money ? Math.ceil(max / 4) * 4 : Math.max(4, Math.ceil(max / 4) * 4);
  const width = Math.max(500, Math.min(1600, days.length * 8));
  const plotWidth = width - 90;
  const step = plotWidth / days.length;
  const y = (value) => 170 - value / top * 140;
  const tickIndexes = new Set([0, days.length - 1, ...Array.from({ length: Math.min(7, days.length) }, (_, index) => Math.round(index * (days.length - 1) / 6))]);
  return <div className="crm-report-chart"><h3>{label}</h3><div className="crm-chart-scroll"><svg viewBox={`0 0 ${width} 210`} style={{ minWidth: Math.min(width, 500) }} role="group" aria-label={label}>
    {[0, 1, 2, 3, 4].map((tick) => <g key={tick}><line x1="64" x2={width - 26} y1={y(top * tick / 4)} y2={y(top * tick / 4)} stroke="#e6ebe4" /><text x="54" y={y(top * tick / 4) + 4} textAnchor="end">{money ? `$${Math.round(top * tick / 4).toLocaleString("en-NZ")}` : top * tick / 4}</text></g>)}
    {days.map((day, index) => {
      const x = 64 + index * step;
      const amount = day[metric];
      const description = `${formatDate(day.date, timeZone)}: ${money ? revenueValue(amount) : `${amount} grooms`}${day.missingRevenue && money ? "; incomplete revenue" : ""}`;
      return <g key={day.date} role="button" tabIndex={selected === day.date || (!selected && index === 0) ? 0 : -1} aria-label={description} aria-pressed={selected === day.date} onClick={() => onSelect(day.date)} onFocus={() => onSelect(day.date)} onMouseEnter={() => onSelect(day.date)} onKeyDown={(event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? days.length - 1 : Math.max(0, Math.min(days.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
          event.currentTarget.parentElement.querySelectorAll('[role="button"]')[next]?.focus();
        }
      }}>
        <title>{description}</title><rect x={x} y="26" width={step} height="148" fill={selected === day.date ? "#eaf0e4" : "transparent"} />
        {amount !== null && amount > 0 && <rect x={x + step * 0.15} y={y(amount)} width={Math.max(0.6, step * 0.7)} height={170 - y(amount)} rx={Math.min(3, step * 0.2)} fill={money ? "#6386a1" : "#709260"} />}
        {amount === null && <text x={x + step / 2} y="164" textAnchor="middle">–</text>}
      </g>;
    })}
    {[...tickIndexes].filter((index) => index >= 0 && index < days.length).map((index) => <text key={index} x={64 + (index + 0.5) * step} y="195" textAnchor="middle">{formatDate(days[index].date, timeZone, { year: undefined })}</text>)}
  </svg></div></div>;
}

export default function ReportingView() {
  const { data } = useCrm();
  const [startDate, setStartDate] = useState(`${data.today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(data.today);
  const [revenueBasis, setRevenueBasis] = useState("prices");
  const [selected, setSelected] = useState("");
  const report = useMemo(() => buildReport({ customers: data.customers, startDate, endDate, timeZone: data.timeZone, revenueBasis }), [data, startDate, endDate, revenueBasis]);
  const selectedDay = report.daily?.find((day) => day.date === selected);
  const setPeriod = (start, end) => { setStartDate(start); setEndDate(end); setSelected(""); };
  const lastMonthEnd = addCalendarDays(`${data.today.slice(0, 7)}-01`, -1);
  const revenueLabel = revenueBasis === "prices" ? "Estimated revenue" : "Recorded revenue";
  return <>
    <div className="crm-page-heading"><div><h1>Reporting</h1><p>Grooms, customers and revenue for your selected dates.</p></div></div>
    <section className="crm-panel crm-report-controls" aria-label="Reporting filters"><div className="crm-toolbar">
      <label>From<input type="date" max={data.today} value={startDate} onChange={(event) => { setStartDate(event.target.value); setSelected(""); }} /></label>
      <label>To<input type="date" max={data.today} value={endDate} onChange={(event) => { setEndDate(event.target.value); setSelected(""); }} /></label>
      <label>Revenue basis<select value={revenueBasis} onChange={(event) => setRevenueBasis(event.target.value)}><option value="payments">Recorded payments</option><option value="prices">Customer / standard prices (estimate)</option></select></label>
      <div className="crm-row-actions"><button className="crm-button crm-secondary crm-small" onClick={() => setPeriod(`${data.today.slice(0, 7)}-01`, data.today)}>This month</button><button className="crm-button crm-secondary crm-small" onClick={() => setPeriod(`${lastMonthEnd.slice(0, 7)}-01`, lastMonthEnd)}>Last month</button><button className="crm-button crm-secondary crm-small" onClick={() => setPeriod(addCalendarDays(data.today, -29), data.today)}>Last 30 days</button></div>
    </div></section>
    {report.error ? <p role="alert" className="crm-error">{report.error}</p> : <>
      <div className="crm-report-layout"><section className="crm-panel"><div className="crm-panel-title"><h2><FaChartBar /> Daily activity</h2><span className="crm-count">{report.cuts} grooms</span></div>
        <DailyChart days={report.daily} metric="cuts" label="Grooms per day" selected={selected} onSelect={setSelected} timeZone={data.timeZone} />
        <DailyChart days={report.daily} metric="revenue" label={`${revenueLabel} per day (NZD)`} money selected={selected} onSelect={setSelected} timeZone={data.timeZone} />
        <div className="crm-chart-selection" aria-live="polite">{selectedDay ? <><strong>{formatDate(selectedDay.date, data.timeZone)}</strong><span>{selectedDay.cuts} grooms</span><span>{revenueValue(selectedDay.revenue)}{selectedDay.missingRevenue > 0 ? " · incomplete revenue" : ""}</span></> : <span>Select a day to see its totals. Use arrow keys to move between days.</span>}</div>
        {!report.cuts && !report.revenueRecords && <p className="crm-report-empty">No past grooms or recorded payments in this period.</p>}
      </section><aside className="crm-report-totals" aria-label="Period totals">
        <div className="crm-stat crm-stat-sage"><span className="crm-stat-icon"><FaUsers /></span><span><small>Total customers</small><strong>{report.customers}</strong><span>Unique customers groomed in this period</span></span></div>
        <div className="crm-stat crm-stat-peach"><span className="crm-stat-icon"><FaRedoAlt /></span><span><small>Returning customers</small><strong>{report.returningCustomers}</strong><span>Had a groom on an earlier day in the available history</span></span></div>
        <div className="crm-stat crm-stat-blue"><span className="crm-stat-icon"><FaDollarSign /></span><span><small>Total revenue{revenueBasis === "prices" ? " · estimated" : " · recorded"}</small><strong>{report.revenue === null ? "—" : formatMoney(report.revenue)}</strong><span>{revenueBasis === "prices" ? "At customer prices, otherwise standard service prices" : "Payments recorded for appointments in this period"}{report.missingRevenue > 0 ? ` · ${report.missingRevenue} grooms missing ${revenueBasis === "prices" ? "pricing details" : "payment amounts"}` : ""}</span></span></div>
      </aside></div>
      {report.missingRevenue > 0 && <p role="status" className="crm-warning">{report.revenue === null ? "Revenue is not available yet." : "Revenue is incomplete."} {report.missingRevenue} groom{report.missingRevenue === 1 ? " is" : "s are"} missing {revenueBasis === "prices" ? "a customer price or recognised service and dog size" : "a recorded payment amount"}. Unknown amounts are excluded.</p>}
      <p className="crm-help">Dates use {data.timeZone} and the appointment date. Each past appointment counts as one groom unless marked no-show; future bookings are excluded.{report.unconfirmed > 0 ? ` Attendance is unconfirmed for ${report.unconfirmed} grooms.` : ""} Historical reports include inactive customers. {revenueBasis === "prices" ? "Revenue estimates use the customer’s current price per groom when set; otherwise today’s price for the recorded service and dog size. Editing customer pricing updates estimates for earlier periods too." : "Revenue includes recorded no-show payments; blank amounts remain unknown and a recorded 0 is included."}</p>
      <details className="crm-review"><summary>Daily figures</summary><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Date</th><th>Grooms</th><th>{revenueLabel} (NZD)</th><th>Missing amounts</th></tr></thead><tbody>{report.daily.map((day) => <tr key={day.date}><td>{formatDate(day.date, data.timeZone)}</td><td>{day.cuts}</td><td>{revenueValue(day.revenue)}</td><td>{day.missingRevenue}</td></tr>)}</tbody></table></div></details>
    </>}
  </>;
}
