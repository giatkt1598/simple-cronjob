import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

export const START_AT_FORMAT = "YYYY-MM-DD HH:mm:ss";

/** Validates and normalizes a local Windows time boundary. */
export function normalizeStartAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = dayjs(value, START_AT_FORMAT, true);
  if (!parsed.isValid()) throw new Error(`Invalid startAt "${value}". Expected format: ${START_AT_FORMAT}.`);
  return parsed.format(START_AT_FORMAT);
}

/** Parses a normalized local Windows time boundary with strict dayjs parsing. */
export function parseStartAt(value: string): Dayjs {
  return dayjs(value, START_AT_FORMAT, true);
}
