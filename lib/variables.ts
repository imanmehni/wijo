interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

/**
 * Resolves dynamic variables in a string based on a timezone.
 * Supported: (date), (date+1), (date-1), (datetime), (timestamp), (year), (month), (day)
 */
export function resolveVariables(
  str: string | null | undefined,
  timezone: string = "Asia/Tehran"
): string {
  if (!str) return str ?? "";
  const now = new Date();

  const getPartsUTC = (dateObj: Date): DateParts => {
    return {
      year: dateObj.getUTCFullYear().toString(),
      month: (dateObj.getUTCMonth() + 1).toString().padStart(2, "0"),
      day: dateObj.getUTCDate().toString().padStart(2, "0"),
      hour: dateObj.getUTCHours().toString().padStart(2, "0"),
      minute: dateObj.getUTCMinutes().toString().padStart(2, "0"),
      second: dateObj.getUTCSeconds().toString().padStart(2, "0"),
    };
  };

  // Helper to format date relative to current time by days offset
  const getParts = (dateObj: Date): DateParts => {
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
      const parts = formatter.formatToParts(dateObj);
      const val = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find((p) => p.type === type)?.value ?? "";
      const hour = val("hour");
      return {
        year: val("year"),
        month: val("month"),
        day: val("day"),
        hour: hour === "24" ? "00" : hour,
        minute: val("minute"),
        second: val("second"),
      };
    } catch {
      console.warn(`Timezone '${timezone}' not recognized, falling back to UTC`);
      return getPartsUTC(dateObj);
    }
  };

  const current = getParts(now);

  const tomorrowObj = new Date(now.getTime() + 86400000);
  const tomorrow = getParts(tomorrowObj);

  const yesterdayObj = new Date(now.getTime() - 86400000);
  const yesterday = getParts(yesterdayObj);

  const timestamp = Math.floor(now.getTime() / 1000).toString();

  const replacements: Record<string, string> = {
    "(date)": `${current.year}-${current.month}-${current.day}`,
    "(date+1)": `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`,
    "(date-1)": `${yesterday.year}-${yesterday.month}-${yesterday.day}`,
    "(datetime)": `${current.year}-${current.month}-${current.day}T${current.hour}:${current.minute}:${current.second}`,
    "(timestamp)": timestamp,
    "(year)": current.year,
    "(month)": current.month,
    "(day)": current.day,
  };

  let result = str;
  for (const [key, val] of Object.entries(replacements)) {
    // replace all occurrences
    result = result.split(key).join(val);
  }

  return result;
}

export function maskSecrets(
  obj: Record<string, string> | null | undefined
): Record<string, string> | null | undefined {
  if (!obj) return obj;
  const masked: Record<string, string> = { ...obj };
  const secretPattern = /auth|token|cookie|bearer|secret|key|authorization/i;
  for (const key of Object.keys(masked)) {
    if (secretPattern.test(key)) {
      masked[key] = "••••••••";
    }
  }
  return masked;
}
