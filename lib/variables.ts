interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const DEFAULT_TIMEZONE = "Asia/Tehran";

function getDateParts(
  date: Date,
  timezone: string
): DateParts {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);

    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";

    const hour = value("hour");

    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: hour === "24" ? "00" : hour,
      minute: value("minute"),
      second: value("second"),
    };
  } catch {
    const utc = {
      year: date.getUTCFullYear().toString(),
      month: String(date.getUTCMonth() + 1).padStart(2, "0"),
      day: String(date.getUTCDate()).padStart(2, "0"),
      hour: String(date.getUTCHours()).padStart(2, "0"),
      minute: String(date.getUTCMinutes()).padStart(2, "0"),
      second: String(date.getUTCSeconds()).padStart(2, "0"),
    };

    return utc;
  }
}

/**
 * Returns a Date object representing the target calendar date
 * while preserving timezone-aware calendar arithmetic.
 *
 * We calculate the date using noon UTC as an arithmetic anchor
 * to avoid DST midnight edge cases.
 */
export function addDays(
  date: Date,
  days: number,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const parts = getDateParts(date, timezone);

  const calendarDate = new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      12,
      0,
      0
    )
  );

  calendarDate.setUTCDate(
    calendarDate.getUTCDate() + days
  );

  return calendarDate;
}

/**
 * Converts a Date into YYYY-MM-DD in the requested timezone.
 */
export function formatDate(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const parts = getDateParts(date, timezone);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Resolves dynamic variables.
 *
 * Supported:
 *
 * (date)
 * (date+1)
 * (date-1)
 * (datetime)
 * (timestamp)
 * (year)
 * (month)
 * (day)
 *
 * baseDate allows the caller to specify the date from which
 * relative variables should be calculated.
 */
export function resolveVariables(
  str: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  baseDate: Date = new Date()
): string {
  if (!str) return str ?? "";

  const current = getDateParts(baseDate, timezone);

  const tomorrow = addDays(
    baseDate,
    1,
    timezone
  );

  const yesterday = addDays(
    baseDate,
    -1,
    timezone
  );

  const tomorrowParts = getDateParts(
    tomorrow,
    timezone
  );

  const yesterdayParts = getDateParts(
    yesterday,
    timezone
  );

  const replacements: Record<string, string> = {
    "(date)": `${current.year}-${current.month}-${current.day}`,

    "(date+1)": `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`,

    "(date-1)": `${yesterdayParts.year}-${yesterdayParts.month}-${yesterdayParts.day}`,

    "(datetime)": `${current.year}-${current.month}-${current.day}T${current.hour}:${current.minute}:${current.second}`,

    "(timestamp)": Math.floor(
      baseDate.getTime() / 1000
    ).toString(),

    "(year)": current.year,
    "(month)": current.month,
    "(day)": current.day,
  };

  let result = str;

  for (const [key, value] of Object.entries(
    replacements
  )) {
    result = result.split(key).join(value);
  }

  return result;
}

export function maskSecrets(
  obj:
    | Record<string, string>
    | null
    | undefined
): Record<string, string> | null | undefined {
  if (!obj) return obj;

  const masked: Record<string, string> = {
    ...obj,
  };

  const secretPattern =
    /auth|token|cookie|bearer|secret|key|authorization|session/i;

  for (const key of Object.keys(masked)) {
    if (secretPattern.test(key)) {
      masked[key] = "••••••••";
    }
  }

  return masked;
}