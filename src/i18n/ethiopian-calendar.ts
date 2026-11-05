// Calendar conversion stays at the UI boundary. API and database dates stay ISO Gregorian.
export type EthiopianDate = {year: number; month: number; day: number};
const dayMs = 86_400_000;
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  calendar: "ethiopic", numberingSystem: "latn", timeZone: "UTC",
  year: "numeric", month: "numeric", day: "numeric",
});

function partsAt(time: number): EthiopianDate {
  const parts = partsFormatter.formatToParts(new Date(time));
  const get = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  return {year: get("year"), month: get("month"), day: get("day")};
}

export function toEthiopianDate(iso: string): EthiopianDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return partsAt(date.getTime());
}

// Use ICU's calendar rules in both directions, including Pagume and leap years.
// Binary search avoids an independently maintained calendar conversion formula.
export function toGregorianDate(value: EthiopianDate): string | null {
  if (!Number.isInteger(value.year) || value.year < 1 || value.year > 9990 ||
      !Number.isInteger(value.month) || value.month < 1 || value.month > 13 ||
      !Number.isInteger(value.day) || value.day < 1 || value.day > (value.month === 13 ? 6 : 30)) return null;
  let low = Math.floor(Date.UTC(value.year + 7, 0, 1) / dayMs);
  let high = Math.floor(Date.UTC(value.year + 9, 11, 31) / dayMs);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const current = partsAt(middle * dayMs);
    const difference = current.year - value.year || current.month - value.month || current.day - value.day;
    if (!difference) return new Date(middle * dayMs).toISOString().slice(0, 10);
    if (difference < 0) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

export function ethiopianMonthDays(year: number, month: number) {
  return month === 13 ? (toGregorianDate({year, month, day: 6}) ? 6 : 5) : 30;
}

export function ethiopianMonthNames() {
  const formatter = new Intl.DateTimeFormat("am-ET", {calendar: "ethiopic", month: "long", timeZone: "UTC"});
  return Array.from({length: 13}, (_, index) => formatter.format(new Date(`${toGregorianDate({year: 2019, month: index + 1, day: 1})}T00:00:00Z`)));
}

export function isDateInRange(iso: string, min?: string, max?: string) {
  return Boolean(toEthiopianDate(iso)) && (!min || iso >= min) && (!max || iso <= max);
}
