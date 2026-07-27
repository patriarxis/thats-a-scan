import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import baseStyle from "./cartoDarkMatterBase.json";
import { ARCHIVE_MAP_PALETTE as c } from "./archiveMapPalette";

type Paint = NonNullable<LayerSpecification["paint"]>;

function setPaint(layer: LayerSpecification, key: string, value: unknown): void {
  if (!layer.paint) layer.paint = {};
  (layer.paint as Record<string, unknown>)[key] = value;
}

function roadLineColor(id: string): string | null {
  if (id.includes("path")) return c.roadPath;
  if (id.includes("service")) return id.includes("case") ? c.roadCase : c.roadService;
  if (id.includes("minor")) return id.includes("case") ? c.roadCase : c.roadMinor;
  if (id.includes("_sec_") || id.includes("bridge_sec") || id.includes("tunnel_sec")) {
    return id.includes("case") ? c.roadCase : c.roadSecondary;
  }
  if (id.includes("_pri_") || id.includes("bridge_pri") || id.includes("tunnel_pri")) {
    return id.includes("case") ? c.roadCase : c.roadPrimary;
  }
  if (id.includes("trunk") || id.includes("_mot_")) {
    return id.includes("case") ? c.roadCase : c.roadMajor;
  }
  if (id.includes("rail")) return c.rail;
  return null;
}

function placeLabelColor(id: string): string {
  if (id.includes("city") || id.includes("capital") || id.includes("country_1")) {
    return c.labelPrimary;
  }
  if (id.includes("country") || id.includes("state") || id.includes("continent")) {
    return c.labelSecondary;
  }
  return c.labelMuted;
}

function setLayout(layer: LayerSpecification, key: string, value: unknown): void {
  if (!layer.layout) layer.layout = {};
  (layer.layout as Record<string, unknown>)[key] = value;
}

/** Prefer English names; fall back to local name when no translation exists. */
const ENGLISH_TEXT_FIELD = ["coalesce", ["get", "name_en"], ["get", "name"]] as const;

function applyEnglishLabels(layer: LayerSpecification): void {
  if (layer.type !== "symbol") return;
  const layout = layer.layout as Record<string, unknown> | undefined;
  if (!layout || !("text-field" in layout)) return;

  const field = layout["text-field"];
  // Keep non-name labels (e.g. housenumber) unchanged.
  const fieldStr = typeof field === "string" ? field : JSON.stringify(field);
  if (fieldStr.includes("housenumber")) return;
  if (!fieldStr.includes("name")) return;

  setLayout(layer, "text-field", [...ENGLISH_TEXT_FIELD]);
}

function applyLayerPalette(layer: LayerSpecification): void {
  const id = layer.id;

  if (layer.type === "background") {
    setPaint(layer, "background-color", c.background);
    return;
  }

  if (layer.type === "fill") {
    if (id.startsWith("water") || id === "water_shadow") {
      setPaint(layer, "fill-color", id === "water_shadow" ? c.waterway : c.water);
      return;
    }
    if (id.includes("building")) {
      setPaint(layer, "fill-color", id.includes("top") ? c.buildingTop : c.building);
      setPaint(layer, "fill-opacity", id.includes("top") ? 0.9 : 0.72);
      return;
    }
    if (id.includes("park") || id.includes("landcover")) {
      setPaint(layer, "fill-color", c.park);
      return;
    }
    if (id.includes("landuse")) {
      setPaint(layer, "fill-color", c.landuse);
      return;
    }
    if (id.includes("aeroway")) {
      setPaint(layer, "fill-color", c.land);
      return;
    }
    setPaint(layer, "fill-color", c.land);
    return;
  }

  if (layer.type === "line") {
    if (id.includes("waterway")) {
      setPaint(layer, "line-color", c.waterway);
      return;
    }
    if (id.includes("boundary")) {
      setPaint(layer, "line-color", c.boundary);
      setPaint(layer, "line-opacity", 0.55);
      return;
    }
    const roadColor = roadLineColor(id);
    if (roadColor) {
      setPaint(layer, "line-color", roadColor);
      return;
    }
  }

  if (layer.type === "symbol") {
    applyEnglishLabels(layer);

    const paint = layer.paint as Paint | undefined;
    if (!paint) return;

    if ("text-color" in paint) {
      if (id.includes("watername") || id.includes("waterway_label")) {
        setPaint(layer, "text-color", c.labelWater);
      } else if (id.includes("roadname")) {
        setPaint(layer, "text-color", c.labelMuted);
      } else if (id.startsWith("place_")) {
        setPaint(layer, "text-color", placeLabelColor(id));
      } else {
        setPaint(layer, "text-color", c.labelSecondary);
      }
    }

    if ("text-halo-color" in paint) {
      setPaint(layer, "text-halo-color", c.labelHalo);
      setPaint(layer, "text-halo-width", 1.2);
    }
  }
}

/** Carto vector basemap recolored to match the archive modal palette. */
export function buildArchiveMapStyle(): StyleSpecification {
  const style = structuredClone(baseStyle) as StyleSpecification;
  style.name = "Textures Atlas — Archive Field Map";

  for (const layer of style.layers) {
    applyLayerPalette(layer as LayerSpecification);
  }

  return style;
}
