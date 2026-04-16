import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.scss";

const DEFAULT_SITE_URL = "https://map.uphellas.gr";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
  : new URL(DEFAULT_SITE_URL);

const homeOgImageUrl = "/og-home.png";

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
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    title: "Up Hellas | Map",
    description: "Interactive map of all partner merchants by Up Hellas.",
    siteName: "Up Hellas Map",
    locale: "el_GR",
    images: [{ url: homeOgImageUrl, width: 1200, height: 630, alt: "Up Hellas Map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Up Hellas | Map",
    description: "Interactive map of all partner merchants by Up Hellas.",
    images: [homeOgImageUrl],
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
