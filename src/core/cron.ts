const FIELD_RANGES = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const;

export class CronExpression {
  private readonly fields: Set<number>[];

  constructor(public readonly source: string) {
    const parts = source.trim().split(/\s+/u);
    if (parts.length !== 5) {
      throw new Error(`Cron expression must contain exactly 5 fields: "${source}".`);
    }
    this.fields = parts.map((part, index) => parseField(part, FIELD_RANGES[index]?.[0] ?? 0, FIELD_RANGES[index]?.[1] ?? 0));
  }

  matches(date: Date): boolean {
    const [minutes, hours, days, months, weekdays] = this.fields;
    return minutes!.has(date.getMinutes())
      && hours!.has(date.getHours())
      && days!.has(date.getDate())
      && months!.has(date.getMonth() + 1)
      && weekdays!.has(date.getDay());
  }
}

function parseField(source: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
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
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}
