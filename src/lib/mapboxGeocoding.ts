import { GEOCODING_FETCH_TIMEOUT_MS, GEOCODING_MIN_QUERY_LENGTH, GEOCODING_RESULT_LIMIT } from "@/lib/config";

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
  token?: string,
  signal?: AbortSignal
): Promise<GeocodeSuggestion[]> {
  if (!token || query.trim().length < GEOCODING_MIN_QUERY_LENGTH) return [];
  const encoded = encodeURIComponent(query.trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?autocomplete=true&limit=${GEOCODING_RESULT_LIMIT}&country=gr&language=el,en&access_token=${token}`;

  try {
    const timeoutSignal = AbortSignal.timeout(GEOCODING_FETCH_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const res = await fetch(url, { signal: requestSignal });
    if (!res.ok) return [];
    const data = (await res.json()) as MapboxResponse;
    return (data.features ?? []).map((feature) => ({
      id: feature.id,
      label: feature.text,
      sublabel: feature.place_name,
      center: feature.center
    }));
  } catch {
    return [];
  }
}
