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
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ lat?: string; lng?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: MetadataProps): Promise<Metadata> {
  const { storeId } = await params;
  const { lat: latRaw, lng: lngRaw } = await searchParams;
  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);

  const metadataUrl = buildStoreUrl(storeId, latRaw, lngRaw, LOCALE.EN);
  let store = null;
  if (lat !== null && lng !== null) {
    store = await fetchStoreDetails(storeId, lat, lng);
  }
  const { title, description } = getStoreShareText(storeId, store);
  const ogImageUrl = buildStoreOgImageUrl(storeId, latRaw, lngRaw);

  return {
    title,
    description,
    alternates: { canonical: metadataUrl },
    openGraph: {
      type: "website",
      title,
      description,
      url: metadataUrl,
      siteName: "Up Hellas Map",
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

export default function EnglishStorePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
