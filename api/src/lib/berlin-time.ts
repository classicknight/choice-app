export const JOURNEY_TIME_ZONE = "Europe/Berlin";

type BerlinDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JOURNEY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = Number(parts.find((part) => part.type === type)?.value);

  if (!Number.isInteger(value)) {
    throw new Error(`Could not resolve ${type} in ${JOURNEY_TIME_ZONE}.`);
  }

  return value;
}

export function getBerlinDateParts(date: Date): BerlinDateParts {
  const parts = berlinDateTimeFormatter.formatToParts(date);

  return {
    year: getPart(parts, "year"),
    month: getPart(parts, "month"),
    day: getPart(parts, "day"),
    hour: getPart(parts, "hour"),
    minute: getPart(parts, "minute"),
    second: getPart(parts, "second"),
  };
}

function toUtcTimestamp(parts: BerlinDateParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function createDateInBerlin(parts: BerlinDateParts) {
  const targetTimestamp = toUtcTimestamp(parts);
  let candidateTimestamp = targetTimestamp;

  // 09:00 and 21:00 are unambiguous around DST. Iterating also keeps this helper
  // correct when the server itself runs in UTC, as Render does.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidateParts = getBerlinDateParts(new Date(candidateTimestamp));
    const correction = targetTimestamp - toUtcTimestamp(candidateParts);
    candidateTimestamp += correction;

    if (correction === 0) {
      break;
    }
  }

  return new Date(candidateTimestamp);
}

function shiftCalendarDate(parts: BerlinDateParts, dayOffset: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function getBerlinDateKey(date: Date) {
  const parts = getBerlinDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getBerlinDateAtTime(date: Date, hour: number, minute: number, dayOffset = 0) {
  const current = getBerlinDateParts(date);
  const shifted = shiftCalendarDate(current, dayOffset);

  return createDateInBerlin({
    ...shifted,
    hour,
    minute,
    second: 0,
  });
}

export function getNextBerlinDateAtTime(now: Date, hour: number, minute: number) {
  const today = getBerlinDateAtTime(now, hour, minute);
  return now < today ? today : getBerlinDateAtTime(now, hour, minute, 1);
}

export function addBerlinCalendarDaysAtTime(date: Date, days: number, hour: number, minute: number) {
  return getBerlinDateAtTime(date, hour, minute, days);
}
