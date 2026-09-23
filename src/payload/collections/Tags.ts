import type { CollectionConfig } from "payload";
import { slugify } from "../slug.ts";

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["label", "slug"],
    group: "Archive",
    description: "Controlled vocabulary for texture tagging",
  },
  fields: [
    {
      name: "label",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "Lowercase identifier (e.g. peeling, blue-tile). Derived from the label when left blank.",
      },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            // Editors should not have to hand-type this, and a hand-typed one
            // that drifts from the migrations' transform creates duplicates.
            if (typeof value === "string" && value.trim()) return slugify(value);
            const label = (siblingData as { label?: unknown } | undefined)?.label;
            return typeof label === "string" ? slugify(label) : value;
          },
        ],
      },
    },
  ],
};
