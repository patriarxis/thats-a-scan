import type { CollectionConfig } from "payload";
import { TEXTURE_CATEGORY_OPTIONS } from "../constants/categories.ts";
import { enrichTextureFromMedia } from "../hooks/enrichTextureFromMedia.ts";

const LICENSE_OPTIONS = [
  { label: "Personal use", value: "personal" },
  { label: "Commercial use", value: "commercial" },
  { label: "CC-BY", value: "cc-by" },
  { label: "All rights reserved", value: "all-rights-reserved" },
] as const;

export const Textures: CollectionConfig = {
  slug: "textures",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "neighborhood", "status", "updatedAt"],
    group: "Archive",
  },
  hooks: {
    beforeChange: [enrichTextureFromMedia],
  },
  fields: [
    {
      name: "textureId",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "Public ID used in URLs and map pins (e.g. tex_001)",
      },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly slug",
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "description",
      type: "textarea",
      required: true,
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [...TEXTURE_CATEGORY_OPTIONS],
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
      admin: {
        description: "Pick from the shared tag taxonomy",
      },
    },
    {
      name: "neighborhood",
      type: "text",
      required: true,
    },
    {
      name: "address",
      type: "text",
    },
    {
      name: "locationNote",
      type: "textarea",
      admin: {
        description: "Handwritten-style field note shown in the modal",
      },
    },
    {
      name: "location",
      type: "group",
      fields: [
        {
          name: "latitude",
          type: "number",
          required: true,
          admin: { step: 0.000001 },
        },
        {
          name: "longitude",
          type: "number",
          required: true,
          admin: { step: 0.000001 },
        },
      ],
    },
    {
      name: "license",
      type: "select",
      required: true,
      defaultValue: "cc-by",
      options: [...LICENSE_OPTIONS],
    },
    {
      name: "scannedBy",
      type: "text",
      required: true,
    },
    {
      name: "scannedAt",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "dpi",
      type: "number",
      admin: {
        description: "Optional override — otherwise inferred from primary asset when available",
      },
    },
    {
      name: "markerColor",
      type: "text",
      admin: {
        description: "Optional hex override for map pin fallback color (e.g. #E84420)",
      },
    },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Map pin + list thumbnail — defaults to preview when empty on save",
      },
    },
    {
      name: "preview",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description: "Primary preview shown in the asset modal",
      },
    },
    {
      // `format`, `width` and `height` below are a denormalised cache of the
      // uploaded media, refreshed by `enrichTextureFromMedia` on every save.
      // The media record is authoritative — the domain layer reads these only
      // when the relation is unpopulated (depth: 0).
      name: "assets",
      type: "array",
      admin: {
        description: "Downloadable files — format and dimensions are read from the uploaded media",
      },
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
        },
        {
          name: "file",
          type: "upload",
          relationTo: "media",
          required: true,
        },
        {
          name: "format",
          type: "text",
          admin: {
            readOnly: true,
            description: "Auto-filled from file metadata",
          },
        },
        {
          name: "width",
          type: "number",
          admin: {
            readOnly: true,
            description: "Auto-filled from file metadata",
          },
        },
        {
          name: "height",
          type: "number",
          admin: {
            readOnly: true,
            description: "Auto-filled from file metadata",
          },
        },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
  ],
};
