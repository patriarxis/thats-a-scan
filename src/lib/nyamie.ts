import { MerchantFeature } from "@/types";
import { transliterateGreek, translateGreekAddress } from "./translationUtils";
import { fetchWebflowDescriptions, normalizeName } from "./webflow";

export interface NyamieVenue {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  rating: string;
  address: {
    city: string;
    city_slug: string;
    street: string;
    number: string;
  };
  photos: Array<{
    path: string;
    url: {
      small: string;
      medium: string;
      large: string;
    };
    is_featured: boolean;
    sequence_nbr: number;
  }>;
  social_networks: {
    facebook: string | null;
    instagram: string | null;
    twitter: string | null;
    youtube: string | null;
  };
  website: string | null;
  phones: Array<string | null>;
  about_us: {
    html: string;
    plain_text: string;
  };
  disciplines: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

export function mapVenueToMerchantFeature(
  venue: NyamieVenue,
  grDescriptions?: Map<string, string>
): MerchantFeature {
  const addressStr = `${venue.address.street} ${venue.address.number}, ${venue.address.city}`;

  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [venue.lng, venue.lat],
    },
    properties: {
      ID: venue.slug,
      MerchantId: venue.slug,
      BrandNameGR: venue.name,
      BrandNameEN: transliterateGreek(venue.name),
      AddressGR: addressStr,
      AddressEN: translateGreekAddress(addressStr),
      TownGR: venue.address.city,
      TownEN: translateGreekAddress(venue.address.city),
      MCCCategoryGR: venue.disciplines.map((d) => d.name).join(", "),
      MCCCategoryEN: venue.disciplines
        .map((d) => transliterateGreek(d.name))
        .join(", "),
      Phone: venue.phones.find((p) => p !== null) || "",
      Website: venue.website || "",
      FacebookUrl: venue.social_networks.facebook || "",
      InstagramUrl: venue.social_networks.instagram || "",
      Description: venue.about_us.plain_text,
      DescriptionEN: venue.about_us.plain_text,
      DescriptionGR: grDescriptions?.get(normalizeName(venue.name)) ?? "",
      nyamie_slug: venue.slug,
      rating: venue.rating,
      logo:
        venue.photos.find((p) => p.is_featured)?.url.large ||
        venue.photos[0]?.url.large,
      featured_photo:
        venue.photos.find((p) => p.is_featured)?.url.large ||
        venue.photos[0]?.url.large,
      extra_photos: venue.photos
        .filter((p) => !p.is_featured && p !== venue.photos[0])
        .map((p) => p.url.medium),
      photos: venue.photos.map((p) => p.url.medium),
    },
  };
}

let cachedVenues: MerchantFeature[] | null = null;
let lastFetchTime: number = 0;
let cachedDescriptions: Map<string, string> | null = null;
let lastDescriptionsFetchTime = 0;
const CACHE_TTL = 30 * 60 * 1000;
const DESCRIPTIONS_CACHE_TTL = 30 * 60 * 1000;
const BATCH_SIZE = 10;
const MAX_PAGES = 50;
const PAGE_SIZE = 10;
const MAX_RETRIES = 2;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVenuesPage(
  apiUrl: string,
  apiKey: string,
  page: number,
): Promise<NyamieVenue[] | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}?page=${page}`, {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const venues: NyamieVenue[] = await response.json();
        return Array.isArray(venues) ? venues : [];
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === MAX_RETRIES) {
        console.error(
          `Nyamie page ${page} failed with status ${response.status} after ${attempt + 1} attempt(s).`,
        );
        return null;
      }
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `Nyamie page ${page} failed after ${attempt + 1} attempt(s):`,
          error,
        );
        return null;
      }
    }

    await sleep(300 * (attempt + 1));
  }

  return null;
}

export async function fetchAllVenues(): Promise<MerchantFeature[]> {
  const now = Date.now();
  if (cachedVenues && now - lastFetchTime < CACHE_TTL) {
    return cachedVenues;
  }

  const apiKey = process.env.NYAMIE_API_KEY;
  const apiUrl =
    process.env.NYAMIE_API_URL || "https://nyamie.com/api/v1/venues";

  if (!apiKey) {
    console.error("NYAMIE_API_KEY is not defined");
    return [];
  }

  const shouldRefreshDescriptions =
    !cachedDescriptions ||
    now - lastDescriptionsFetchTime >= DESCRIPTIONS_CACHE_TTL;
  if (shouldRefreshDescriptions) {
    cachedDescriptions = await fetchWebflowDescriptions().catch((error) => {
      console.error("Failed to fetch Webflow gym descriptions:", error);
      return new Map<string, string>();
    });
    lastDescriptionsFetchTime = now;
  }
  const grDescriptions = cachedDescriptions ?? new Map<string, string>();

  const allFeatures: MerchantFeature[] = [];
  let currentStartPage = 1;
  let exhausted = false;
  let successfulPages = 0;
  let failedPages = 0;
  let emptyPages = 0;
  let partialPages = 0;

  while (currentStartPage <= MAX_PAGES && !exhausted) {
    const batchPages = Array.from({ length: BATCH_SIZE }, (_, i) => currentStartPage + i)
      .filter(p => p <= MAX_PAGES);

    try {
      const batchResults = await Promise.all(
        batchPages.map((page) => fetchVenuesPage(apiUrl, apiKey, page))
      );

      for (let i = 0; i < batchResults.length; i++) {
        const venues = batchResults[i];

        if (!venues) {
          failedPages += 1;
          continue;
        }
        successfulPages += 1;

        if (venues.length === 0) {
          exhausted = true;
          emptyPages += 1;
        }
        const features = venues.map((venue) =>
          mapVenueToMerchantFeature(venue, grDescriptions)
        );
        allFeatures.push(...features);
        
        if (venues.length < PAGE_SIZE) {
          partialPages += 1;
          exhausted = true;
          break; 
        }
      }

      if (exhausted) break;
      currentStartPage += BATCH_SIZE;
    } catch (error) {
      console.error(`Error fetching Nyamie venues batch starting at ${currentStartPage}:`, error);
      break;
    }
  }

  cachedVenues = allFeatures;
  lastFetchTime = now;
  return allFeatures;
}
