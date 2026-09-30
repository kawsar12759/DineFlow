/**
 * Structured server logging.
 *
 * In production every entry is one JSON line on stdout/stderr, which Vercel
 * (or any log drain) can search and filter by field. In development it prints
 * a readable line instead. LOG_LEVEL (debug | info | warn | error | silent)
 * sets the threshold; tests default to "silent" so failures stay readable.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVELS: Record<Level | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function threshold() {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVELS) {
    return LEVELS[configured as keyof typeof LEVELS];
  }
  if (process.env.NODE_ENV === "test") return LEVELS.silent;
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

/** Plain-object form of an error, so it survives JSON.stringify. */
export function serializeError(error: unknown): Fields {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...("digest" in error ? { digest: error.digest } : {}),
      ...(error.cause !== undefined ? { cause: serializeError(error.cause) } : {}),
    };
  }
  return { message: String(error) };
}

function normalize(fields: Fields) {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

function write(level: Level, message: string, fields: Fields = {}) {
  if (LEVELS[level] < threshold()) return;

  const stream = level === "error" || level === "warn" ? console.error : console.log;
  const data = normalize(fields);

  if (process.env.NODE_ENV === "production") {
    let line: string;
    try {
      line = JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...data });
    } catch {
      line = JSON.stringify({ time: new Date().toISOString(), level, msg: message });
    }
    stream(line);
    return;
  }

  const extras = Object.keys(data).length > 0 ? [data] : [];
  stream(`[${level}] ${message}`, ...extras);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

/** Short id shown to users on a 500, so support can find the matching log. */
export function newErrorId() {
  return crypto.randomUUID().slice(0, 8);
}
