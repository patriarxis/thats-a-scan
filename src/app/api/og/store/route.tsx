import { ImageResponse } from "next/og";
import {
  fetchStoreDetails,
  getStoreShareText,
  parseCoordinate,
} from "@/lib/storeShare";

export const runtime = "edge";
const imageSize = {
  width: 1200,
  height: 630,
};

const CATEGORY_COLORS: Record<string, string> = {
  meal: "#f59e0b",
  rewards: "#8f499c",
  expenses: "#3b82f6",
  gyms: "#ef4444",
};

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const buildStaticMapUrl = (lat: number, lng: number): string | null => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const marker = `pin-s+8f499c(${lng},${lat})`;
  const center = `${lng},${lat},14,0`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${center}/760x630?access_token=${token}`;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId") ?? searchParams.get("store") ?? "";
  const latRaw = searchParams.get("lat") ?? undefined;
  const lngRaw = searchParams.get("lng") ?? undefined;
  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);

  let store = null;
  if (storeId && lat !== null && lng !== null) {
    store = await fetchStoreDetails(storeId, lat, lng);
  }

  const share = getStoreShareText(storeId || "unknown", store);
  const accent = CATEGORY_COLORS[share.category] ?? CATEGORY_COLORS.rewards;
  const mapImageUrl =
    lat !== null && lng !== null ? buildStaticMapUrl(lat, lng) : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          backgroundColor: "#0b1020",
          color: "#f8fafc",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "760px",
            height: "630px",
            display: "flex",
            overflow: "hidden",
            background:
              "linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(2,6,23,1) 100%)",
          }}
        >
          {mapImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapImageUrl}
              alt=""
              width={760}
              height={630}
              style={{ objectFit: "cover", width: "760px", height: "630px" }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                mapImageUrl
                  ? "linear-gradient(180deg, rgba(2,6,23,0.2) 0%, rgba(2,6,23,0.75) 100%)"
                  : "linear-gradient(180deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,1) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: "30px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "999px",
              backgroundColor: "rgba(2,6,23,0.7)",
              border: `1px solid ${accent}`,
              fontSize: "24px",
              fontWeight: 700,
            }}
          >
            <span>Up Hellas</span>
          </div>
        </div>

        <div
          style={{
            width: "440px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px 38px",
            backgroundColor: "#020617",
            borderLeft: `4px solid ${accent}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 12px",
                borderRadius: "999px",
                backgroundColor: "rgba(148,163,184,0.2)",
                color: "#cbd5e1",
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              Partner store
            </div>

            <div
              style={{
                fontSize: "48px",
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {truncate(share.title.replace(" | Up Hellas Map", ""), 52)}
            </div>

            <div
              style={{
                color: "#cbd5e1",
                fontSize: "26px",
                lineHeight: 1.35,
                minHeight: "140px",
              }}
            >
              {truncate(share.address || "Open this location on the Up Hellas map.", 120)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "22px",
              color: "#94a3b8",
            }}
          >
            <span>uphellas.gr/map</span>
            <span style={{ color: accent, fontWeight: 700 }}>View on map</span>
          </div>
        </div>
      </div>
    ),
    imageSize,
  );
}
