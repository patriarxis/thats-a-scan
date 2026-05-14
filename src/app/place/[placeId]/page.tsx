import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { LocatorPage } from "@/components/LocatorPage/LocatorPage";
import {
  buildStoreOgImageUrl,
  buildStoreUrl,
  fetchStoreDetails,
  getStoreShareText,
  parseCoordinate,
} from "@/lib/storeShare";
import { LOCALE } from "@/enums";

type MetadataProps = {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ lat?: string; lng?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: MetadataProps): Promise<Metadata> {
  const { placeId } = await params;
  const { lat: latRaw, lng: lngRaw } = await searchParams;
  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);

  const metadataUrl = buildStoreUrl(placeId, latRaw, lngRaw, LOCALE.EL);
  let store = null;
  if (lat !== null && lng !== null) {
    store = await fetchStoreDetails(placeId, lat, lng);
  }
  const { title, description } = getStoreShareText(placeId, store, LOCALE.EL);
  const ogImageUrl = buildStoreOgImageUrl(placeId, latRaw, lngRaw, LOCALE.EL);
  const englishUrl = buildStoreUrl(placeId, latRaw, lngRaw, LOCALE.EN);

  return {
    title,
    description,
    alternates: {
      canonical: metadataUrl,
      languages: {
        el: metadataUrl,
        en: englishUrl,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: metadataUrl,
      siteName: "Up Hellas Map",
      locale: "el_GR",
      alternateLocale: "en_US",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function PlacePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
