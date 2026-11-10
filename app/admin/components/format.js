export const formatMoney = (value) => new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(value);
export const formatDate = (value, timeZone = "Pacific/Auckland", options = {}) => {
  if (!value) return "Not recorded";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  // A calendar date already represents the business's local day. Formatting
  // UTC noon in Auckland's summer time would incorrectly move it to tomorrow.
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric", month: "short", year: "numeric", ...options,
    timeZone: dateOnly ? "UTC" : timeZone,
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
};
export const formatTime = (value, timeZone) => new Intl.DateTimeFormat("en-NZ", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
export const initials = (name) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
export const monthsSince = (date, today) => {
  if (!date) return "No past booking";
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = today.split("-").map(Number);
  const months = (nowYear - year) * 12 + nowMonth - month - (nowDay < day ? 1 : 0);
  return months < 1 ? "Less than a month ago" : `${months} month${months === 1 ? "" : "s"} since last groom`;
};
