import type { Map as MapLibreMap } from "maplibre-gl";
import { getTextureId, type TextureFeature } from "@/domain/textures/types";
import {
  buildActiveMarkerIconId,
  buildMarkerIconId,
  resolveMarkerColor,
} from "./textureMarkerVisual";
import { MARKER_ICON_DEFAULT_ID } from "./mapViewConstants";

const MARKER_CANVAS_DISPLAY_PX = 36;
const pendingLoads = new Map<string, Promise<void>>();

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawFallbackMarkerIcon = (
  map: MapLibreMap,
  iconId: string,
  color: string,
  isActive: boolean,
) => {
  const displaySize = MARKER_CANVAS_DISPLAY_PX;
  const size = displaySize * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  const pad = 6;
  const inner = size - pad * 2;

  if (isActive) {
    ctx.fillStyle = color;
    drawRoundedRect(ctx, pad - 2, pad - 2, inner + 4, inner + 4, 10);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    drawRoundedRect(ctx, pad, pad, inner, inner, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  if (map.hasImage(iconId)) map.removeImage(iconId);
  map.addImage(iconId, imageData, { pixelRatio: 2 });
};

export const ensureDefaultMarkerIcon = (map: MapLibreMap) => {
  if (map.hasImage(MARKER_ICON_DEFAULT_ID)) return;
  drawFallbackMarkerIcon(map, MARKER_ICON_DEFAULT_ID, "#ff8500", false);
};

const loadImageElement = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const isCrossOrigin =
      url.startsWith("http") &&
      typeof window !== "undefined" &&
      !url.startsWith(window.location.origin);
    if (isCrossOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load marker preview: ${url}`));
    img.src = url;
  });

const drawPreviewMarkerIcon = (
  map: MapLibreMap,
  iconId: string,
  image: HTMLImageElement,
  isActive: boolean,
) => {
  const displaySize = MARKER_CANVAS_DISPLAY_PX;
  const size = displaySize * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  const pad = isActive ? 4 : 6;
  const inner = size - pad * 2;
  const radius = isActive ? 10 : 8;

  drawRoundedRect(ctx, pad, pad, inner, inner, radius);
  ctx.save();
  ctx.clip();
  ctx.drawImage(image, pad, pad, inner, inner);
  ctx.restore();

  ctx.strokeStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.9)";
  ctx.lineWidth = isActive ? 3 : 2.5;
  ctx.stroke();

  const imageData = ctx.getImageData(0, 0, size, size);
  if (map.hasImage(iconId)) map.removeImage(iconId);
  map.addImage(iconId, imageData, { pixelRatio: 2 });
};

const loadPreviewMarkerIcons = async (
  map: MapLibreMap,
  texture: TextureFeature,
  thumbnailUrl: string,
  fallbackColor: string,
) => {
  const textureId = getTextureId(texture);
  const iconId = buildMarkerIconId(textureId);
  const activeIconId = buildActiveMarkerIconId(textureId);

  try {
    const image = await loadImageElement(thumbnailUrl);
    drawPreviewMarkerIcon(map, iconId, image, false);
    drawPreviewMarkerIcon(map, activeIconId, image, true);
    map.triggerRepaint();
  } catch {
    drawFallbackMarkerIcon(map, iconId, fallbackColor, false);
    drawFallbackMarkerIcon(map, activeIconId, fallbackColor, true);
    map.triggerRepaint();
  }
};

export const ensureTextureMarkerIcons = (map: MapLibreMap, textures: TextureFeature[]) => {
  ensureDefaultMarkerIcon(map);

  for (const texture of textures) {
    const textureId = getTextureId(texture);
    const color = resolveMarkerColor(texture);
    const iconId = buildMarkerIconId(textureId);
    const activeIconId = buildActiveMarkerIconId(textureId);

    drawFallbackMarkerIcon(map, iconId, color, false);
    drawFallbackMarkerIcon(map, activeIconId, color, true);

    const thumbnailUrl = texture.properties.thumbnailUrl || texture.properties.previewUrl;
    if (!thumbnailUrl || pendingLoads.has(iconId)) continue;

    const loadPromise = loadPreviewMarkerIcons(map, texture, thumbnailUrl, color).finally(() => {
      pendingLoads.delete(iconId);
    });
    pendingLoads.set(iconId, loadPromise);
  }
};
