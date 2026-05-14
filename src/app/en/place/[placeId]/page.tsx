import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { LocatorPage } from "@/components/LocatorPage/LocatorPage";
import { LOCALE } from "@/enums";
import {
  buildStoreOgImageUrl,
  buildStoreUrl,
  fetchStoreDetails,
  getStoreShareText,
  parseCoordinate,
} from "@/lib/storeShare";

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

  const metadataUrl = buildStoreUrl(placeId, latRaw, lngRaw, LOCALE.EN);
  let store = null;
  if (lat !== null && lng !== null) {
    store = await fetchStoreDetails(placeId, lat, lng);
  }
  const { title, description } = getStoreShareText(placeId, store, LOCALE.EN);
  const ogImageUrl = buildStoreOgImageUrl(placeId, latRaw, lngRaw, LOCALE.EN);
  const greekUrl = buildStoreUrl(placeId, latRaw, lngRaw, LOCALE.EL);

  return {
    title,
    description,
    alternates: {
      canonical: metadataUrl,
      languages: {
        en: metadataUrl,
        el: greekUrl,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: metadataUrl,
      siteName: "Up Hellas Map",
      locale: "en_US",
      alternateLocale: "el_GR",
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

export default function EnglishPlacePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
