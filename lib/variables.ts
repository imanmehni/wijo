interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function getPartsUTC(
  dateObj: Date
): DateParts {
  return {
    year:
      dateObj
        .getUTCFullYear()
        .toString(),

    month:
      (
        dateObj.getUTCMonth() + 1
      )
        .toString()
        .padStart(2, "0"),

    day:
      dateObj
        .getUTCDate()
        .toString()
        .padStart(2, "0"),

    hour:
      dateObj
        .getUTCHours()
        .toString()
        .padStart(2, "0"),

    minute:
      dateObj
        .getUTCMinutes()
        .toString()
        .padStart(2, "0"),

    second:
      dateObj
        .getUTCSeconds()
        .toString()
        .padStart(2, "0"),
  };
}

function getParts(
  dateObj: Date,
  timezone: string
): DateParts {
  try {
    const formatter =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }
      );

    const parts =
      formatter.formatToParts(
        dateObj
      );

    const value = (
      type: Intl.DateTimeFormatPartTypes
    ) =>
      parts.find(
        (p) => p.type === type
      )?.value ?? "";

    const hour =
      value("hour");

    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour:
        hour === "24"
          ? "00"
          : hour,
      minute:
        value("minute"),
      second:
        value("second"),
    };
  } catch {
    return getPartsUTC(
      dateObj
    );
  }
}

export function resolveVariables(
  str:
    | string
    | null
    | undefined,
  timezone: string =
    "Asia/Tehran",
  baseDate: Date =
    new Date()
): string {
  if (!str) {
    return str ?? "";
  }

  const current =
    getParts(
      baseDate,
      timezone
    );

  const tomorrow =
    getParts(
      new Date(
        baseDate.getTime() +
          86400000
      ),
      timezone
    );

  const yesterday =
    getParts(
      new Date(
        baseDate.getTime() -
          86400000
      ),
      timezone
    );

  const timestamp =
    Math.floor(
      baseDate.getTime() / 1000
    ).toString();

  const replacements: Record<
    string,
    string
  > = {
    "(date)":
      `${current.year}-${current.month}-${current.day}`,

    "(date+1)":
      `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`,

    "(date-1)":
      `${yesterday.year}-${yesterday.month}-${yesterday.day}`,

    "(datetime)":
      `${current.year}-${current.month}-${current.day}T${current.hour}:${current.minute}:${current.second}`,

    "(timestamp)":
      timestamp,

    "(year)":
      current.year,

    "(month)":
      current.month,

    "(day)":
      current.day,
  };

  let result = str;

  for (
    const [key, value] of Object.entries(
      replacements
    )
  ) {
    result = result
      .split(key)
      .join(value);
  }

  return result;
}

export function maskSecrets(
  obj:
    | Record<string, string>
    | null
    | undefined
):
  | Record<string, string>
  | null
  | undefined {
  if (!obj) {
    return obj;
  }

  const masked = {
    ...obj,
  };

  const secretPattern =
    /auth|token|cookie|bearer|secret|key|authorization/i;

  for (
    const key of Object.keys(masked)
  ) {
    if (
      secretPattern.test(key)
    ) {
      masked[key] =
        "••••••••";
    }
  }

  return masked;
}