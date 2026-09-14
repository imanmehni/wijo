const DEFAULT_TIMEZONE = "Asia/Tehran";

interface ScheduleParts {
  hour: number;
  minute: number;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function parseSchedule(
  schedule: string
): ScheduleParts | null {
  const match = schedule
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s+DAILY$/i);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  const utcTime = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return utcTime - date.getTime();
}

function zonedLocalDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let guess = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    )
  );

  for (let i = 0; i < 3; i++) {
    const offset = getTimeZoneOffsetMs(
      guess,
      timeZone
    );

    const nextGuess = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        0
      ) - offset
    );

    if (
      nextGuess.getTime() === guess.getTime()
    ) {
      break;
    }

    guess = nextGuess;
  }

  return guess;
}

function getLocalDateParts(
  date: Date,
  timeZone: string
): LocalDateParts {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }
  );

  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute"
    ) {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
  };
}

function getNextLocalDay(
  date: LocalDateParts
): LocalDateParts {
  const nextDay = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day + 1
    )
  );

  return {
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
    hour: date.hour,
    minute: date.minute,
  };
}

export function getNextRunAt(
  schedule: string | null | undefined,
  timeZone: string | null | undefined,
  fromDate: Date = new Date()
): Date | null {
  if (!schedule) {
    return null;
  }

  const parsed = parseSchedule(schedule);

  if (!parsed) {
    return null;
  }

  const tz = timeZone || DEFAULT_TIMEZONE;

  const local = getLocalDateParts(
    fromDate,
    tz
  );

  let candidate = zonedLocalDateToUtc(
    local.year,
    local.month,
    local.day,
    parsed.hour,
    parsed.minute,
    tz
  );

  if (
    candidate.getTime() <= fromDate.getTime()
  ) {
    const nextLocalDay = getNextLocalDay(local);

    candidate = zonedLocalDateToUtc(
      nextLocalDay.year,
      nextLocalDay.month,
      nextLocalDay.day,
      parsed.hour,
      parsed.minute,
      tz
    );
  }

  return candidate;
}
