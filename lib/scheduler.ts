const DEFAULT_TIMEZONE =
  "Asia/Tehran";

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

function getLocalDateParts(
  date: Date,
  timeZone: string
): LocalDateParts {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(date);

  const values: Record<
    string,
    number
  > = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day"
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function formatDateOnly(
  date: Date,
  timeZone: string =
    DEFAULT_TIMEZONE
): string {
  const parts =
    getLocalDateParts(
      date,
      timeZone
    );

  return [
    parts.year,
    String(parts.month).padStart(
      2,
      "0"
    ),
    String(parts.day).padStart(
      2,
      "0"
    ),
  ].join("-");
}

export function getTodayDate(
  timeZone: string =
    DEFAULT_TIMEZONE,
  now: Date = new Date()
): string {
  return formatDateOnly(
    now,
    timeZone
  );
}

export function addDaysToDateString(
  dateString: string,
  days: number
): string {
  const [
    year,
    month,
    day,
  ] = dateString
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days,
      12,
      0,
      0
    )
  );

  return date
    .toISOString()
    .slice(0, 10);
}

export function compareDateOnly(
  a: string,
  b: string
): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isJobDueToday(
  lastRun:
    | string
    | null
    | undefined,
  timeZone:
    | string
    | null
    | undefined,
  now: Date = new Date()
): boolean {
  if (!lastRun) {
    return true;
  }

  const tz =
    timeZone ||
    DEFAULT_TIMEZONE;

  const lastRunDate =
    new Date(lastRun);

  if (
    Number.isNaN(
      lastRunDate.getTime()
    )
  ) {
    return true;
  }

  const today =
    getTodayDate(
      tz,
      now
    );

  const lastRunLocal =
    formatDateOnly(
      lastRunDate,
      tz
    );

  return today !== lastRunLocal;
}