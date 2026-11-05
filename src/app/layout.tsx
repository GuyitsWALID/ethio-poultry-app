import type { Metadata } from "next";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";

import { LocaleProvider } from "@/i18n/locale-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

const fraunces = localFont({
  src: "./fonts/Fraunces-Variable.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

const plexSans = localFont({
  src: "./fonts/IBMPlexSans-Variable.ttf",
  variable: "--font-sans",
  display: "swap",
  weight: "100 700",
});

export const metadata: Metadata = {
  title: "Ethiopoultry Management System",
  description: "Modern poultry operations platform for daily farm efficiency.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sand-50 text-forest-900">
        <LocaleProvider initialLocale={locale}>
          {children}
          <ServiceWorkerRegistration />
        </LocaleProvider>
      </body>
    </html>
  );
}
