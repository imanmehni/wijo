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
    getLocalDateParts(
      now,
      tz
    );

  const lastRunLocal =
    getLocalDateParts(
      lastRunDate,
      tz
    );

  return !(
    today.year ===
      lastRunLocal.year &&
    today.month ===
      lastRunLocal.month &&
    today.day ===
      lastRunLocal.day
  );
}

/**
 * Adds calendar days using the requested timezone.
 *
 * The returned Date is an arithmetic anchor.
 * Use formatDate/resolveVariables for actual
 * timezone-aware display.
 */
export function addCalendarDays(
  date: Date,
  days: number,
  timezone:
    | string
    | null
    | undefined
): Date {
  const tz =
    timezone ||
    DEFAULT_TIMEZONE;

  const parts =
    getLocalDateParts(
      date,
      tz
    );

  const result = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      12,
      0,
      0
    )
  );

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return result;
}

/**
 * Returns the next calendar date.
 */
export function getNextRunAt(
  current: Date = new Date(),
  timezone:
    | string
    | null
    | undefined
): Date {
  return addCalendarDays(
    current,
    1,
    timezone
  );
}