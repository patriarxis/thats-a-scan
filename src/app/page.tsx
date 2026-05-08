import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { LocatorPage } from "@/components/LocatorPage/LocatorPage";
import { LOCALE } from "@/enums";
import { getHomeSeo } from "@/lib/seo";

const homeSeo = getHomeSeo(LOCALE.EL);

export const metadata: Metadata = {
  title: homeSeo.title,
  description: homeSeo.description,
  alternates: {
    canonical: "/",
    languages: {
      el: "/",
      en: "/en",
    },
  },
  openGraph: {
    locale: "el_GR",
    alternateLocale: "en_US",
    url: "/",
  },
};

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
