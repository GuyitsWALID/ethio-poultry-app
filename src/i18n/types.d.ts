import en from "../../messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: "en" | "am";
    Messages: typeof en;
  }
}
