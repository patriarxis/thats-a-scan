import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Caveat, IBM_Plex_Mono } from "next/font/google";
import { getSeoDefaults } from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";
import "../globals.scss";

const siteUrl = getSiteUrl();
const defaultMetaImageUrl = "/og-image.svg";
const defaultSeo = getSeoDefaults();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2a231c",
};

const linotte = localFont({
  src: [
    { path: "../fonts/linotte-thin-webfont.woff2", weight: "100", style: "normal" },
    { path: "../fonts/linotte-light-webfont.woff2", weight: "300", style: "normal" },
    { path: "../fonts/linotte-regular-webfont.woff2", weight: "400", style: "normal" },
    { path: "../fonts/linotte-semibold-webfont.woff2", weight: "600", style: "normal" },
    { path: "../fonts/linotte-bold-webfont.woff2", weight: "700", style: "normal" },
    { path: "../fonts/linotte-heavy-webfont.woff2", weight: "800", style: "normal" },
    { path: "../fonts/linotte-black-webfont.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-linotte",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

const archiveMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-archive",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: defaultSeo.title,
    template: "%s | Textures Atlas",
  },
  description: defaultSeo.description,
  keywords: defaultSeo.keywords,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    title: defaultSeo.title,
    description: defaultSeo.description,
    siteName: "Textures Atlas",
    locale: "en_US",
    images: [{ url: defaultMetaImageUrl, width: 1200, height: 630, alt: "Textures Atlas" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultSeo.title,
    description: defaultSeo.description,
    images: [defaultMetaImageUrl],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  manifest: "/site.webmanifest",
};

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${linotte.variable} ${caveat.variable} ${archiveMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
