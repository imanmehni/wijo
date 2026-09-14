import type { ParsedRequest } from "@/types";

function emptyParsedRequest(): ParsedRequest {
  return { method: "GET", headers: {}, cookies: {}, bodyRaw: null, url: "" };
}

/**
 * Parses Chrome "Copy as fetch" output.
 * Chrome usually outputs: fetch("URL", { "headers": {...}, "body": "...", "method": "POST" });
 */
export function parseFetch(raw: string): ParsedRequest {
  const parsed = emptyParsedRequest();

  // Extract URL
  const urlMatch = raw.match(/fetch\(\s*['"](.*?)['"]/);
  if (urlMatch) parsed.url = urlMatch[1] ?? "";

  // Extract headers
  const headersMatch = raw.match(/"headers"\s*:\s*(\{[\s\S]*?\})/);
  if (headersMatch) {
    try {
      // Fix potential trailing commas for strict JSON
      const hStr = headersMatch[1].replace(/,\s*}/g, "}");
      parsed.headers = JSON.parse(hStr) as Record<string, string>;
    } catch {
      // Fallback regex extraction if JSON.parse fails
      const hRegex = /"([^"]+)"\s*:\s*"([^"]*)"/g;
      let m: RegExpExecArray | null;
      while ((m = hRegex.exec(headersMatch[1])) !== null) {
        parsed.headers[m[1]] = m[2];
      }
    }
  }

  // Extract body
  const bodyMatch = raw.match(/"body"\s*:\s*"(.*?)"/);
  if (bodyMatch) {
    // Unescape quotes and backslashes
    parsed.bodyRaw = bodyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  // Extract method
  const methodMatch = raw.match(/"method"\s*:\s*"([^"]+)"/);
  if (methodMatch) {
    parsed.method = methodMatch[1].toUpperCase();
  }

  return parsed;
}

/**
 * Parses Chrome "Copy as cURL" output.
 */
export function parseCurl(raw: string): ParsedRequest {
  const parsed = emptyParsedRequest();

  // Remove line continuations and normalize spacing
  const cleanCmd = raw.replace(/\\\r?\n/g, " ");

  // Extract URL. Capture group 1 is the opening quote char (' or "), group 2
  // is the content — the closing match MUST be the same quote char via \1,
  // otherwise a JSON body/header value containing the other quote type
  // (e.g. a '--data-raw' single-quoted arg containing double-quoted JSON)
  // gets truncated at the first quote found inside it.
  const urlMatch =
    cleanCmd.match(/curl\s+(['"])([\s\S]*?)\1/) ||
    cleanCmd.match(/curl\s+([^\s]+)/);
  if (urlMatch) parsed.url = urlMatch[2] ?? urlMatch[1] ?? "";

  // Extract headers (-H or --header) — same same-quote-closes-it fix.
  const headerRegex = /(?:-H|--header)\s+(['"])([\s\S]*?)\1/g;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(cleanCmd)) !== null) {
    const raw = match[2];
    const colonIdx = raw.indexOf(":");
    if (colonIdx > -1) {
      const key = raw.substring(0, colonIdx).trim();
      const val = raw.substring(colonIdx + 1).trim();
      parsed.headers[key] = val;
    }
  }

  // Extract cookies (-b or --cookie)
  const cookieRegex = /(?:-b|--cookie)\s+(['"])([\s\S]*?)\1/g;
  while ((match = cookieRegex.exec(cleanCmd)) !== null) {
    // Basic "name=value" support for copy as cURL
    if (match[2].includes("=")) {
      parsed.headers["Cookie"] =
        (parsed.headers["Cookie"] ? parsed.headers["Cookie"] + "; " : "") +
        match[2];
    }
  }

  // Extract body (-d, --data, --data-raw, --data-binary) — same fix. This is
  // the one that matters most: JSON bodies are almost always double-quoted
  // inside a single-quoted shell argument.
  const bodyRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/;
  const bodyMatch = bodyRegex.exec(cleanCmd);
  if (bodyMatch) {
    parsed.bodyRaw = bodyMatch[2];
    parsed.method = "POST"; // cURL defaults to POST when data is attached
  }

  // Extract explicit method (-X or --request)
  const methodRegex = /(?:-X|--request)\s+['"]?([A-Za-z]+)['"]?/i;
  const methodMatch = methodRegex.exec(cleanCmd);
  if (methodMatch) {
    parsed.method = methodMatch[1].toUpperCase();
  }

  return parsed;
}
