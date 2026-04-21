import { MerchantFeature } from "@/types";
import { transliterateGreek, translateGreekAddress } from "./translationUtils";

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

export function mapVenueToMerchantFeature(venue: NyamieVenue): MerchantFeature {
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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 10;
const MAX_PAGES = 50;

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

  const allFeatures: MerchantFeature[] = [];
  let currentStartPage = 1;
  let exhausted = false;

  // Fetch in parallel batches to speed up the process while respecting potential rate limits
  while (currentStartPage <= MAX_PAGES && !exhausted) {
    const batchPages = Array.from({ length: BATCH_SIZE }, (_, i) => currentStartPage + i)
      .filter(p => p <= MAX_PAGES);

    try {
      const batchResults = await Promise.all(
        batchPages.map(async (page) => {
          const response = await fetch(`${apiUrl}?page=${page}`, {
            headers: {
              "X-Api-Key": apiKey,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          });

          if (!response.ok) return [];
          const venues: NyamieVenue[] = await response.json();
          return Array.isArray(venues) ? venues : [];
        })
      );

      for (let i = 0; i < batchResults.length; i++) {
        const venues = batchResults[i];
        if (venues.length === 0) {
          exhausted = true;
          // We found an empty page, but we should still process the pages before this one in the batch
        }
        const features = venues.map(mapVenueToMerchantFeature);
        allFeatures.push(...features);
        
        // If results are less than expected per page (usually 10), we've likely hit the end
        if (venues.length < 10) {
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
