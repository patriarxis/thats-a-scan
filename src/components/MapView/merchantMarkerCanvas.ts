import type { Map as MapboxMap } from "mapbox-gl";
import { ICONS } from "@/enums";
import type { PartnerFeature } from "@/types";
import { IconVectorRegistry } from "@/components/ui/Icons/iconVectors";
import {
  buildActiveMarkerIconId,
  buildMarkerIconId,
  PRODUCT_COLORS,
  resolveMarkerVisual,
  type MarkerGlyphKey,
  type ProductDotKey,
} from "./merchantMarkerVisual";

const MARKER_CANVAS_DISPLAY_PX = 36;
const DOT_GAP_FROM_CIRCLE_PX = 5;

const drawSvgPaths = (
  ctx: CanvasRenderingContext2D,
  paths: string[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  color: string,
  canvasSize: number,
) => {
  const iconTargetSize = 28;
  const left = (canvasSize - iconTargetSize) / 2;
  const top = (canvasSize - iconTargetSize) / 2;
  const scale = Math.min(iconTargetSize / viewBoxWidth, iconTargetSize / viewBoxHeight);
  const drawnWidth = viewBoxWidth * scale;
  const drawnHeight = viewBoxHeight * scale;
  const dx = left + (iconTargetSize - drawnWidth) / 2;
  const dy = top + (iconTargetSize - drawnHeight) / 2;

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  for (const path of paths) {
    ctx.fill(new Path2D(path));
  }
  ctx.restore();
};

const drawMapPinAsMarkerBody = (ctx: CanvasRenderingContext2D, fillColor: string, canvasSize: number) => {
  const vector = IconVectorRegistry[ICONS.MAP_PIN];
  if (!vector || !vector.paths[0]) return;
  const { paths, viewBoxWidth, viewBoxHeight } = vector;
  const d = paths[0];
  const targetH = canvasSize * 0.8;
  const scale = targetH / viewBoxHeight;
  const dw = viewBoxWidth * scale;
  const dh = viewBoxHeight * scale;
  const dx = (canvasSize - dw) / 2;
  const dy = (canvasSize - dh) / 2 - 6;

  const pinPath = new Path2D(d);

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);
  ctx.fillStyle = fillColor;
  ctx.fill(pinPath, "evenodd");
  ctx.restore();
};

const ensureMarkerIcon = (
  map: MapboxMap,
  iconId: string,
  iconKey: MarkerGlyphKey,
  circleFill: string,
  mainColor: string,
  products: ProductDotKey[],
  selectedPinFill?: string,
) => {
  if (map.hasImage(iconId)) return;
  const displaySize = MARKER_CANVAS_DISPLAY_PX;
  const size = displaySize * 2;
  const center = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);

  const circleRadius = 25;
  const dotRadius = 4;
  let dotColumnX = center + circleRadius + DOT_GAP_FROM_CIRCLE_PX + dotRadius;

  if (iconKey === ICONS.MAP_PIN) {
    drawMapPinAsMarkerBody(ctx, selectedPinFill ?? mainColor, size);
  } else {
    ctx.beginPath();
    ctx.arc(center, center, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = circleFill;
    ctx.fill();
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const iconVector = IconVectorRegistry[iconKey];
    if (iconVector) {
      drawSvgPaths(
        ctx,
        iconVector.paths,
        iconVector.viewBoxWidth,
        iconVector.viewBoxHeight,
        "#ffffff",
        size,
      );
    }
    dotColumnX = Math.min(size - dotRadius - 1, dotColumnX);
  }

  const dotGap = 3;
  const dotCount = Math.min(products.length, 6);
  if (iconKey !== ICONS.MAP_PIN && dotCount > 0) {
    const blockHeight = dotCount * dotRadius * 2 + (dotCount - 1) * dotGap;
    const startY = center - blockHeight / 2 + dotRadius;
    const dotX = Math.min(size - dotRadius - 1, dotColumnX);
    for (let i = 0; i < dotCount; i++) {
      const product = products[i];
      const y = startY + i * (dotRadius * 2 + dotGap);
      ctx.fillStyle = PRODUCT_COLORS[product];
      ctx.beginPath();
      ctx.arc(dotX, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(17,24,39,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  map.addImage(iconId, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
};

export const ensureMarkerIcons = (map: MapboxMap, partners: PartnerFeature[]) => {
  for (const partner of partners) {
    const visual = resolveMarkerVisual(partner.properties);
    const iconId = buildMarkerIconId(
      visual.iconKey,
      visual.mainColor,
      visual.circleFill,
      visual.products,
    );
    ensureMarkerIcon(map, iconId, visual.iconKey, visual.circleFill, visual.mainColor, visual.products);
    const activeId = buildActiveMarkerIconId(visual.selectedPinFill, visual.products);
    ensureMarkerIcon(
      map,
      activeId,
      ICONS.MAP_PIN,
      visual.circleFill,
      visual.mainColor,
      visual.products,
      visual.selectedPinFill,
    );
  }
};
