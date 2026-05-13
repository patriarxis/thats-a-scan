import { NextResponse } from "next/server";
import { LOCALE } from "@/enums";
import { searchMerchantSuggestions } from "@/lib/merchantSearchIndex";
import {
  fetchAllUpHellasFeatures,
  GREECE_UP_HELLAS_BOUNDS,
  type UpHellasFetchResult,
} from "@/lib/upHellasMerchants";
import { resolveMarkerVisual } from "@/components/MapView/merchantMarkerVisual";
import type { ILocale } from "@/types";

const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

let cachedUpHellasResult: UpHellasFetchResult | null = null;
let cachedAt = 0;
let pendingFetch: Promise<UpHellasFetchResult> | null = null;

function parseLocale(value: string | null): ILocale {
  return value === LOCALE.EN ? LOCALE.EN : LOCALE.EL;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

async function getCachedNationwideMerchants(): Promise<UpHellasFetchResult> {
  const now = Date.now();
  if (cachedUpHellasResult && now - cachedAt < SEARCH_CACHE_TTL_MS) {
    return cachedUpHellasResult;
  }

  if (!pendingFetch) {
    pendingFetch = fetchAllUpHellasFeatures(GREECE_UP_HELLAS_BOUNDS).finally(() => {
      pendingFetch = null;
    });
  }

  cachedUpHellasResult = await pendingFetch;
  cachedAt = Date.now();
  return cachedUpHellasResult;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const locale = parseLocale(url.searchParams.get("locale"));
  const limit = parseLimit(url.searchParams.get("limit"));

  if (query.length < 2) {
    return NextResponse.json({
      suggestions: [],
      meta: {
        cached: Boolean(cachedUpHellasResult),
        complete: cachedUpHellasResult?.complete ?? false,
      },
    });
  }

  try {
    const result = await getCachedNationwideMerchants();
    const suggestions = searchMerchantSuggestions(
      query,
      result.features,
      locale,
      limit,
    ).map((suggestion) => {
      const feature = result.features.find(
        (item) =>
          String(
            item.properties.ID ??
              item.properties.MerchantId ??
              item.properties.mongo_id ??
              "",
          ) === suggestion.merchantId,
      );

      return {
        type: "merchant" as const,
        id: `global:${suggestion.id}`,
        label: suggestion.label,
        sublabel: suggestion.sublabel,
        merchantId: suggestion.merchantId,
        coordinates: suggestion.coordinates,
        icon: feature ? resolveMarkerVisual(feature.properties).iconKey : undefined,
        source: "up_hellas",
        score: suggestion.score,
      };
    });

    return NextResponse.json({
      suggestions,
      meta: {
        totalMerchants: result.features.length,
        requestCount: result.requestCount,
        saturatedBoundsCount: result.saturatedBoundsCount,
        stoppedByRequestLimit: result.stoppedByRequestLimit,
        complete: result.complete,
        cached: true,
      },
    });
  } catch (error) {
    console.error("Failed to search nationwide merchants:", error);
    return NextResponse.json(
      { error: "Failed to search merchants", suggestions: [] },
      { status: 500 },
    );
  }
}
