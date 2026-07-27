import type { CollectionConfig } from "payload";

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
        description: "Lowercase identifier (e.g. peeling, blue-tile)",
      },
    },
  ],
};
