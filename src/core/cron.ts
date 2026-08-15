const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const;

interface ParsedField {
  values: Set<number>;
  wildcard: boolean;
}

/** Parses and evaluates standard numeric five-field cron expressions. */
export class CronExpression {
  private readonly fields: ParsedField[];

  constructor(public readonly source: string) {
    const parts = source.trim().split(/\s+/u);
    if (parts.length !== 5) {
      throw new Error(`Cron expression must contain exactly 5 fields: "${source}".`);
    }
    this.fields = parts.map((part, index) => parseField(
      part,
      FIELD_RANGES[index]?.[0] ?? 0,
      FIELD_RANGES[index]?.[1] ?? 0,
      index === 4,
    ));
  }

  /**
   * Returns whether the expression matches the local date and time.
   *
   * When both day-of-month and day-of-week are restricted, standard cron
   * semantics match when either field matches. Sunday is represented by both
   * `0` and `7`.
   */
  matches(date: Date): boolean {
    const [minutes, hours, days, months, weekdays] = this.fields;
    const dayOfMonthMatches = days!.values.has(date.getDate());
    const dayOfWeekMatches = weekdays!.values.has(date.getDay());
    const dayMatches = days!.wildcard
      ? dayOfWeekMatches
      : weekdays!.wildcard
        ? dayOfMonthMatches
        : dayOfMonthMatches || dayOfWeekMatches;
    return minutes!.values.has(date.getMinutes())
      && hours!.values.has(date.getHours())
      && months!.values.has(date.getMonth() + 1)
      && dayMatches;
  }
}

function parseField(source: string, min: number, max: number, normalizeSunday: boolean): ParsedField {
  const values = new Set<number>();
  const wildcard = source.trim() === "*";
  for (const item of source.split(",")) {
    const [rangeSource, stepSource] = item.split("/");
    const step = stepSource === undefined ? 1 : Number(stepSource);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step in "${source}".`);
    const [startSource, endSource] = rangeSource === "*" ? [String(min), String(max)] : (rangeSource ?? "").split("-");
    const start = Number(startSource);
    const end = endSource === undefined ? start : Number(endSource);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid cron range "${item}"; expected ${min}-${max}.`);
    }
    for (let value = start; value <= end; value += step) {
      values.add(normalizeSunday && value === 7 ? 0 : value);
    }
  }
  return { values, wildcard };
}
