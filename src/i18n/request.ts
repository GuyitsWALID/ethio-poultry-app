import {cookies} from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {isAppLocale, type AppLocale} from "./locale";

export {isAppLocale, supportedLocales, type AppLocale} from "./locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const saved = cookieStore.get("preferred_locale")?.value;
  const locale: AppLocale = isAppLocale(saved) ? saved : "en";
  return {
    locale,
    timeZone: "Africa/Addis_Ababa",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
