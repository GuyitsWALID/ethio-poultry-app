import type { Metadata } from "next";
import localFont from "next/font/local";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sand-50 text-forest-900">
        {children}
      </body>
    </html>
  );
}
