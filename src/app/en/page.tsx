import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { LocatorPage } from "@/components/LocatorPage/LocatorPage";
import { LOCALE } from "@/enums";
import { getHomeSeo } from "@/lib/seo";

const homeSeo = getHomeSeo(LOCALE.EN);

export const metadata: Metadata = {
  title: homeSeo.title,
  description: homeSeo.description,
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      el: "/",
    },
  },
  openGraph: {
    locale: "en_US",
    alternateLocale: "el_GR",
    url: "/en",
  },
};

export default function EnglishHomePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
