import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.scss";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL(DEFAULT_SITE_URL);

const defaultMetaImageUrl = "/meta-image.jpg";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

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
  metadataBase: siteUrl,
  title: "Up Hellas | Map",
  description: "Interactive map of all partner merchants by Up Hellas.",
  openGraph: {
    type: "website",
    url: "/",
    title: "Up Hellas | Map",
    description: "Interactive map of all partner merchants by Up Hellas.",
    siteName: "Up Hellas Map",
    locale: "el_GR",
    images: [{ url: defaultMetaImageUrl, width: 1200, height: 630, alt: "Up Hellas Map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Up Hellas | Map",
    description: "Interactive map of all partner merchants by Up Hellas.",
    images: [defaultMetaImageUrl],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-locale") === "en" ? "en" : "el";

  return (
    <html lang={locale} className={linotte.variable}>
      <body>{children}</body>
    </html>
  );
}
