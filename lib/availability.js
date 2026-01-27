const getZonedParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const valueMap = parts.reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    year: Number(valueMap.year),
    month: Number(valueMap.month),
    day: Number(valueMap.day),
  };
};

const getTimezoneOffset = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const valueMap = parts.reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(valueMap.year),
    Number(valueMap.month) - 1,
    Number(valueMap.day),
    Number(valueMap.hour),
    Number(valueMap.minute),
    Number(valueMap.second)
  );
  return asUtc - date.getTime();
};

const makeZonedDate = (year, month, day, hour, minute, timeZone) => {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimezoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset);
};

const parseTime = (value) => {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return { hour, minute };
};

const formatInZone = (date, timeZone, options) =>
  new Intl.DateTimeFormat("en-NZ", { timeZone, ...options }).format(date);

const isSlotBusy = (startMs, endMs, busyRanges) =>
  busyRanges.some((busy) => startMs < busy.end && endMs > busy.start);

export const buildAvailabilitySlots = ({
  startDate,
  weeks,
  sessionMinutes,
  schedule,
  timeZone,
  busy,
}) => {
  const busyRanges = (busy || []).map((range) => ({
    start: new Date(range.start).getTime(),
    end: new Date(range.end).getTime(),
  }));
  const nowMs = Date.now();
  const totalDays = weeks * 7;
  const localStart = getZonedParts(startDate, timeZone);
  let year = localStart.year;
  let month = localStart.month;
  let day = localStart.day;
  const results = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const dayDate = makeZonedDate(year, month, day, 0, 0, timeZone);
    const weekday = formatInZone(dayDate, timeZone, { weekday: "long" });
    const window = schedule[weekday];

    if (window) {
      const { hour: startHour, minute: startMinute } = parseTime(window.start);
      const { hour: endHour, minute: endMinute } = parseTime(window.end);
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      const slots = [];

      for (
        let minutes = startTotal;
        minutes + sessionMinutes <= endTotal;
        minutes += sessionMinutes
      ) {
        const slotHour = Math.floor(minutes / 60);
        const slotMinute = minutes % 60;
        const slotStart = makeZonedDate(year, month, day, slotHour, slotMinute, timeZone);
        const slotEnd = new Date(slotStart.getTime() + sessionMinutes * 60000);
        const slotStartMs = slotStart.getTime();
        const slotEndMs = slotEnd.getTime();

        if (slotEndMs <= nowMs) {
          continue;
        }

        if (isSlotBusy(slotStartMs, slotEndMs, busyRanges)) {
          continue;
        }

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: formatInZone(slotStart, timeZone, {
            hour: "numeric",
            minute: "2-digit",
          }),
        });
      }

      if (slots.length) {
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        results.push({
          dateKey,
          dateLabel: formatInZone(dayDate, timeZone, {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
          slots,
        });
      }
    }

    const nextDate = new Date(Date.UTC(year, month - 1, day) + 86400000);
    year = nextDate.getUTCFullYear();
    month = nextDate.getUTCMonth() + 1;
    day = nextDate.getUTCDate();
  }

  return results;
};

export const isSlotWithinSchedule = ({ start, end, schedule, timeZone, sessionMinutes }) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false;
  }
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
  if (durationMinutes !== sessionMinutes) {
    return false;
  }
  const parts = getZonedParts(startDate, timeZone);
  const weekday = formatInZone(startDate, timeZone, { weekday: "long" });
  const window = schedule[weekday];
  if (!window) {
    return false;
  }
  const { hour: startHour, minute: startMinute } = parseTime(window.start);
  const { hour: endHour, minute: endMinute } = parseTime(window.end);
  const slotStart = makeZonedDate(parts.year, parts.month, parts.day, startHour, startMinute, timeZone);
  const slotEnd = makeZonedDate(parts.year, parts.month, parts.day, endHour, endMinute, timeZone);
  return startDate >= slotStart && endDate <= slotEnd;
};
