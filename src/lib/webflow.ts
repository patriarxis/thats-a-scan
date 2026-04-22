const WEBFLOW_API_BASE = "https://api.webflow.com/v2";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_GYMS_COLLECTION_ID = "69ccd9dd5710adfc9709f1a4";

let cachedDescriptions: Map<string, string> | null = null;
let lastFetchTime = 0;

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

interface WebflowItem {
  fieldData: {
    name: string;
    description: string | null;
    [key: string]: unknown;
  };
}

interface WebflowResponse {
  items: WebflowItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export async function fetchWebflowDescriptions(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedDescriptions && now - lastFetchTime < CACHE_TTL) {
    return cachedDescriptions;
  }

  const apiKey = process.env.WEBFLOW_API_KEY;
  const collectionId =
    process.env.WEBFLOW_GYMS_COLLECTION_ID || DEFAULT_GYMS_COLLECTION_ID;

  if (!apiKey) {
    console.error("WEBFLOW_API_KEY is not defined");
    return new Map();
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    accept: "application/json",
  };

  const result = new Map<string, string>();

  try {
    const firstRes = await fetch(
      `${WEBFLOW_API_BASE}/collections/${collectionId}/items?limit=100&offset=0`,
      { headers, cache: "no-store" }
    );

    if (!firstRes.ok) {
      console.error(`Webflow API error: ${firstRes.status} ${firstRes.statusText}`);
      return new Map();
    }

    const firstPage: WebflowResponse = await firstRes.json();
    const { total } = firstPage.pagination;

    for (const item of firstPage.items) {
      const name = item.fieldData?.name;
      const description = item.fieldData?.description;
      if (name && description && description.trim()) {
        result.set(normalizeName(name), description.trim());
      }
    }

    if (total > 100) {
      const remainingOffsets: number[] = [];
      for (let offset = 100; offset < total; offset += 100) {
        remainingOffsets.push(offset);
      }

      const remainingPages = await Promise.all(
        remainingOffsets.map((offset) =>
          fetch(
            `${WEBFLOW_API_BASE}/collections/${collectionId}/items?limit=100&offset=${offset}`,
            { headers, cache: "no-store" }
          ).then((r) => (r.ok ? (r.json() as Promise<WebflowResponse>) : null))
        )
      );

      for (const page of remainingPages) {
        if (!page) continue;
        for (const item of page.items) {
          const name = item.fieldData?.name;
          const description = item.fieldData?.description;
          if (name && description && description.trim()) {
            result.set(normalizeName(name), description.trim());
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Webflow descriptions:", error);
    return new Map();
  }

  cachedDescriptions = result;
  lastFetchTime = now;
  return result;
}
