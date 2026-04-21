import { MerchantFeature } from "@/types";

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
      BrandNameEN: venue.name, // Fallback to same as GR if not available
      AddressGR: addressStr,
      AddressEN: addressStr,
      TownGR: venue.address.city,
      TownEN: venue.address.city,
      MCCCategoryGR: venue.disciplines.map((d) => d.name).join(", "),
      MCCCategoryEN: venue.disciplines.map((d) => d.name).join(", "),
      // Align with UI expectations in PartnerDetailSheet.tsx
      Phone: venue.phones.find((p) => p !== null) || "",
      Website: venue.website || "",
      FacebookUrl: venue.social_networks.facebook || "",
      InstagramUrl: venue.social_networks.instagram || "",
      Description: venue.about_us.plain_text,
      // Custom Nyamie fields
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

export async function fetchAllVenues(): Promise<MerchantFeature[]> {
  const apiKey = process.env.NYAMIE_API_KEY;
  const apiUrl =
    process.env.NYAMIE_API_URL || "https://nyamie.com/api/v1/venues";

  if (!apiKey) {
    console.error("NYAMIE_API_KEY is not defined");
    return [];
  }

  let allFeatures: MerchantFeature[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetch(`${apiUrl}?page=${page}`, {
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        console.error(
          `Failed to fetch Nyamie venues page ${page}: ${response.statusText}`,
        );
        break;
      }

      const venues: NyamieVenue[] = await response.json();

      if (!venues || venues.length === 0) {
        hasMore = false;
        break;
      }

      const features = venues.map(mapVenueToMerchantFeature);
      allFeatures = [...allFeatures, ...features];

      // If we got fewer than 10 items (assuming 10 is the page size based on initial tests), we reached the end
      if (venues.length < 10) {
        hasMore = false;
      } else {
        page++;
      }

      // Safety break to avoid infinite loops if API behaves weirdly
      if (page > 50) break;
    } catch (error) {
      console.error(`Error fetching Nyamie venues page ${page}:`, error);
      break;
    }
  }

  return allFeatures;
}
