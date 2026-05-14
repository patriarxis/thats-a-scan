import { ImageResponse } from "next/og";
import { parseCoordinate } from "@/lib/storeShare";
import { ICONS } from "@/enums";
import { IconVectorRegistry } from "@/components/ui/Icons/iconVectors";

const imageSize = {
  width: 1200,
  height: 630,
};

const PIN_ORANGE = "#f59100";
const MAP_PIN_VECTOR = IconVectorRegistry[ICONS.MAP_PIN];

const buildStaticMapUrl = (lat: number, lng: number): string | null => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const center = `${lng},${lat},15.5,0`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${center}/1200x630?access_token=${token}`;
};

const resolveRenderableMapImageUrl = async (candidate: string | null): Promise<string | null> => {
  if (!candidate) return null;
  try {
    const response = await fetch(candidate, { cache: "no-store" });
    return response.ok ? candidate : null;
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat") ?? undefined;
  const lngRaw = searchParams.get("lng") ?? undefined;
  const lat = parseCoordinate(latRaw);
  const lng = parseCoordinate(lngRaw);

  const mapImageUrlCandidate =
    lat !== null && lng !== null ? buildStaticMapUrl(lat, lng) : null;
  const mapImageUrl = await resolveRenderableMapImageUrl(mapImageUrlCandidate);
  const logoUrl = new URL("/up-hellas-logo.svg", request.url).toString();
  const mapPinPath = MAP_PIN_VECTOR?.paths[0] ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#020617",
        }}
      >
        {mapImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapImageUrl}
            alt=""
            width={1200}
            height={630}
            style={{ objectFit: "cover", width: "1200px", height: "630px" }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at center, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.55) 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -100%)",
            width: "56px",
            height: "56px",
            filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.35))",
          }}
        >
          <svg viewBox="0 0 256 256" width="56" height="56" fill="none">
            <path d={mapPinPath} fill={PIN_ORANGE} />
            <circle cx="128" cy="104" r="22" fill="#1f2937" />
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "24px",
            top: "24px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Up Hellas"
            width={130}
            height={52}
            style={{ width: "130px", height: "52px", objectFit: "contain" }}
          />
        </div>
      </div>
    ),
    imageSize,
  );
}
