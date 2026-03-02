export type GeocodeSuggestion = {
  id: string;
  label: string;
  sublabel: string;
  center: [number, number];
};

type MapboxResponse = {
  features?: Array<{
    id: string;
    place_name: string;
    text: string;
    center: [number, number];
  }>;
};

export async function fetchMapboxSuggestions(
  query: string,
  token?: string
): Promise<GeocodeSuggestion[]> {
  if (!token || query.trim().length < 2) return [];
  const encoded = encodeURIComponent(query.trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?autocomplete=true&limit=6&country=gr&language=el,en&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as MapboxResponse;
  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    label: feature.text,
    sublabel: feature.place_name,
    center: feature.center
  }));
}
