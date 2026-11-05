export const supportedLocales = ["en", "am"] as const;
export type AppLocale = (typeof supportedLocales)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && supportedLocales.includes(value as AppLocale);
}
