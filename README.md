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
- `data/textures.geojson` is the source of truth for the seed catalog — both the metadata and
  the list of files each texture owns.
- **Dummy assets.** No real scans exist yet. The binaries under `public/textures/` are generated
  and gitignored, so on a fresh checkout run this **before** importing:

```bash
npm run generate:dummy-assets
```

  It is deterministic and idempotent — re-running overwrites cleanly — and writes the produced
  byte sizes back into `data/textures.geojson` so the manifest can never disagree with what is
  on disk.
- One-time GeoJSON import: `npm run migrate:geojson`. It exits non-zero and names every file
  it could not find, rather than silently substituting a placeholder.
- Public API: `GET /api/atlas/textures` (full published set) and `POST /api/atlas/textures` with a
  bounds body (viewport query). Atlas routes live under `/api/atlas/*` so they never shadow
  Payload's REST handler at `/api/[...slug]`.
- Search API: `GET /api/atlas/search?q=<query>&limit=<n>`

## Project layout

| Path | Purpose |
|------|---------|
| `src/app/(frontend)/` | Map app |
| `src/app/(payload)/` | Payload admin + API |
| `src/features/` | Atlas + texture UI |
| `src/domain/textures/` | Business logic + GeoJSON mapping |
| `src/payload/` | CMS collections |
