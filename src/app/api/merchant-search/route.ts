import { NextResponse } from "next/server";
import { LOCALE } from "@/enums";
import {
  filterMerchantsForMapSearch,
  searchMerchantSuggestions,
} from "@/lib/merchantSearchIndex";
import { getCachedUpHellasResult } from "@/lib/merchantCatalogueCache";
import { MAP_SEARCH_MAX_FEATURES, SEARCH_MAP_MIN_QUERY_LENGTH } from "@/lib/config";
import { resolveMarkerVisual } from "@/components/MapView/merchantMarkerVisual";
import type { MerchantCategoryId } from "@/lib/merchantCategorization";
import type { ILocale } from "@/types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

function parseLocale(value: string | null): ILocale {
  return value === LOCALE.EN ? LOCALE.EN : LOCALE.EL;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function parseCategoryId(value: string | null): MerchantCategoryId | undefined {
  const trimmed = value?.trim();
  return trimmed ? (trimmed as MerchantCategoryId) : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const locale = parseLocale(url.searchParams.get("locale"));
  const forMap = url.searchParams.get("forMap") === "1";
  const categoryId = parseCategoryId(url.searchParams.get("categoryId"));

  if (forMap) {
    if (!query && !categoryId) {
      return NextResponse.json({
        features: [],
        total: 0,
        truncated: false,
        meta: { cached: false, complete: false },
      });
    }

    if (query.length > 0 && query.length < SEARCH_MAP_MIN_QUERY_LENGTH && !categoryId) {
      return NextResponse.json({
        features: [],
        total: 0,
        truncated: false,
        meta: { cached: false, complete: false },
      });
    }

    try {
      const result = await getCachedUpHellasResult();
      const mapLimit = Math.min(
        MAP_SEARCH_MAX_FEATURES,
        Math.max(1, Number(url.searchParams.get("limit")) || MAP_SEARCH_MAX_FEATURES),
      );
      const { features, total, truncated } = filterMerchantsForMapSearch(
        query,
        result.features,
        locale,
        { categoryId, limit: mapLimit },
      );

      return NextResponse.json({
        features,
        total,
        truncated,
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
      console.error("Failed to search merchants for map:", error);
      return NextResponse.json(
        { error: "Failed to search merchants", features: [], total: 0, truncated: false },
        { status: 500 },
      );
    }
  }

  const limit = parseLimit(url.searchParams.get("limit"));

  if (query.length < 2) {
    return NextResponse.json({
      suggestions: [],
      meta: {
        cached: false,
        complete: false,
      },
    });
  }

  try {
    const result = await getCachedUpHellasResult();
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
