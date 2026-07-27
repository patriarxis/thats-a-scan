# Textures Atlas

Interactive map of Athens surface textures — graffiti, marble, rust, tile, and more — with an archive-style asset modal and Payload CMS backend.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **MapLibre GL** with custom archive basemap styling
- **Payload 3** + **Neon Postgres** + optional **Cloudflare R2** media storage

## Local setup

1. Copy env template and fill in values:

```bash
cp .env.example .env.local
```

2. Install and run:

```bash
npm install
npm run generate:importmap
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) for the map and [http://localhost:3000/admin](http://localhost:3000/admin) for Payload.

4. On first run after schema changes, start dev once and accept Payload’s DB prompts (creates the `tags` table). Then optionally run `npm run migrate:tags` to move old inline tags into the taxonomy.

## Data

- Textures are managed in Payload (`textures` collection).
- Optional one-time GeoJSON import: `npm run migrate:geojson`
- Public API: `GET /api/textures?bounds=...`

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/(frontend)/` | Map app |
| `src/app/(payload)/` | Payload admin + API |
| `src/features/` | Atlas + texture UI |
| `src/domain/textures/` | Business logic + GeoJSON mapping |
| `src/payload/` | CMS collections |
