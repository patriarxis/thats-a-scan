import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.scss";

const linotte = localFont({
  src: [
    {
      path: "./fonts/linotte-thin-webfont.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/linotte-light-webfont.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/linotte-regular-webfont.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/linotte-semibold-webfont.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/linotte-bold-webfont.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/linotte-heavy-webfont.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/linotte-black-webfont.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-linotte",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Merchants Map | Up Hellas",
  description: "Interactive map of all partner merchants powered by Up Hellas."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="el" className={linotte.variable}>
      <body>{children}</body>
    </html>
  );
}
